import type { BisAsset, BisListAssetsResult } from './assets.ts';
import type { TestNetwork } from './test-network.ts';
import { DEFAULT_VIEW_CACHE_TTL_MS } from './view-cache.ts';
export type SharedAssetInventoryRole = 'player' | 'game';
type Entry = Readonly<{ profileId: string; network: TestNetwork; role: SharedAssetInventoryRole; assets: readonly BisAsset[]; fetchedAt: number }>;
type Pending = { role: SharedAssetInventoryRole; profileId: string; network: TestNetwork; controller: AbortController; work: Promise<BisListAssetsResult> };
const entries = new Map<string, Entry>(), pending = new Map<string, Pending>();
const key = (role: SharedAssetInventoryRole, profileId: string, network: TestNetwork) => `${role}:${network}:${profileId}`;
function fresh(entry: Entry | undefined, now = Date.now()) { if (!entry) return; if (now - entry.fetchedAt >= DEFAULT_VIEW_CACHE_TTL_MS) { entries.delete(key(entry.role, entry.profileId, entry.network)); return; } return entry; }
export function prepareSharedAssetInventory(options: { role: SharedAssetInventoryRole; profileId: string; network: TestNetwork; timeoutMs?: number; load(signal: AbortSignal): Promise<readonly BisAsset[]> }): Promise<BisListAssetsResult> {
  const id = key(options.role, options.profileId, options.network), cached = fresh(entries.get(id));
  if (cached) return Promise.resolve({ status: 'success', profileId: cached.profileId, assets: cached.assets });
  const existing = pending.get(id); if (existing) return existing.work;
  const controller = new AbortController();
  const interrupted = new Promise<never>((_, reject) => controller.signal.addEventListener('abort', () => reject(Error('Inventory read interrupted.')), {once:true}));
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 30000);
  const work: Promise<BisListAssetsResult> = Promise.race([
    Promise.resolve().then(() => { controller.signal.throwIfAborted(); return options.load(controller.signal); }), interrupted,
  ]).then(assets => {
    controller.signal.throwIfAborted();
    const entry: Entry = Object.freeze({ role: options.role, profileId: options.profileId, network: options.network, assets: Object.freeze(assets.map(asset => Object.freeze({ ...asset }))), fetchedAt: Date.now() });
    entries.set(id, entry);
    return {status:'success' as const,profileId:entry.profileId,assets:entry.assets};
  }).catch(() => ({ status: 'error' as const, code: 'unavailable' as const, message: 'Assets are unavailable. Try again.', profileId: options.profileId }))
    .finally(() => { clearTimeout(timer); controller.abort(); if (pending.get(id)?.work === work) pending.delete(id); });
  pending.set(id, {role:options.role,profileId:options.profileId,network:options.network,controller,work});
  return work;
}
export function rememberSharedAssetInventory(role: SharedAssetInventoryRole, profileId: string, network: TestNetwork, assets: readonly BisAsset[]) { entries.set(key(role, profileId, network), Object.freeze({ role, profileId, network, assets: Object.freeze(assets.map(asset => Object.freeze({ ...asset }))), fetchedAt: Date.now() })); }
export function getSharedAssetInventory(role: SharedAssetInventoryRole, profileId: string, network: TestNetwork): BisListAssetsResult | undefined { const entry=fresh(entries.get(key(role,profileId,network))); return entry ? { status:'success', profileId:entry.profileId, assets:entry.assets } : undefined; }
export function invalidateSharedAssetInventory(profileId?: string, network?: TestNetwork, role?: SharedAssetInventoryRole) {
  const matches = (entry: Pick<Entry,'profileId'|'network'|'role'>) => (!profileId || entry.profileId === profileId) && (!network || entry.network === network) && (!role || entry.role === role);
  for (const [id, entry] of entries) if (matches(entry)) entries.delete(id);
  for (const [id, entry] of pending) if (matches(entry)) { pending.delete(id); entry.controller.abort(); }
}
