import { readWithRetry } from './pending-read.ts';
import { DEFAULT_VIEW_CACHE_TTL_MS, registerPresentationCache, type ViewCacheEntry } from './view-cache.ts';

export type ReadKey = Readonly<{ dataType: string; profileId: string; network: string; generation: number; query?: unknown }>;
/** Exact query coverage: object property order is irrelevant; array order is significant. */
export function normalizedQuery(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(normalizedQuery).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([,v]) => v !== undefined).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${JSON.stringify(k)}:${normalizedQuery(v)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
type Pending = { key: ReadKey; controller: AbortController; promise: Promise<ViewCacheEntry<unknown>>; foreground: boolean };
/**
 * Context-owned, memory-only presentation reads. Keys include lifecycle and exact
 * query coverage; invalidation advances the data dependency revision. A page
 * detaches by ignoring completion, NOT by aborting this owner. Only lifecycle or
 * new evidence aborts work. Matching-record cleanup protects replacements from
 * providers that ignore abort. Refresh drops completed values but joins current
 * live work; authoritative operations deliberately do not use this cache.
 *
 * The owner installs pending work before invoking the loader and owns the sole
 * two-attempt timeout budget. Promotion cannot reset that budget. Source-derived
 * timestamps must be supplied unchanged; composing entries uses their minimum.
 */
export function createReadCoordinator(options: { now?: () => number; ttlMs?: number; changed?: () => void } = {}) {
  const now = options.now ?? Date.now, ttl = options.ttlMs ?? DEFAULT_VIEW_CACHE_TTL_MS;
  const completed = new Map<string, ViewCacheEntry<unknown>>(), pending = new Map<string, Pending>();
  const attempted=new Set<string>();
  const revisions = new Map<string, number>();
  const scope = (key: ReadKey) => normalizedQuery([key.dataType,key.profileId,key.network,key.generation]);
  const id = (key: ReadKey) => normalizedQuery([scope(key),revisions.get(scope(key)) ?? 0,key.query ?? {}]);
  function peek<T>(key: ReadKey): ViewCacheEntry<T> | undefined {
    const token=id(key), entry=completed.get(token) as ViewCacheEntry<T> | undefined;
    if (entry && now()-entry.fetchedAt >= ttl) { completed.delete(token); return; }
    return entry;
  }
  function read<T>(key: ReadKey, loader: (signal: AbortSignal) => Promise<T>, config: { force?: boolean; foreground?: boolean; timeout?: number; timestamp?: (value: T) => number; complete?: (value: T) => boolean } = {}): Promise<ViewCacheEntry<T>> {
    const token=id(key);
    if (config.force) completed.delete(token);
    else { const cached=peek<T>(key); if (cached) return Promise.resolve(cached); }
    const existing=pending.get(token);
    if (existing) { existing.foreground ||= !!config.foreground; options.changed?.(); return existing.promise as Promise<ViewCacheEntry<T>>; }
    attempted.add(token);
    const controller=new AbortController();
    const record: Pending={key,controller,foreground:!!config.foreground,promise:Promise.resolve(undefined as never)};
    const work=Promise.resolve().then(() => readWithRetry(loader,controller.signal,config.timeout ?? 30000)).then(value => {
      controller.signal.throwIfAborted();
      if (pending.get(token)!==record || token!==id(key)) throw new Error('Read invalidated.');
      if (config.complete && !config.complete(value)) throw new Error('Incomplete read.');
      const entry=Object.freeze({value,fetchedAt:config.timestamp?.(value) ?? now()});
      completed.set(token,entry); return entry;
    }).finally(() => { if (pending.get(token)===record) pending.delete(token); options.changed?.(); });
    record.promise=work; pending.set(token,record); options.changed?.();
    return work;
  }
  function invalidate(dataType?: string) {
    for (const [token,record] of pending) if (!dataType || record.key.dataType===dataType) { pending.delete(token); record.controller.abort(new Error('Read invalidated.')); }
    // Completed keys contain the normalized scope; avoid parsing user-controlled IDs.
    for (const token of completed.keys()) { const [serialized]=JSON.parse(token); if (!dataType || JSON.parse(serialized)[0]===dataType) completed.delete(token); }
    for (const token of revisions.keys()) if (!dataType || JSON.parse(token)[0]===dataType) revisions.set(token,(revisions.get(token) ?? 0)+1);
    if(!dataType)revisions.clear();
    for(const token of attempted) {const [serialized]=JSON.parse(token);if(!dataType || JSON.parse(serialized)[0]===dataType)attempted.delete(token);}
    options.changed?.();
  }
  // Register each scope before reading, including scopes whose only entry is cached.
  const ensure = <T>(key: ReadKey, loader: (signal: AbortSignal) => Promise<T>, config?: Parameters<typeof read<T>>[2]) => {
    if (!revisions.has(scope(key))) revisions.set(scope(key),0);
    return read(key,loader,config);
  };
  function publish<T>(key:ReadKey,value:T,fetchedAt:number) {
    if(!revisions.has(scope(key)))revisions.set(scope(key),0);
    completed.set(id(key),Object.freeze({value,fetchedAt}));
  }
  /** Derived complete snapshot: revision vector and oldest dependency timestamp. */
  function compose<T extends readonly unknown[]>(keys:readonly ReadKey[]):(ViewCacheEntry<T> & {dependencies:readonly string[]})|undefined {
    if(!keys.length || keys.some(key=>key.profileId!==keys[0].profileId || key.network!==keys[0].network || key.generation!==keys[0].generation))return;
    const entries=keys.map(key=>peek(key));
    if(entries.some(entry=>!entry))return;
    return Object.freeze({value:Object.freeze(entries.map(entry=>entry!.value)) as unknown as T,fetchedAt:Math.min(...entries.map(entry=>entry!.fetchedAt)),dependencies:Object.freeze(keys.map(id))});
  }
  const unregister=registerPresentationCache(()=>invalidate());
  function existing(key:ReadKey) { const cached=peek(key);return cached ? Promise.resolve(cached) : pending.get(id(key))?.promise; }
  return Object.freeze({read:ensure,peek,publish,compose,invalidate,existing,wasAttempted:(key:ReadKey)=>attempted.has(id(key)),dispose(){unregister();invalidate();},hasForeground:()=>[...pending.values()].some(record=>record.foreground),isPending:(key:ReadKey)=>pending.has(id(key))});
}
