import { MnemonicIdentity, Wallet, RestArkProvider, RestIndexerProvider, InMemoryWalletRepository, InMemoryContractRepository } from '@arkade-os/sdk';
import { requireSignet, SIGNET_OPERATOR, withTemporaryWallet, type AccountSecret } from './account.ts';
import { validRecovery } from '../core/recovery-validation.ts';

export type BalanceAmounts = Readonly<{ availableSats: number; totalSats: number }>;
type BalanceWallet = {
  getBalance(): Promise<{ available: number; total: number }>;
  getProviderConnectionState(): { mode: string; source: string };
};
// Kept private to the adapter, with a structural seam for failure-path tests.
export async function readFreshBalance(wallet: BalanceWallet): Promise<BalanceAmounts> {
  const balance = await wallet.getBalance();
  const connection = wallet.getProviderConnectionState();
  if (connection.mode !== 'online' || connection.source !== 'live' ||
      !Number.isSafeInteger(balance.available) || balance.available < 0 ||
      !Number.isSafeInteger(balance.total) || balance.total < balance.available) {
    throw new Error('Balance unavailable.');
  }
  return Object.freeze({ availableSats: balance.available, totalSats: balance.total });
}

export async function loadBalance(account: AccountSecret, signal: AbortSignal): Promise<BalanceAmounts> {
  if (!validRecovery(account.phrase)) throw new Error('Invalid account.');
  const response = await fetch(`${SIGNET_OPERATOR}/v1/info`, {
    cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  });
  if (!response.ok) throw new Error('Balance unavailable.');
  requireSignet((await response.json()).network);
  signal.throwIfAborted();
  const arkProvider = new RestArkProvider(SIGNET_OPERATOR);
  const getInfo = arkProvider.getInfo.bind(arkProvider);
  arkProvider.getInfo = async () => { const info = await getInfo(); requireSignet(info.network); return info; };
  const indexerProvider = new RestIndexerProvider(SIGNET_OPERATOR);
  // SDK synchronization can catch provider errors and return its repository.
  // Latch failures so a concurrent watcher success cannot erase that evidence.
  let indexerFailed = false;
  const getVtxos = indexerProvider.getVtxos.bind(indexerProvider);
  indexerProvider.getVtxos = async (...args) => {
    try { signal.throwIfAborted(); return await getVtxos(...args); }
    catch (error) { indexerFailed = true; throw error; }
  };
  const pending = Wallet.create({
    identity: MnemonicIdentity.fromMnemonic(account.phrase, { isMainnet: false }),
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
