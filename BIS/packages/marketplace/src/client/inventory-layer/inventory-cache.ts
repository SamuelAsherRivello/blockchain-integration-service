import type { BisEquipmentItem, TestNetwork } from '@bis/integration';
export type MarketplaceInventoryRole = 'player' | 'game';
export type MarketplaceInventoryStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'unavailable' | 'invalid-metadata' | 'migration-required';
export type MarketplaceInventoryRead = Readonly<{ items: readonly BisEquipmentItem[]; invalidMetadataCount?: number; migrationRequiredCount?: number }>;
export type MarketplaceInventoryRecord = Readonly<{ role: MarketplaceInventoryRole; walletId?: string; network?: TestNetwork; status: MarketplaceInventoryStatus; items: readonly BisEquipmentItem[]; invalidMetadataCount: number; migrationRequiredCount: number; fetchedAt?: number; error?: string }>;
export type MarketplaceInventorySource = Readonly<{ role: MarketplaceInventoryRole; walletId: string; network: TestNetwork; read(force?: boolean): Promise<readonly BisEquipmentItem[] | MarketplaceInventoryRead> }>;
const DEFAULT_READ_TIMEOUT_MS = 35000;
async function readWithTimeout<T>(read: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      read,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('Marketplace inventory read timed out.')), timeoutMs); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
const emptyRecord = (role: MarketplaceInventoryRole): MarketplaceInventoryRecord => Object.freeze({ role, status: 'idle', items: Object.freeze([]), invalidMetadataCount: 0, migrationRequiredCount: 0 });
const initialState = Object.freeze({ player: emptyRecord('player'), game: emptyRecord('game') });
const freezeItem = (item: BisEquipmentItem): BisEquipmentItem => Object.freeze({ ...item, attributeDeltas: Object.freeze(item.attributeDeltas.map(delta => Object.freeze({ ...delta }))) });
/** Marketplace-owned view state only. Inventory data and caching belong to BIS. */
export function createMarketplaceInventoryCoordinator(options: Readonly<{ readTimeoutMs?: number }> = {}) {
  const readTimeoutMs = Number.isFinite(options.readTimeoutMs) && (options.readTimeoutMs ?? 0) > 0
    ? options.readTimeoutMs!
    : DEFAULT_READ_TIMEOUT_MS;
  let state = initialState, disposed = false, sequence = { player: 0, game: 0 };
  const listeners = new Set<() => void>();
  const inFlight = new Map<MarketplaceInventoryRole, {walletId:string;network:TestNetwork;force:boolean;work:Promise<void>}>();
  const publish = (role: MarketplaceInventoryRole, next: MarketplaceInventoryRecord) => { if (disposed) return; state = Object.freeze({ ...state, [role]: Object.freeze(next) }); listeners.forEach(listener => listener()); };
  async function run(source: MarketplaceInventorySource, force: boolean) {
    const request = ++sequence[source.role], previous = state[source.role];
    const retainedItems = previous.walletId === source.walletId && previous.network === source.network ? previous.items : Object.freeze([]);
    publish(source.role, { role: source.role, walletId: source.walletId, network: source.network, status: 'loading', items: retainedItems, invalidMetadataCount: previous.invalidMetadataCount, migrationRequiredCount: previous.migrationRequiredCount });
    try {
      const read = await readWithTimeout(source.read(force), readTimeoutMs);
      const result: MarketplaceInventoryRead = Array.isArray(read) ? { items: read as readonly BisEquipmentItem[] } : read as MarketplaceInventoryRead;
      const items = Object.freeze(result.items.map(freezeItem));
      const invalidMetadataCount = result.invalidMetadataCount ?? 0;
      const migrationRequiredCount = result.migrationRequiredCount ?? 0;
      if (disposed || sequence[source.role] !== request) return;
      const status = items.length ? 'ready' : migrationRequiredCount ? 'migration-required' : invalidMetadataCount ? 'invalid-metadata' : 'empty';
      publish(source.role, { role: source.role, walletId: source.walletId, network: source.network, status, items, invalidMetadataCount, migrationRequiredCount, fetchedAt: Date.now() });
    }
    catch { if (!disposed && sequence[source.role] === request) publish(source.role, { role: source.role, walletId: source.walletId, network: source.network, status: 'unavailable', items: Object.freeze([]), invalidMetadataCount: 0, migrationRequiredCount: 0, error: 'This wallet’s item inventory is unavailable. Try again.' }); }
  }
  function refresh(source: MarketplaceInventorySource, force = false) {
    const active=inFlight.get(source.role);
    if(active?.walletId===source.walletId&&active.network===source.network&&(!force||active.force))return active.work;
    const request={walletId:source.walletId,network:source.network,force,work:Promise.resolve()};
    inFlight.set(source.role,request);
    request.work=run(source,force).finally(()=>{if(inFlight.get(source.role)===request)inFlight.delete(source.role);});
    return request.work;
  }
  function clearMissing(sources: readonly MarketplaceInventorySource[]) { for (const role of ['player', 'game'] as const) if (!sources.some(source => source.role === role)) { sequence[role]++; inFlight.delete(role); publish(role, emptyRecord(role)); } }
  return { getState: () => state, subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); }, refresh(sources: readonly MarketplaceInventorySource[], force = false) { clearMissing(sources); return Promise.all(sources.map(source => refresh(source,force))); }, retry(source: MarketplaceInventorySource) { return refresh(source,true); }, dispose() { disposed = true; sequence = { player: sequence.player + 1, game: sequence.game + 1 }; listeners.clear(); } };
}
