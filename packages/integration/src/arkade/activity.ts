import { ReadonlyWallet, MnemonicIdentity, RestArkProvider, RestIndexerProvider, EsploraProvider, InMemoryWalletRepository, InMemoryContractRepository, type ArkTransaction } from '@arkade-os/sdk';
import { requireSignet, SIGNET_OPERATOR, type AccountSecret } from './account.ts';
import { validRecovery } from '../core/recovery-validation.ts';
import type { BisTransaction } from '../core/activity.ts';

type Coin = { txid: string; vout: number; value: number; status: { confirmed: boolean } };
export function normalizeHistory(history: readonly ArkTransaction[], coins: readonly Coin[]): readonly BisTransaction[] {
  // Preserve SDK records (including same-transaction outputs); reconcile snapshots, never append notifications.
  const occurrences = new Map<string, number>();
  const rows = history.map((tx): BisTransaction => {
    if (!Number.isSafeInteger(tx.amount) || tx.amount < 0 || !['RECEIVED', 'SENT'].includes(tx.type)) throw Error('Activity unavailable.');
    const { boardingTxid, commitmentTxid, arkTxid } = tx.key;
    const key = JSON.stringify([tx.type, boardingTxid, commitmentTxid, arkTxid, tx.amount]);
    const occurrence = occurrences.get(key) ?? 0;
    occurrences.set(key, occurrence + 1);
    const matches = coins.filter(c => c.txid === boardingTxid && c.value === tx.amount);
    // A unique match proves an outpoint. Ambiguous/spent history keeps only known IDs.
    const coin = matches.length === 1 ? matches[0] : undefined;
    const createdAt = Number.isFinite(tx.createdAt) && tx.createdAt > 0 ? tx.createdAt : undefined;
    const offchain = !!arkTxid && !boardingTxid;
    const status: BisTransaction['status'] = boardingTxid
      ? coin ? (coin.status.confirmed ? 'Confirmed' : 'Pending') : createdAt ? 'Confirmed' : 'Pending'
      : offchain ? (tx.settled ? 'Settled offchain' : 'Pending offchain') : 'Status unavailable';
    const refs = [boardingTxid && (coin ? `${boardingTxid}:${coin.vout}` : boardingTxid),
      commitmentTxid && `commitment:${commitmentTxid}`, arkTxid && `ark:${arkTxid}`].filter(Boolean);
    return Object.freeze({ id: `${key}:${occurrence}`, amountSats: tx.amount, direction: tx.type === 'SENT' ? 'Outgoing' : 'Incoming', status, identifier: refs.join(' ') || 'Identifier unavailable', ...(createdAt ? { createdAt } : {}) });
  });
  const group = (t: BisTransaction) => t.createdAt ? 1 : t.status.startsWith('Pending') ? 0 : 2;
  rows.sort((a, b) => group(a) - group(b) || (b.createdAt ?? 0) - (a.createdAt ?? 0));
  return Object.freeze(rows);
}

export type ActivityWallet = Pick<ReadonlyWallet, 'getTransactionHistory' | 'getBoardingUtxos' | 'getProviderConnectionState' | 'notifyIncomingFunds' | 'dispose'>;
export async function observeActivityWallet(pending: Promise<ActivityWallet>, signal: AbortSignal, publish: (rows: readonly BisTransaction[]) => void, healthy = () => true, intervalMs = 15000): Promise<void> {
  let wallet: ActivityWallet | undefined, stop: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let ended = false, reading = false, dirty = false;
  let finish!: () => void, fail!: (error: Error) => void;
  const finished = new Promise<void>((resolve, reject) => { finish = resolve; fail = reject; });
  const abort = () => { ended = true; finish(); };
  const failure = () => { ended = true; fail(Error('Activity unavailable.')); };
  const bounded = async <T,>(work: Promise<T>): Promise<T> => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([work, finished.then(() => { throw Error('Activity stopped.'); }), new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(Error('Activity timed out.')), 20000); })]); }
    finally { clearTimeout(timeout); }
  };
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
  const acquired = pending.then(async w => { if (ended) { await w.dispose(); throw Error('Activity stopped.'); } wallet = w; return w; });
  const read = async () => {
    if (ended) return;
    if (reading) { dirty = true; return; }
    reading = true;
    clearTimeout(timer);
    try {
      do {
        dirty = false;
        const [history, coins] = await bounded(Promise.all([wallet!.getTransactionHistory(), wallet!.getBoardingUtxos()]));
        const connection = wallet!.getProviderConnectionState();
        if (!healthy() || connection.mode !== 'online' || connection.source !== 'live') throw Error('Activity unavailable.');
        if (!ended) publish(normalizeHistory(history, coins));
      } while (dirty && !ended);
    } catch { if (!ended) failure(); }
    finally { reading = false; if (!ended) timer = setTimeout(() => void read(), intervalMs); }
  };
  try {
    await bounded(acquired);
    const subscription = wallet!.notifyIncomingFunds(() => void read()).then(unsubscribe => { if (ended) unsubscribe(); else stop = unsubscribe; });
    await bounded(subscription);
    await read();
    await finished;
  } finally {
    ended = true; finish(); clearTimeout(timer); signal.removeEventListener('abort', abort);
    stop?.(); await wallet?.dispose();
  }
}

export async function watchActivity(account: AccountSecret, signal: AbortSignal, publish: (rows: readonly BisTransaction[]) => void): Promise<void> {
  if (!validRecovery(account.phrase)) throw Error('Invalid account.');
  signal.throwIfAborted();
  const arkProvider = new RestArkProvider(SIGNET_OPERATOR);
  const getInfo = arkProvider.getInfo.bind(arkProvider);
  arkProvider.getInfo = async () => { const info = await getInfo(); requireSignet(info.network); return info; };
  const indexerProvider = new RestIndexerProvider(SIGNET_OPERATOR);
  const onchainProvider = new EsploraProvider('https://mempool.space/signet/api', { forcePolling: true, pollingInterval: 15000 });
  let failed = false;
  const getVtxos = indexerProvider.getVtxos.bind(indexerProvider);
  indexerProvider.getVtxos = async (...args) => { try { signal.throwIfAborted(); return await getVtxos(...args); } catch (error) { failed = true; throw error; } };
  const getTransactions = onchainProvider.getTransactions.bind(onchainProvider);
  onchainProvider.getTransactions = async (...args) => { try { signal.throwIfAborted(); return await getTransactions(...args); } catch (error) { failed = true; throw error; } };
  await observeActivityWallet(ReadonlyWallet.create({
    identity: MnemonicIdentity.fromMnemonic(account.phrase, { isMainnet: false }), arkProvider, indexerProvider, onchainProvider,
    storage: { walletRepository: new InMemoryWalletRepository(), contractRepository: new InMemoryContractRepository() },
  }), signal, publish, () => !failed);
}
