import type { AccountSecret } from '../wallet-layer-arkade/account.ts';
import type { BisAssets } from './asset-presentation.ts';
import type { BisAsset } from './assets.ts';
import { createViewCache, type ViewCacheKey } from './view-cache.ts';

type AssetState = Readonly<{ profileId?: string; network?: string; assets: BisAssets }>;
type AssetIdentity = Readonly<{ version: number; profileId?: string }>;

export type AssetViewLifecycleOptions = Readonly<{
  getState(): AssetState;
  getIdentity(): AssetIdentity;
  isDisposed(): boolean;
  isVisible(): boolean;
  readSnapshot(signal: AbortSignal): Promise<{ assets: readonly BisAsset[] }>;
  setAssets(assets: BisAssets): void;
  loadAccount(): Promise<{ account?: AccountSecret | null }>;
  observeAssets?(account: AccountSecret, signal: AbortSignal, changed: () => void): Promise<void>;
}>;

/** Owns only the visible asset snapshot/watch lifecycle; the context retains public state ownership. */
export function createAssetViewLifecycle(options: AssetViewLifecycleOptions) {
  const cache = createViewCache();
  const idleAssets: BisAssets = Object.freeze({status:'idle'});
  let watch = new AbortController();
  let refreshPending = false;
  let read: Promise<void> | undefined;
  let version = 0;
  let operation = new AbortController();
  const cancel = () => { version++; operation.abort(); operation = new AbortController(); };

  async function refresh(background = false): Promise<void> {
    if (!options.isVisible()) return;
    if (read) { if (background) refreshPending = true; return read; }
    const work = async () => {
      do {
        refreshPending = false;
        cancel();
        const request = version;
        const identity = options.getIdentity();
        const signal = operation.signal;
        const current = () => !options.isDisposed() && !signal.aborted && request === version && identity.version === options.getIdentity().version && identity.profileId === options.getIdentity().profileId && options.isVisible();
        const profileId=options.getState().profileId;
        const cacheKey: ViewCacheKey | undefined = profileId ? {dataType:'assets', profileId, network:options.getState().network ?? 'signet'} : undefined;
        if (!background && options.getState().assets.status === 'idle' && cacheKey) {
          const cached=cache.get<{assets: readonly BisAsset[]}>(cacheKey);
          if (cached) {
            if(current()) options.setAssets(Object.freeze({status:'ready',assets:cached.value.assets}));
            break;
          }
        }
        if (background && cacheKey) cache.invalidate(cacheKey);
        if (!background || options.getState().assets.status !== 'ready') options.setAssets(Object.freeze({status:'loading'}));
        try {
          const result = await options.readSnapshot(signal);
          if (current()) {
            if (cacheKey) cache.set(cacheKey,{assets:result.assets});
            options.setAssets(Object.freeze({status:'ready', ...(background ? {background:true} : {}), assets:result.assets}));
          }
        } catch {
          if (current()) options.setAssets(Object.freeze({status:'unavailable'}));
        }
        if (!current()) break;
      } while (refreshPending);
    };
    const active = work(); read = active;
    try { await active; } finally { if (read === active) read = undefined; }
  }

  function reset() {
    watch.abort();
    watch = new AbortController();
    read = undefined;
    refreshPending = false;
    cancel();
  }

  function startWatch() {
    if (!options.observeAssets) return;
    const signal = watch.signal;
    const profile = options.getState().profileId;
    void (async () => {
      const saved = await options.loadAccount();
      if (signal.aborted || options.isDisposed() || !saved.account || saved.account.profileId !== profile) return;
      await options.observeAssets!(saved.account, signal, () => {
        if (!signal.aborted && !options.isDisposed() && options.getState().profileId === profile && options.isVisible()) void refresh(true);
      });
    })().catch(() => { /* Manual refresh remains available if streaming is unavailable. */ });
  }

  function beginVisibleSession() {
    queueMicrotask(() => {
      if (!options.isDisposed() && options.isVisible() && options.getState().assets.status === 'idle') {
        void refresh();
        startWatch();
      }
    });
  }

  return Object.freeze({ idleAssets, refresh, reset, startWatch, beginVisibleSession, session: () => version });
}
