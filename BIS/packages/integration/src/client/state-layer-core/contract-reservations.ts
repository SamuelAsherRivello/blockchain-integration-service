import { contractResolved, type ContractRecord } from './contracts.ts';
import type { ContractDocument, ContractRecovery } from './contract-storage.ts';
import { operatorFor } from '../wallet-layer-arkade/account.ts';
import type { TestNetwork } from './test-network.ts';

export const contractReservationKey = 'bis-signet-contract-reservations-v1';
const reservationKey = (network: TestNetwork) => `bis-${network}-contract-reservations-v2`;
type Reservation = { id: string; playerId: string; gameId: string; pending: boolean; network?: TestNetwork; operator?: string; inputs?: {txid:string;vout:number}[]; transactionId?: string };
type StorageReader = Pick<Storage,'getItem'>;
export function readContractReservations(storage?: StorageReader): Reservation[];
export function readContractReservations(network?: TestNetwork, storage?: StorageReader): Reservation[];
export function readContractReservations(networkOrStorage: TestNetwork | StorageReader = 'signet', suppliedStorage?: StorageReader): Reservation[] {
  const network: TestNetwork = typeof networkOrStorage === 'string' ? networkOrStorage : 'signet';
  const storage = typeof networkOrStorage === 'string' ? (suppliedStorage ?? globalThis.localStorage) : networkOrStorage;
  if (!storage) return [];
  const current = storage.getItem(reservationKey(network));
  const legacy = network === 'signet' ? storage.getItem(contractReservationKey) : null;
  if (current === null && legacy === null) return [];
  const records: Reservation[] = [];
  const seen = new Set<string>();
  for (const raw of [current,legacy]) {
    if (raw === null) continue;
    try {
      const data = JSON.parse(raw);
    if (data.version !== 1 || !Array.isArray(data.contracts)) throw Error();
    const sourceSeen = new Set<string>();
    for (const record of data.contracts) {
      if (!record || ![record.id,record.playerId,record.gameId].every(value=>typeof value==='string'&&value.length>0) || typeof record.pending !== 'boolean' || sourceSeen.has(record.id) ||
        (record.network !== undefined && record.network !== network) || (record.operator !== undefined && record.operator !== operatorFor(network)) ||
        (record.inputs !== undefined && (!Array.isArray(record.inputs) || record.inputs.some((i:{txid:string;vout:number})=>!/^[a-f0-9]{64}$/i.test(i.txid)||!Number.isSafeInteger(i.vout)||i.vout<0))) ||
        (record.transactionId !== undefined && !/^[a-f0-9]{64}$/i.test(record.transactionId))) throw Error();
      sourceSeen.add(record.id);
      if (!seen.has(record.id)) { seen.add(record.id); records.push(record); }
    }
    } catch { throw Error('Contract reservations could not be verified.'); }
  }
  return records;
}
function entry(record: ContractRecord, recovery: ContractRecovery): Reservation {
  const inputs = record.operation.kind === 'fund' && !contractResolved(record) && record.financial !== 'funded'
    ? recovery.spend?.inputs : recovery.fundingOutput ? [recovery.fundingOutput] : undefined;
  return { id:record.id,playerId:record.scope.playerId,gameId:record.scope.gameId,pending:!contractResolved(record),network:record.scope.network as TestNetwork,operator:record.scope.operator,
    ...(inputs ? {inputs:inputs.map(({txid,vout})=>({txid,vout}))} : {}), ...(recovery.spend ? {transactionId:recovery.spend.transactionId} : {}) };
}
function write(records: Reservation[], network: TestNetwork, storage: Storage) {
  const raw = JSON.stringify({version:1,contracts:records});
  const key = reservationKey(network);
  storage.setItem(key,raw);
  if (storage.getItem(key) !== raw) throw Error('Contract reservations could not be saved.');
}
/** Reserve conservatively before the encrypted commit; failures may block, never free, inputs. */
export function reserveContract(record: ContractRecord, recovery: ContractRecovery, storage: Storage = localStorage) {
  if (contractResolved(record)) return;
  const network = record.scope.network as TestNetwork;
  const records = (()=>{try{return readContractReservations(network,storage);}catch{return [];}})(), next = entry(record,recovery);
  write([...records.filter(r=>r.id!==record.id),next],network,storage);
}
/** Release only after the encrypted document has committed verified terminal evidence. */
export function publishContractReservations(document: ContractDocument, storage: Storage = localStorage) {
  const network = (document.ledger.contracts.find(record=>record.scope.network)?.scope.network ?? 'signet') as TestNetwork;
  const existing = (()=>{try{return readContractReservations(network,storage);}catch{return [];}})();
  const records = document.ledger.contracts.filter(record=>record.scope.network===network&&record.scope.operator===operatorFor(network)).map(record=>entry(record,document.recovery[record.id]));
  // A shadow entry missing from recovery is an interrupted write. Keep it reserved.
  write([...existing.filter(old=>!records.some(record=>record.id===old.id)),...records],network,storage);
}
