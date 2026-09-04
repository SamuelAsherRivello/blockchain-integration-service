import { ReadonlyWallet, MnemonicIdentity, RestArkProvider, RestIndexerProvider, EsploraProvider, InMemoryWalletRepository, InMemoryContractRepository, assetMintResolver, type ArkTransaction } from '@arkade-os/sdk';
import { requireSignet, SIGNET_OPERATOR, type AccountSecret } from './account.ts';
import { validRecovery } from '../core/recovery-validation.ts';
import type { BisTransaction } from '../core/activity.ts';

type Coin = { txid: string; vout: number; value: number; status: { confirmed: boolean; block_height?: number } };
export function normalizeHistory(history: readonly ArkTransaction[], coins: readonly Coin[], tipHeight?: number): readonly BisTransaction[] {
  // Preserve SDK records (including same-transaction outputs); reconcile snapshots, never append notifications.
  const occurrences = new Map<string, number>();
  const rows = history.map((tx): BisTransaction => {
    if (!Number.isSafeInteger(tx.amount) || tx.amount < 0 || !['RECEIVED', 'SENT'].includes(tx.type)) throw Error('Activity unavailable.');
    const { boardingTxid, commitmentTxid, arkTxid } = tx.key;
    const assets=tx.assets?.map(asset=>{
      if(typeof asset.assetId!=='string'||!asset.assetId||typeof asset.amount!=='bigint'||asset.amount<0n)throw Error('Asset history unavailable.');
      return Object.freeze({assetId:asset.assetId,quantity:asset.amount.toString()});
    });
    const kind=assets?.length ? assetMintResolver().resolve(tx)?.[0]?.label ?? 'Asset transfer' : undefined;
    const key = JSON.stringify([tx.type, boardingTxid, commitmentTxid, arkTxid, tx.amount]);
    const occurrence = occurrences.get(key) ?? 0;
    occurrences.set(key, occurrence + 1);
    const matches = coins.filter(c => c.txid === boardingTxid && c.value === tx.amount);
    // A unique match proves an outpoint. Ambiguous/spent history keeps only known IDs.
    const coin = matches.length === 1 ? matches[0] : undefined;
    const blockHeight = coin?.status.confirmed && Number.isSafeInteger(coin.status.block_height) && coin.status.block_height! > 0 ? coin.status.block_height : undefined;
    const confirmations = coin?.status.confirmed === false ? 0 : blockHeight !== undefined && Number.isSafeInteger(tipHeight) && tipHeight! >= blockHeight ? tipHeight! - blockHeight + 1 : undefined;
    const bitcoin = boardingTxid ? Object.freeze({txid:boardingTxid, confirmations, blockHeight}) : undefined;
    const createdAt = Number.isFinite(tx.createdAt) && tx.createdAt > 0 ? tx.createdAt : undefined;
    const offchain = !!arkTxid && !boardingTxid;
    const status: BisTransaction['status'] = boardingTxid
      ? coin ? (coin.status.confirmed ? 'Confirmed' : 'Pending') : createdAt ? 'Confirmed' : 'Pending'
      : offchain ? (tx.settled ? 'Settled offchain' : 'Pending offchain') : 'Status unavailable';
    const refs = [boardingTxid && (coin ? `${boardingTxid}:${coin.vout}` : boardingTxid),
      commitmentTxid && `commitment:${commitmentTxid}`, arkTxid && `ark:${arkTxid}`].filter(Boolean);
    return Object.freeze({ id: `${key}:${occurrence}`, amountSats: tx.amount, direction: tx.type === 'SENT' ? 'Outgoing' : 'Incoming', status, identifier: refs.join(' ') || 'Identifier unavailable', ...(bitcoin ? {bitcoin} : {}), ...(createdAt ? { createdAt } : {}),...(assets?.length?{assets:Object.freeze(assets),kind}:{}) });
  });
  const group = (t: BisTransaction) => t.createdAt ? 1 : t.status.startsWith('Pending') ? 0 : 2;
  rows.sort((a, b) => group(a) - group(b) || (b.createdAt ?? 0) - (a.createdAt ?? 0));
  return Object.freeze(rows);
}

