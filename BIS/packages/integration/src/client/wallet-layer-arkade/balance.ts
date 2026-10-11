import { MnemonicIdentity, ReadonlyWallet, RestArkProvider, RestIndexerProvider, InMemoryWalletRepository, InMemoryContractRepository } from '@arkade-os/sdk';
import { requireNetwork, operatorFor, withTemporaryWallet, type AccountSecret } from './account.ts';
import { validRecovery } from '../state-layer-core/recovery-validation.ts';
import { shareIndexerReads } from './indexer-reads.ts';
import type { RoleWalletAccess } from './adapter-session.ts';

export type BalanceAmounts = Readonly<{
  /** Available off-chain sats retained for existing payment capability checks. */
  availableSats: number;
  /** Confirmed, currently available boarding sats before transfer reservations. */
  availableBitcoinSats: number;
  /** Available off-chain Arkade sats. */
  availableArkadeSats: number;
  totalSats: number;
  bitcoinSats: number;
  arkadeSats: number;
}>;
type BalanceWallet = {
  getBalance(): Promise<{ available: number; total: number; boarding: { confirmed: number; total: number } }>;
  getProviderConnectionState(): { mode: string; source: string };
};
// Kept private to the adapter, with a structural seam for failure-path tests.
export async function readFreshBalance(wallet: BalanceWallet): Promise<BalanceAmounts> {
  const balance = await wallet.getBalance();
  const connection = wallet.getProviderConnectionState();
  if (connection.mode !== 'online' || connection.source !== 'live' ||
      !Number.isSafeInteger(balance.available) || balance.available < 0 ||
      !Number.isSafeInteger(balance.total) || balance.total < balance.available ||
      !Number.isSafeInteger(balance.boarding?.confirmed) || balance.boarding.confirmed < 0 ||
      !Number.isSafeInteger(balance.boarding?.total) || balance.boarding.total < balance.boarding.confirmed ||
      balance.boarding.total > balance.total - balance.available) {
    throw new Error('Balance unavailable.');
  }
  return Object.freeze({
    availableSats: balance.available,
    availableBitcoinSats: balance.boarding.confirmed,
    availableArkadeSats: balance.available,
    totalSats: balance.total,
    bitcoinSats: balance.boarding.total,
    arkadeSats: balance.total - balance.boarding.total,
  });
}

export async function loadBalance(account: AccountSecret, signal: AbortSignal, session?: RoleWalletAccess): Promise<BalanceAmounts> {
  if (!validRecovery(account.phrase)) throw new Error('Invalid account.');
  if (session) return session.read(account,signal,readFreshBalance);
  const network=account.network ?? 'signet', operator=operatorFor(network);
  const response = await fetch(`${operator}/v1/info`, {
    cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  });
  if (!response.ok) throw new Error('Balance unavailable.');
  requireNetwork((await response.json()).network,network);
  signal.throwIfAborted();
  const arkProvider = new RestArkProvider(operator);
  const getInfo = arkProvider.getInfo.bind(arkProvider);
  arkProvider.getInfo = async () => { const info = await getInfo(); requireNetwork(info.network,network); return info; };
  const indexerProvider = shareIndexerReads(new RestIndexerProvider(operator),operator);
  // SDK synchronization can catch provider errors and return its repository.
  // Latch failures so a concurrent watcher success cannot erase that evidence.
  let indexerFailed = false;
  const getVtxos = indexerProvider.getVtxos.bind(indexerProvider);
  indexerProvider.getVtxos = async (...args) => {
    try { signal.throwIfAborted(); return await getVtxos(...args); }
    catch (error) { indexerFailed = true; throw error; }
  };
  const pending = ReadonlyWallet.create({
    identity: await MnemonicIdentity.fromMnemonic(account.phrase, { isMainnet: false }).toReadonly(),
    arkProvider, indexerProvider,
    storage: { walletRepository: new InMemoryWalletRepository(), contractRepository: new InMemoryContractRepository() },
    watcherConfig: { failsafePollIntervalMs: 60000, reconnectDelayMs: 60000, maxReconnectAttempts: 1 },
  });
  return withTemporaryWallet(pending, signal, async wallet => {
    const amounts = await readFreshBalance(wallet);
    if (indexerFailed) throw new Error('Balance unavailable.');
    return amounts;
  });
}
