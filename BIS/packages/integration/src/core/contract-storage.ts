import { ContractError, contractResolved, emptyContractLedger, validateContractLedger, type ContractLedger } from './contracts.ts';

export type ContractOutpoint = Readonly<{ txid: string; vout: number; value: number }>;
export type ContractSpend = Readonly<{
  operationId: string; transactionId: string; inputs: readonly ContractOutpoint[];
  destinationScript: string; amountSats: number; change?: Readonly<{ script: string; value: number; assets?: readonly {assetId:string;amount:string}[] }>;
}>;
/** Private recovery material never leaves the integration package's storage/adapter boundary. */
export type ContractRecovery = Readonly<{
  secretHex: string; playerKey: string; gameKey: string; operatorKey: string; exitDelay: string;
  gameScript: string; playerScript: string; contractScript: string;
  fundingOutput?: ContractOutpoint; spend?: ContractSpend;
  finalization?: Readonly<{ transactionId: string; checkpoints: readonly string[] }>;
}>;
export type ContractDocument = Readonly<{
  version: 1; revision: number; ledger: ContractLedger; recovery: Readonly<Record<string, ContractRecovery>>;
}>;
type Envelope = { version: 1; revision: number; key: CryptoKey; iv: Uint8Array<ArrayBuffer>; encrypted: ArrayBuffer };
export interface ContractBackend {
  read(): Promise<Envelope | undefined>;
  /** Atomic compare-and-swap: reject if persisted revision differs. */
  write(envelope: Envelope, previousRevision: number): Promise<void>;
}
const database = 'bis-contract-recovery-signet-v1';
const fail = () => new ContractError('Contract recovery data could not be verified. Existing offers remain reserved.');
const hex = (value: unknown) => typeof value === 'string' && /^(?:[a-f0-9]{2})+$/i.test(value);
const keyHex = (value: unknown) => hex(value) && (value as string).length === 64;
function outpoint(value: ContractOutpoint) {
  return value && keyHex(value.txid) && Number.isSafeInteger(value.vout) && value.vout >= 0 && Number.isSafeInteger(value.value) && value.value > 0;
}
function validate(value: unknown): asserts value is ContractDocument {
  const document = value as ContractDocument;
  if (!document || document.version !== 1 || !Number.isSafeInteger(document.revision) || document.revision < 0 || !document.recovery || typeof document.recovery !== 'object' || Array.isArray(document.recovery)) throw fail();
  validateContractLedger(document.ledger);
  for (const contract of document.ledger.contracts) {
    const r = document.recovery[contract.id];
    if (!r || ![r.secretHex,r.playerKey,r.gameKey,r.operatorKey].every(keyHex) || ![r.gameScript,r.playerScript,r.contractScript].every(hex) || !/^[1-9][0-9]{0,19}$/.test(r.exitDelay)) throw fail();
    if (r.fundingOutput && !outpoint(r.fundingOutput)) throw fail();
    if (r.finalization && (!r.spend || r.finalization.transactionId!==r.spend.transactionId || !Array.isArray(r.finalization.checkpoints) || !r.finalization.checkpoints.length || r.finalization.checkpoints.some(value=>typeof value!=='string'||value.length>1000000||!/^[A-Za-z0-9+/]+={0,2}$/.test(value)))) throw fail();
    if (r.spend) {
      const s = r.spend;
      if (s.operationId !== contract.operation.id || !keyHex(s.transactionId) || !Array.isArray(s.inputs) || !s.inputs.length || !s.inputs.every(outpoint) ||
        !hex(s.destinationScript) || !Number.isSafeInteger(s.amountSats) || s.amountSats !== contract.amountSats ||
        (s.change && (!hex(s.change.script) || !Number.isSafeInteger(s.change.value) || s.change.value <= 0))) throw fail();
      if (new Set(s.inputs.map(input => `${input.txid}:${input.vout}`)).size !== s.inputs.length || s.inputs.reduce((sum,input) => sum + input.value, 0) !== s.amountSats + (s.change?.value ?? 0)) throw fail();
      if(s.change?.assets && (!Array.isArray(s.change.assets)||!s.change.assets.length||s.change.assets.some(a=>!a||!/^[a-f0-9]{68}$/.test(a.assetId)||typeof a.amount!=='string'||!/^[1-9][0-9]*$/.test(a.amount))||new Set(s.change.assets.map(a=>a.assetId)).size!==s.change.assets.length))throw fail();
    }
  }
  if (Object.keys(document.recovery).some(id => !document.ledger.contracts.some(contract => contract.id === id))) throw fail();
}
const aad = (revision: number) => new TextEncoder().encode(`${database}:${revision}`);

