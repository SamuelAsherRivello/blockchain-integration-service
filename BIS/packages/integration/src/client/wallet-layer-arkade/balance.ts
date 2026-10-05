import { MnemonicIdentity, ReadonlyWallet, RestArkProvider, RestIndexerProvider, InMemoryWalletRepository, InMemoryContractRepository } from '@arkade-os/sdk';
import { requireNetwork, operatorFor, withTemporaryWallet, type AccountSecret } from './account.ts';
import { validRecovery } from '../state-layer-core/recovery-validation.ts';

export type BalanceAmounts = Readonly<{ availableSats: number; totalSats: number; bitcoinSats: number; arkadeSats: number }>;
type BalanceWallet = {
  getBalance(): Promise<{ available: number; total: number; boarding: { total: number } }>;
  getProviderConnectionState(): { mode: string; source: string };
};
// Kept private to the adapter, with a structural seam for failure-path tests.
export async function readFreshBalance(wallet: BalanceWallet): Promise<BalanceAmounts> {
  const balance = await wallet.getBalance();
  const connection = wallet.getProviderConnectionState();
  if (connection.mode !== 'online' || connection.source !== 'live' ||
      !Number.isSafeInteger(balance.available) || balance.available < 0 ||
      !Number.isSafeInteger(balance.total) || balance.total < balance.available ||
      !Number.isSafeInteger(balance.boarding?.total) || balance.boarding.total < 0 ||
      balance.boarding.total > balance.total - balance.available) {
    throw new Error('Balance unavailable.');
  }
  return Object.freeze({ availableSats: balance.available, totalSats: balance.total, bitcoinSats: balance.boarding.total, arkadeSats: balance.total - balance.boarding.total });
}

export async function loadBalance(account: AccountSecret, signal: AbortSignal): Promise<BalanceAmounts> {
  if (!validRecovery(account.phrase)) throw new Error('Invalid account.');
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
  const indexerProvider = new RestIndexerProvider(operator);
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
