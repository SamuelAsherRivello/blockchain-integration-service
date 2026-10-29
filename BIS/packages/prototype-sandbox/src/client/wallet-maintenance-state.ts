/** Public receipts only. No signer, proof, nonce or recovery material belongs here. */
export type MaintenanceAsset = { assetId: string; amount: string };
export type MaintenanceInput = { txid: string; vout: number; value: number; virtual: boolean; assets: MaintenanceAsset[] };
export type MaintenanceOutput = { script: string; amount: string; offchain: boolean };
export type MaintenanceRecord = {
  id: string;
  createdAt: number;
  state: 'pending' | 'settled' | 'not-submitted' | 'failed';
  attempted: boolean;
  inputs: MaintenanceInput[];
  outputs: MaintenanceOutput[];
  commitmentTxid?: string;
  intentHash?: string;
  batchId?: string;
};
export const maintenanceTxid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const natural = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const decimal = (value: unknown) => typeof value === 'string' && /^\d{1,30}$/.test(value);

export function maintenanceAssets(inputs: { assets?: MaintenanceAsset[] }[]) {
  const totals = new Map<string, bigint>();
  for (const input of inputs) for (const asset of input.assets ?? []) {
    if (!/^[a-f0-9]{68}$/.test(asset.assetId) || !decimal(String(asset.amount))) throw new Error('Wallet asset inventory could not be verified.');
    totals.set(asset.assetId, (totals.get(asset.assetId) ?? 0n) + BigInt(asset.amount));
  }
  return [...totals].filter(([, amount]) => amount > 0n).sort(([a], [b]) => a.localeCompare(b)).map(([assetId, amount]) => ({ assetId, amount: String(amount) }));
}

function validRecord(r: MaintenanceRecord) {
  return r && typeof r.id === 'string' && /^[a-z0-9-]{1,100}$/.test(r.id) && natural(r.createdAt)
    && ['pending', 'settled', 'not-submitted', 'failed'].includes(r.state) && typeof r.attempted === 'boolean'
    && (r.commitmentTxid === undefined || maintenanceTxid(r.commitmentTxid))
    && (r.intentHash === undefined || maintenanceTxid(r.intentHash))
    && (r.batchId === undefined || typeof r.batchId === 'string' && /^[a-zA-Z0-9:_-]{1,300}$/.test(r.batchId))
    && Array.isArray(r.inputs) && r.inputs.length > 0 && r.inputs.length <= 1000
    && r.inputs.every(c => maintenanceTxid(c.txid) && natural(c.vout) && natural(c.value) && typeof c.virtual === 'boolean' && Array.isArray(c.assets))
    && Array.isArray(r.outputs) && r.outputs.length > 0 && r.outputs.length <= 1000
    && r.outputs.every(o => typeof o.script === 'string' && /^(?:[a-f0-9]{2}){1,10000}$/.test(o.script) && decimal(o.amount) && typeof o.offchain === 'boolean');
}

export function maintenanceJournal(scope: string, storage: Pick<Storage, 'getItem' | 'setItem'> = globalThis.localStorage) {
  if (!/^[a-f0-9]{64}$/.test(scope)) throw new Error('Wallet identity could not be verified.');
  const key = `bis-sandbox-maintenance-v1:${scope}`;
  const read = (): MaintenanceRecord[] => {
    const raw = storage.getItem(key);
    if (raw === null) return [];
    if (raw.length > 4_000_000) throw new Error('Wallet maintenance history is unavailable.');
    const rows = JSON.parse(raw);
    if (!Array.isArray(rows) || rows.length > 5000 || !rows.every(validRecord) || new Set(rows.map(r => r.id)).size !== rows.length) throw new Error('Wallet maintenance history is unavailable.');
    rows.forEach(r => maintenanceAssets(r.inputs));
    return rows;
  };
  return {
    read,
    pending: () => read().filter(r => r.state === 'pending'),
    save(record: MaintenanceRecord) {
      if (!validRecord(record)) throw new Error('Settlement details could not be verified.');
      maintenanceAssets(record.inputs);
      const rows = read();
      const index = rows.findIndex(r => r.id === record.id);
      if (index < 0) rows.push(record); else rows[index] = record;
      if (rows.length > 5000) throw new Error('Wallet maintenance history is full.');
      storage.setItem(key, JSON.stringify(rows));
    },
  };
}

export async function maintenanceLock<T>(scope: string, work: () => Promise<T>, locks = globalThis.navigator?.locks): Promise<T> {
  if (!locks) throw new Error('This browser cannot lock wallet operations safely.');
  return locks.request(`bis-sandbox-wallet-v1:${scope}`, { ifAvailable: true }, async lock => {
    if (!lock) throw new Error('Wallet is busy. Try again when its current operation finishes.');
    return work();
  });
}