export function advanceContractDocument(previous: ContractDocument, document: ContractDocument): ContractDocument {
  validate(previous); validate(document);
  if (previous.revision !== document.revision) throw fail();
  // Updates are additive. Older accounts, attempts and recovery records are retained.
  for (const old of previous.ledger.contracts) {
    const next = document.ledger.contracts.find(record => record.id === old.id);
    if (!next || next.startedAt !== old.startedAt || next.expiresAt !== old.expiresAt || next.amountSats !== old.amountSats || next.sessionId !== old.sessionId ||
      JSON.stringify(next.scope) !== JSON.stringify(old.scope) || next.purpose !== old.purpose || next.hostReference !== old.hostReference) throw fail();
    if (contractResolved(old) && JSON.stringify(next) !== JSON.stringify(old)) throw fail();
    if (old.ended && next.ended !== old.ended) throw fail();
    const before=previous.recovery[old.id], after=document.recovery[old.id];
    for (const field of ['secretHex','playerKey','gameKey','operatorKey','exitDelay','gameScript','playerScript','contractScript'] as const) {
      if (before[field] !== after[field]) throw fail();
    }
    if (before.fundingOutput && JSON.stringify(before.fundingOutput)!==JSON.stringify(after.fundingOutput)) throw fail();
    if (old.operation.id === next.operation.id && before.spend && JSON.stringify(before.spend)!==JSON.stringify(after.spend)) throw fail();
    if (old.operation.id === next.operation.id && before.finalization && JSON.stringify(before.finalization)!==JSON.stringify(after.finalization)) throw fail();
  }
  for (const attempt of previous.ledger.attempts) if (!document.ledger.attempts.some(next => JSON.stringify(next) === JSON.stringify(attempt))) throw fail();
  const next: ContractDocument = { ...document, revision: document.revision + 1 };
  return next;
}

export function createContractStorage(backend: ContractBackend = indexedContractBackend()) {
  async function load(): Promise<ContractDocument> {
    try {
      const envelope = await backend.read();
      if (!envelope) return { version: 1, revision: 0, ledger: emptyContractLedger(), recovery: {} };
      if (envelope.version !== 1 || !Number.isSafeInteger(envelope.revision) || envelope.revision < 1 || !(envelope.key instanceof CryptoKey) || envelope.key.extractable) throw fail();
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: envelope.iv, additionalData: aad(envelope.revision) }, envelope.key, envelope.encrypted);
      const document: unknown = JSON.parse(new TextDecoder().decode(plain));
      validate(document);
      if (document.revision !== envelope.revision) throw fail();
      return document;
    } catch { throw fail(); }
  }
  return {
    load,
    async save(document: ContractDocument): Promise<ContractDocument> {
      try {
        validate(document);
        const previous = await load();
        if (previous.revision !== document.revision) throw fail();
        const next = advanceContractDocument(previous, document);
        const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt','decrypt']);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(next.revision) }, key, new TextEncoder().encode(JSON.stringify(next)));
        await backend.write({ version: 1, revision: next.revision, key, iv, encrypted }, document.revision);
        return next;
      } catch { throw fail(); }
    },
  };
}

function indexedContractBackend(): ContractBackend {
  async function transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore, set: (value: T) => void, abort: () => void) => void): Promise<T> {
    const db = await new Promise<IDBDatabase>((resolve,reject) => {
      const request = indexedDB.open(database, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('recovery');
      request.onerror = request.onblocked = () => reject(fail());
      request.onsuccess = () => resolve(request.result);
    });
    return new Promise((resolve,reject) => {
      let result: T;
      const tx = db.transaction('recovery', mode);
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onerror = tx.onabort = () => { db.close(); reject(fail()); };
      try { run(tx.objectStore('recovery'), value => { result = value; }, () => tx.abort()); } catch { tx.abort(); }
    });
  }
  return {
    read: () => transaction<Envelope | undefined>('readonly', (store,set) => { const request = store.get('current'); request.onsuccess = () => set(request.result); }),
    write: (envelope, previousRevision) => transaction<void>('readwrite', (store,set,abort) => {
      const request = store.get('current');
      request.onsuccess = () => {
        if ((request.result?.revision ?? 0) !== previousRevision) { abort(); return; }
        store.put(envelope, 'current'); set(undefined);
      };
    }),
  };
}
