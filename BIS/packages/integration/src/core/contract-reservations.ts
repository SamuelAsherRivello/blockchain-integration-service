import { contractResolved, type ContractRecord } from './contracts.ts';
import type { ContractDocument, ContractRecovery } from './contract-storage.ts';

export const contractReservationKey = 'bis-signet-contract-reservations-v1';
type Reservation = { id: string; playerId: string; gameId: string; pending: boolean; inputs?: {txid:string;vout:number}[]; transactionId?: string };
type StorageReader = Pick<Storage,'getItem'>;
export function readContractReservations(storage: StorageReader | undefined = globalThis.localStorage): Reservation[] {
  if (!storage) return [];
  const raw = storage.getItem(contractReservationKey); if (raw === null) return [];
  try {
    const data = JSON.parse(raw);
    if (data.version !== 1 || !Array.isArray(data.contracts)) throw Error();
    const seen = new Set<string>();
    for (const record of data.contracts) {
      if (!record || ![record.id,record.playerId,record.gameId].every(value=>typeof value==='string'&&value.length>0) || typeof record.pending !== 'boolean' || seen.has(record.id) ||
        (record.inputs !== undefined && (!Array.isArray(record.inputs) || record.inputs.some((i:{txid:string;vout:number})=>!/^[a-f0-9]{64}$/i.test(i.txid)||!Number.isSafeInteger(i.vout)||i.vout<0))) ||
        (record.transactionId !== undefined && !/^[a-f0-9]{64}$/i.test(record.transactionId))) throw Error();
      seen.add(record.id);
    }
    return data.contracts;
  } catch { throw Error('Contract reservations could not be verified.'); }
}
function entry(record: ContractRecord, recovery: ContractRecovery): Reservation {
  const inputs = record.operation.kind === 'fund' && !contractResolved(record) && record.financial !== 'funded'
    ? recovery.spend?.inputs : recovery.fundingOutput ? [recovery.fundingOutput] : undefined;
  return { id:record.id,playerId:record.scope.playerId,gameId:record.scope.gameId,pending:!contractResolved(record),
    ...(inputs ? {inputs:inputs.map(({txid,vout})=>({txid,vout}))} : {}), ...(recovery.spend ? {transactionId:recovery.spend.transactionId} : {}) };
}
function write(records: Reservation[], storage: Storage) {
  const raw = JSON.stringify({version:1,contracts:records});
  storage.setItem(contractReservationKey,raw);
  if (storage.getItem(contractReservationKey) !== raw) throw Error('Contract reservations could not be saved.');
}
/** Reserve conservatively before the encrypted commit; failures may block, never free, inputs. */
export function reserveContract(record: ContractRecord, recovery: ContractRecovery, storage: Storage = localStorage) {
  if (contractResolved(record)) return;
  const records = readContractReservations(storage), next = entry(record,recovery);
  write([...records.filter(r=>r.id!==record.id),next],storage);
}
/** Release only after the encrypted document has committed verified terminal evidence. */
export function publishContractReservations(document: ContractDocument, storage: Storage = localStorage) {
  const existing = readContractReservations(storage);
  const records = document.ledger.contracts.map(record=>entry(record,document.recovery[record.id]));
  // A shadow entry missing from recovery is an interrupted write. Keep it reserved.
  write([...existing.filter(old=>!records.some(record=>record.id===old.id)),...records],storage);
}
