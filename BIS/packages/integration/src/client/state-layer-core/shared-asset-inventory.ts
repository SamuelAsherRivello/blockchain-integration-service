import type { BisAsset, BisListAssetsResult } from './assets.ts';
import type { TestNetwork } from './test-network.ts';
import { DEFAULT_VIEW_CACHE_TTL_MS } from './view-cache.ts';
export type SharedAssetInventoryRole = 'player' | 'game';
type Entry = Readonly<{ profileId: string; network: TestNetwork; role: SharedAssetInventoryRole; assets: readonly BisAsset[]; fetchedAt: number }>;
const entries = new Map<string, Entry>(), pending = new Map<string, Promise<Entry>>();
const key = (role: SharedAssetInventoryRole, profileId: string, network: TestNetwork) => `${role}:${network}:${profileId}`;
function fresh(entry: Entry | undefined, now = Date.now()) { if (!entry) return; if (now - entry.fetchedAt >= DEFAULT_VIEW_CACHE_TTL_MS) { entries.delete(key(entry.role, entry.profileId, entry.network)); return; } return entry; }
export function prepareSharedAssetInventory(options: { role: SharedAssetInventoryRole; profileId: string; network: TestNetwork; load(signal: AbortSignal): Promise<readonly BisAsset[]> }): Promise<BisListAssetsResult> {
  const id = key(options.role, options.profileId, options.network), cached = fresh(entries.get(id));
  if (cached) return Promise.resolve({ status: 'success', profileId: cached.profileId, assets: cached.assets });
  const existing = pending.get(id); if (existing) return existing.then(entry => ({ status: 'success', profileId: entry.profileId, assets: entry.assets }));
  const work = Promise.resolve().then(() => options.load(new AbortController().signal)).then(assets => { const entry: Entry = Object.freeze({ role: options.role, profileId: options.profileId, network: options.network, assets: Object.freeze(assets.map(asset => Object.freeze({ ...asset }))), fetchedAt: Date.now() }); entries.set(id, entry); return entry; });
  pending.set(id, work); void work.then(() => { if (pending.get(id) === work) pending.delete(id); }, () => { if (pending.get(id) === work) pending.delete(id); });
  return work.then(entry => ({ status: 'success' as const, profileId: entry.profileId, assets: entry.assets })).catch(() => ({ status: 'error' as const, code: 'unavailable' as const, message: 'Assets are unavailable. Try again.', profileId: options.profileId }));
}
export function rememberSharedAssetInventory(role: SharedAssetInventoryRole, profileId: string, network: TestNetwork, assets: readonly BisAsset[]) { entries.set(key(role, profileId, network), Object.freeze({ role, profileId, network, assets: Object.freeze(assets.map(asset => Object.freeze({ ...asset }))), fetchedAt: Date.now() })); }
export function getSharedAssetInventory(role: SharedAssetInventoryRole, profileId: string, network: TestNetwork): BisListAssetsResult | undefined { const entry=fresh(entries.get(key(role,profileId,network))); return entry ? { status:'success', profileId:entry.profileId, assets:entry.assets } : undefined; }
export function invalidateSharedAssetInventory(profileId?: string, network?: TestNetwork, role?: SharedAssetInventoryRole) { for (const [id, entry] of entries) if ((!profileId || entry.profileId === profileId) && (!network || entry.network === network) && (!role || entry.role === role)) entries.delete(id); }