export type ActivityWallet = Pick<ReadonlyWallet, 'getTransactionHistory' | 'getBoardingUtxos' | 'getProviderConnectionState' | 'notifyIncomingFunds' | 'dispose'> & Partial<Pick<ReadonlyWallet, 'onchainProvider'>>;
// History fans out across boarding addresses and sequential historical outspend
// lookups. Give the complete SDK read a bounded minute, not one HTTP timeout.
export async function observeActivityWallet(pending: Promise<ActivityWallet>, signal: AbortSignal, publish: (rows: readonly BisTransaction[]) => void, healthy = () => true, intervalMs = 15000, requestTimeoutMs = 60000): Promise<void> {
  let wallet: ActivityWallet | undefined, stop: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let ended = false, reading = false, dirty = false;
  let finish!: () => void, fail!: (error: Error) => void;
  const finished = new Promise<void>((resolve, reject) => { finish = resolve; fail = reject; });
  const abort = () => { ended = true; finish(); };
  const failure = () => { ended = true; fail(Error('Activity unavailable.')); };
  const bounded = async <T,>(work: Promise<T>, timeoutMs = requestTimeoutMs): Promise<T> => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([work, finished.then(() => { throw Error('Activity stopped.'); }), new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(Error('Activity timed out.')), timeoutMs); })]); }
    finally { clearTimeout(timeout); }
  };
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
  const dispose=(w:ActivityWallet)=>{void Promise.resolve().then(()=>w.dispose()).catch(()=>{});};
  const acquired = pending.then(w => { if (ended) { dispose(w); throw Error('Activity stopped.'); } wallet = w; return w; });
  const read = async () => {
    if (ended) return;
    if (reading) { dirty = true; return; }
    reading = true;
    clearTimeout(timer);
    try {
      do {
        dirty = false;
        // A failed tip lookup must not hide otherwise valid transaction history.
        const tipRead = wallet!.onchainProvider ? bounded(Promise.resolve().then(() => wallet!.onchainProvider!.getChainTip()), Math.min(5000, requestTimeoutMs / 2)).catch(() => undefined) : Promise.resolve(undefined);
        const [history, coins, tip] = await bounded(Promise.all([wallet!.getTransactionHistory(), wallet!.getBoardingUtxos(), tipRead]));
        const connection = wallet!.getProviderConnectionState();
        if (!healthy() || connection.mode !== 'online' || connection.source !== 'live') throw Error('Activity unavailable.');
        if (!ended) publish(normalizeHistory(history, coins, tip?.height));
      } while (dirty && !ended);
    } catch { if (!ended) failure(); }
    finally { reading = false; if (!ended) timer = setTimeout(() => void read(), intervalMs); }
  };
  try {
    await bounded(acquired);
    // Notifications accelerate updates; bounded polling remains sufficient when
    // subscription establishment stalls or fails. Never gate the initial read.
    const subscription = Promise.resolve().then(()=>wallet!.notifyIncomingFunds(() => void read())).then(unsubscribe => { if (ended) unsubscribe(); else stop = unsubscribe; });
    void bounded(subscription).catch(()=>{});
    await read();
    await finished;
  } finally {
    ended = true; finish(); clearTimeout(timer); signal.removeEventListener('abort', abort);
    try {stop?.();}catch {/* Cleanup must not hide the read outcome. */}
    if(wallet)dispose(wallet);
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
    identity: await MnemonicIdentity.fromMnemonic(account.phrase, { isMainnet: false }).toReadonly(), arkProvider, indexerProvider, onchainProvider,
    storage: { walletRepository: new InMemoryWalletRepository(), contractRepository: new InMemoryContractRepository() },
  }), signal, publish, () => !failed);
}
