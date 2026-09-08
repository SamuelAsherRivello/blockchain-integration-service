import type { BisContext } from './context';
import type { BisAsset, BisMintAssetRequest } from './assets';

export type BisAssetCollectionOptions = Readonly<{
  asset: Omit<BisMintAssetRequest, 'operationId'>;
  successMessage: string;
  timeoutMs?: number;
}>;
export type BisAssetCollectionState = Readonly<{
  status: 'checking' | 'available' | 'owned' | 'guest' | 'pending' | 'uncertain' | 'blocked' | 'error';
  message: string; busy: boolean; canCollect: boolean; canCheck: boolean; needsAcknowledgment: boolean;
}>;

/** Optional collection policy for hosts; metadata is supplied by the host, not a game catalog. */
export function createBisAssetCollection(context: BisContext, options: BisAssetCollectionOptions) {
  const metadata = Object.freeze({...options.asset});
  const matches = (value: Pick<BisAsset, 'name' | 'ticker' | 'decimals'>) =>
    value.name === metadata.name && value.ticker === metadata.ticker && value.decimals === metadata.decimals;
  let status: BisAssetCollectionState['status'] = 'checking', message = 'Checking ownership…';
  let busy = false, needsAcknowledgment = false, disposed = false, generation = 0;
  let request: BisMintAssetRequest | undefined;
  let identity = context.getState().profileId;
  const listeners = new Set<() => void>();
  const active = () => { const s = context.getState(); return s.hasProfile && s.phase === 'active'; };
  const getState = (): BisAssetCollectionState => Object.freeze({status, message, busy,
    canCollect: !disposed && !busy && !needsAcknowledgment && active() && status === 'available',
    canCheck: !disposed && !busy && !needsAcknowledgment && active() && ['uncertain','blocked','error'].includes(status), needsAcknowledgment});
  const publish = () => { if (!disposed) for (const listener of listeners) listener(); };
  const set = (next: BisAssetCollectionState['status'], text: string) => { status = next; message = text; publish(); };
  const unsubscribe = context.subscribe(() => {
    const next = context.getState().profileId;
    if (next !== identity || (!active() && status !== 'guest')) {
      generation++; identity = next; request = undefined; busy = false; needsAcknowledgment = false;
      set(active() ? 'error' : 'guest', active() ? 'Account changed. Check ownership again.' : 'Log in to collect this asset.');
    }
  });
  async function run(minting: boolean, action: (current: () => boolean) => Promise<void>) {
    if (disposed || busy) return;
    if (!active()) { set('guest', 'Log in to collect this asset.'); return; }
    const token = ++generation, profile = context.getState().profileId;
    const current = () => !disposed && token === generation && active() && context.getState().profileId === profile;
    busy = true; needsAcknowledgment = false;
    set(minting ? 'pending' : 'checking', minting ? 'Collecting asset…' : 'Checking ownership…');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([action(current), new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(Error('deadline')), options.timeoutMs ?? 75000);
      })]);
    } catch {
      if (current()) set(request ? 'uncertain' : 'error', request ? 'The mint outcome is unknown. Check its status before trying again.' : 'Ownership is unavailable. Check again.');
    } finally {
      clearTimeout(timer);
      if (current()) { generation++; busy = false; publish(); }
    }
  }
  async function inspect(current: () => boolean) {
    const pending = await context.getPendingAssetMint();
    if (!current()) return false;
    if (pending.status !== 'success' || pending.profileId !== identity) throw Error('pending unavailable');
    if (pending.request) {
      if (matches(pending.request) && pending.request.amount === metadata.amount) {
        request = pending.request;
        set('uncertain', 'An earlier mint needs a status check.');
      } else set('blocked', 'Another asset mint is unresolved. Resolve it in Account before collecting.');
      return false;
    }
    // An in-memory attempt remains recoverable even if its journal read returns no pending entry.
    if (request) { set('uncertain', 'Check the previous mint before trying again.'); return false; }
    const result = await context.listAssets();
    if (!current()) return false;
    if (result.status !== 'success' || result.profileId !== identity) throw Error('ownership unavailable');
    const owned = result.assets.some(asset => matches(asset) && /^\d+$/.test(asset.quantity) && BigInt(asset.quantity) > 0n);
    set(owned ? 'owned' : 'available', owned ? 'Already collected.' : '');
    return !owned;
  }
  async function submit(current: () => boolean) {
    if (!request || !current()) return;
    const original = request;
    const result = await context.mintAsset(original);
    if (!current()) return;
    if (result.status !== 'error') {
      if (result.profileId !== identity || result.operationId !== original.operationId || !matches(result.asset) || BigInt(result.asset.quantity) <= 0n) throw Error('mismatched receipt');
      request = undefined;
      set('owned', 'Already collected.');
      context.showToast(options.successMessage, {imageUrl: result.asset.iconUrl});
    } else if (['insufficient-funds','invalid-input','unsupported-environment','account-required','busy'].includes(result.code)) {
      request = undefined; needsAcknowledgment = true; set('error', result.message);
    } else set('uncertain', 'The mint outcome is unknown. Check its status before trying again.');
  }
  const refresh = () => run(false, async current => { await inspect(current); });
  return {
    getState, refresh,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    collect() {
      if (!getState().canCollect) return Promise.resolve();
      return run(true, async current => {
        if (!await inspect(current) || !current()) return;
        request = Object.freeze({...metadata, operationId: crypto.randomUUID()});
        set('pending', 'Collecting asset…');
        await submit(current);
      });
    },
    check() {
      if (!getState().canCheck) return Promise.resolve();
      if (!request) return refresh();
      return run(true, submit);
    },
    acknowledge() { needsAcknowledgment = false; return refresh(); },
    dispose() { disposed = true; generation++; unsubscribe(); listeners.clear(); },
  };
}
