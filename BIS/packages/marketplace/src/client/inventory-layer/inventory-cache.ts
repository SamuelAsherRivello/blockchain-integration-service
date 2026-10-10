import type { BisEquipmentItem } from '@bis/integration';
import type { TestNetwork } from '@bis/integration';

export type MarketplaceInventoryRole = 'player' | 'game';
export type MarketplaceInventoryStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'unavailable';
export type MarketplaceInventoryRecord = Readonly<{
  role: MarketplaceInventoryRole;
  walletId?: string;
  network?: TestNetwork;
  status: MarketplaceInventoryStatus;
  items: readonly BisEquipmentItem[];
  fetchedAt?: number;
  error?: string;
}>;
export type MarketplaceInventorySource = Readonly<{
  role: MarketplaceInventoryRole;
  walletId: string;
  network: TestNetwork;
  read(): Promise<readonly BisEquipmentItem[]>;
}>;

export const MARKETPLACE_INVENTORY_CACHE_TTL_MS = 30_000;
const cachePrefix = 'bis-marketplace-inventory-v1:';
const maxCacheBytes = 128 * 1024;
const emptyRecord = (role: MarketplaceInventoryRole): MarketplaceInventoryRecord => Object.freeze({ role, status: 'idle', items: Object.freeze([]) });
const initialState = Object.freeze({ player: emptyRecord('player'), game: emptyRecord('game') });

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type CacheEnvelope = Readonly<{version: 1; role: MarketplaceInventoryRole; walletId: string; network: TestNetwork; fetchedAt: number; items: readonly BisEquipmentItem[]}>;

function storage(): StorageLike | undefined {
  try { return globalThis.localStorage; } catch { return undefined; }
}

function key(role: MarketplaceInventoryRole, walletId: string, network: TestNetwork) {
  return `${cachePrefix}${role}:${network}:${encodeURIComponent(walletId)}`;
}

function validItem(value: unknown): value is BisEquipmentItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  const allowed = new Set(['catalogId', 'name', 'ticker', 'family', 'tier', 'priceSats', 'description', 'attributeDeltas', 'iconUrl', 'assetId', 'quantity']);
  if (Object.keys(item).some(key => !allowed.has(key))) return false;
  if (!['Shoes', 'Dagger', 'Shield'].includes(String(item.family)) || ![1, 2, 3].includes(Number(item.tier))) return false;
  if (![item.catalogId, item.name, item.ticker, item.description, item.iconUrl, item.assetId, item.quantity].every(value => typeof value === 'string' && value.length > 0)) return false;
  if (!Number.isSafeInteger(item.priceSats) || Number(item.priceSats) <= 0) return false;
  if (!Array.isArray(item.attributeDeltas) || item.attributeDeltas.length === 0) return false;
  const seen = new Set<string>();
  for (const delta of item.attributeDeltas) {
    if (!delta || typeof delta !== 'object' || Array.isArray(delta)) return false;
    const entry = delta as Record<string, unknown>;
    if (typeof entry.bisAttribute !== 'string' || !Number.isSafeInteger(entry.bisAttributeDelta) || Number(entry.bisAttributeDelta) < -100 || Number(entry.bisAttributeDelta) > 100 || seen.has(entry.bisAttribute)) return false;
    seen.add(entry.bisAttribute);
  }
  try { return BigInt(String(item.quantity)) > 0n; } catch { return false; }
}

function freezeItem(item: BisEquipmentItem): BisEquipmentItem {
  return Object.freeze({ ...item, attributeDeltas: Object.freeze(item.attributeDeltas.map(delta => Object.freeze({ ...delta }))) });
}

export function readMarketplaceInventoryCache(role: MarketplaceInventoryRole, walletId: string, network: TestNetwork, now = Date.now(), store = storage()): MarketplaceInventoryRecord | undefined {
  if (!store) return undefined;
  try {
    const raw = store.getItem(key(role, walletId, network));
    if (!raw || raw.length > maxCacheBytes) return undefined;
    const envelope = JSON.parse(raw) as Partial<CacheEnvelope>;
    const fetchedAt = envelope.fetchedAt;
    if (envelope.version !== 1 || envelope.role !== role || envelope.walletId !== walletId || envelope.network !== network || typeof fetchedAt !== 'number' || !Number.isSafeInteger(fetchedAt) || now - fetchedAt < 0 || now - fetchedAt >= MARKETPLACE_INVENTORY_CACHE_TTL_MS || !Array.isArray(envelope.items) || !envelope.items.every(validItem)) return undefined;
    const items = Object.freeze(envelope.items.map(freezeItem));
    return Object.freeze({ role, walletId, network, status: items.length ? 'ready' : 'empty', items, fetchedAt });
  } catch { return undefined; }
}

export function writeMarketplaceInventoryCache(role: MarketplaceInventoryRole, walletId: string, network: TestNetwork, items: readonly BisEquipmentItem[], fetchedAt = Date.now(), store = storage()): void {
  if (!store || !items.every(validItem)) return;
  const envelope: CacheEnvelope = { version: 1, role, walletId, network, fetchedAt, items: items.map(freezeItem) };
  try {
    const raw = JSON.stringify(envelope);
    if (raw.length > maxCacheBytes) return;
    store.setItem(key(role, walletId, network), raw);
  } catch { /* Cache failure must never block live inventory. */ }
}

export function createMarketplaceInventoryCoordinator(options: {now?: () => number; store?: StorageLike} = {}) {
  const now = options.now ?? (() => Date.now());
  const store = options.store ?? storage();
  let state = initialState;
  let disposed = false;
  let sequence = { player: 0, game: 0 };
  const listeners = new Set<() => void>();
  const publish = (role: MarketplaceInventoryRole, next: MarketplaceInventoryRecord) => {
    if (disposed) return;
    state = Object.freeze({ ...state, [role]: Object.freeze(next) });
    listeners.forEach(listener => listener());
  };
  async function refresh(source: MarketplaceInventorySource, force = false) {
    const cached = force ? undefined : readMarketplaceInventoryCache(source.role, source.walletId, source.network, now(), store);
    if (cached) { publish(source.role, cached); return; }
    const request = ++sequence[source.role];
    publish(source.role, { role: source.role, walletId: source.walletId, network: source.network, status: 'loading', items: Object.freeze([]) });
    try {
      const items = Object.freeze((await source.read()).map(freezeItem));
      if (disposed || sequence[source.role] !== request) return;
      writeMarketplaceInventoryCache(source.role, source.walletId, source.network, items, now(), store);
      publish(source.role, { role: source.role, walletId: source.walletId, network: source.network, status: items.length ? 'ready' : 'empty', items, fetchedAt: now() });
    } catch {
      if (!disposed && sequence[source.role] === request) publish(source.role, { role: source.role, walletId: source.walletId, network: source.network, status: 'unavailable', items: Object.freeze([]), error: 'This wallet’s item inventory is unavailable. Try again.' });
    }
  }
  function clearMissing(sources: readonly MarketplaceInventorySource[]) {
    for (const role of ['player', 'game'] as const) if (!sources.some(source => source.role === role)) { sequence[role]++; publish(role, emptyRecord(role)); }
  }
  return {
    getState: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
    refresh(sources: readonly MarketplaceInventorySource[]) { clearMissing(sources); return Promise.all(sources.map(source => refresh(source))); },
    retry(source: MarketplaceInventorySource) { return refresh(source, true); },
    dispose() { disposed = true; sequence = { player: sequence.player + 1, game: sequence.game + 1 }; listeners.clear(); },
  };
}
