export type ViewCacheDataType = 'balance' | 'addresses' | 'details' | 'assets' | 'contracts' | 'activity' | 'operations';

export type ViewCacheKey = Readonly<{
  dataType: ViewCacheDataType;
  profileId: string;
  network: string;
}>;

export type ViewCacheEntry<T> = Readonly<{
  value: T;
  fetchedAt: number;
}>;

export const DEFAULT_VIEW_CACHE_TTL_MS = 5 * 60_000;

const hotReloadCaches = new Set<() => void>();
/** Shared by completed caches and context-owned presentation coordinators. */
export function registerPresentationCache(clear:()=>void) {
  if(import.meta.hot)hotReloadCaches.add(clear);
  return ()=>hotReloadCaches.delete(clear);
}

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => hotReloadCaches.forEach(clear => clear()));
  import.meta.hot.dispose(() => hotReloadCaches.clear());
}

export function viewCacheKey(key: ViewCacheKey): string {
  return `${key.dataType}:${key.network}:${key.profileId}`;
}

export function createViewCache(ttlMs = DEFAULT_VIEW_CACHE_TTL_MS) {
  const entries = new Map<string, ViewCacheEntry<unknown>>();

  function get<T>(key: ViewCacheKey, now = Date.now()): ViewCacheEntry<T> | undefined {
    const entry = entries.get(viewCacheKey(key)) as ViewCacheEntry<T> | undefined;
    if (!entry) return undefined;
    if (now - entry.fetchedAt >= ttlMs) {
      entries.delete(viewCacheKey(key));
      return undefined;
    }
    return entry;
  }

  function set<T>(key: ViewCacheKey, value: T, fetchedAt = Date.now(), complete = true): void {
    if (!complete) return;
    entries.set(viewCacheKey(key), Object.freeze({ value, fetchedAt }));
  }

  function invalidate(key: ViewCacheKey): void {
    entries.delete(viewCacheKey(key));
  }

  function invalidateDataType(dataType: ViewCacheDataType, profileId: string, network: string): void {
    invalidate({ dataType, profileId, network });
  }

  function invalidateProfile(profileId: string, network?: string): void {
    for (const key of entries.keys()) {
      const [, entryNetwork, entryProfileId] = key.split(':');
      if (entryProfileId === profileId && (!network || entryNetwork === network)) entries.delete(key);
    }
  }

  function clear(): void {
    entries.clear();
  }

  registerPresentationCache(clear);

  return Object.freeze({ get, set, invalidate, invalidateDataType, invalidateProfile, clear });
}
