import type { BisEquipmentItem, TestNetwork } from '@bis/integration';
export type MarketplaceInventoryRole = 'player' | 'game';
export type MarketplaceInventoryStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'unavailable';
export type MarketplaceInventoryRecord = Readonly<{ role: MarketplaceInventoryRole; walletId?: string; network?: TestNetwork; status: MarketplaceInventoryStatus; items: readonly BisEquipmentItem[]; fetchedAt?: number; error?: string }>;
export type MarketplaceInventorySource = Readonly<{ role: MarketplaceInventoryRole; walletId: string; network: TestNetwork; read(): Promise<readonly BisEquipmentItem[]> }>;
const emptyRecord = (role: MarketplaceInventoryRole): MarketplaceInventoryRecord => Object.freeze({ role, status: 'idle', items: Object.freeze([]) });
const initialState = Object.freeze({ player: emptyRecord('player'), game: emptyRecord('game') });
const freezeItem = (item: BisEquipmentItem): BisEquipmentItem => Object.freeze({ ...item, attributeDeltas: Object.freeze(item.attributeDeltas.map(delta => Object.freeze({ ...delta }))) });
/** Marketplace-owned view state only. Inventory data and caching belong to BIS. */
export function createMarketplaceInventoryCoordinator() {
  let state = initialState, disposed = false, sequence = { player: 0, game: 0 };
  const listeners = new Set<() => void>();
  const publish = (role: MarketplaceInventoryRole, next: MarketplaceInventoryRecord) => { if (disposed) return; state = Object.freeze({ ...state, [role]: Object.freeze(next) }); listeners.forEach(listener => listener()); };
  async function refresh(source: MarketplaceInventorySource) {
    const request = ++sequence[source.role], previous = state[source.role];
    const retainedItems = previous.walletId === source.walletId && previous.network === source.network ? previous.items : Object.freeze([]);
    publish(source.role, { role: source.role, walletId: source.walletId, network: source.network, status: 'loading', items: retainedItems, ...(previous.error ? { error: previous.error } : {}) });
    try { const items = Object.freeze((await source.read()).map(freezeItem)); if (disposed || sequence[source.role] !== request) return; publish(source.role, { role: source.role, walletId: source.walletId, network: source.network, status: items.length ? 'ready' : 'empty', items, fetchedAt: Date.now() }); }
    catch { if (!disposed && sequence[source.role] === request) publish(source.role, { role: source.role, walletId: source.walletId, network: source.network, status: 'unavailable', items: Object.freeze([]), error: 'This wallet’s item inventory is unavailable. Try again.' }); }
  }
  function clearMissing(sources: readonly MarketplaceInventorySource[]) { for (const role of ['player', 'game'] as const) if (!sources.some(source => source.role === role)) { sequence[role]++; publish(role, emptyRecord(role)); } }
  return { getState: () => state, subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); }, refresh(sources: readonly MarketplaceInventorySource[]) { clearMissing(sources); return Promise.all(sources.map(source => refresh(source))); }, retry(source: MarketplaceInventorySource) { return refresh(source); }, dispose() { disposed = true; sequence = { player: sequence.player + 1, game: sequence.game + 1 }; listeners.clear(); } };
}
