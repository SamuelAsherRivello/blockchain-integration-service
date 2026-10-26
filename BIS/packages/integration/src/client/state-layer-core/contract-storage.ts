import { ContractError, contractResolved, emptyContractLedger, validateContractLedger, type ContractLedger } from './contracts.ts';
import type { TestNetwork } from './test-network.ts';
import {validateTreasureStageRecovery,advanceTreasureStageRecovery,type TreasureStageRecovery} from './treasure-staged-recovery.ts';
import {validateTreasureServerRecovery,advanceTreasureServerRecovery,treasureServerRecoveryPending,type TreasureServerJournals} from './treasure-server-recovery.ts';

export type ContractOutpoint = Readonly<{ txid: string; vout: number; value: number }>;
export type ContractSpend = Readonly<{
  operationId: string; transactionId: string; inputs: readonly ContractOutpoint[];
  destinationScript: string; amountSats: number; change?: Readonly<{ script: string; value: number; assets?: readonly {assetId:string;amount:string}[] }>;
}>;
/** Private recovery material never leaves the integration package's storage/adapter boundary. */
export type ContractRecovery = Readonly<{
  secretHex?: string; playerKey: string; gameKey: string; operatorKey: string; exitDelay: string;
  treasure?: import('../wallet-layer-arkade/treasure-script.ts').TreasureScriptTerms;
  /** Allocated before funding. Absence retains the immutable original v2 artifact. */
  treasureArtifactVersion?: 3|4;
  /** Exact private spend stages, persisted before each external request. */
  treasureStage?: TreasureStageRecovery;
  /** Private per-operation signing journals. Historical originals are retained. */
  treasureServerJournals?: TreasureServerJournals;
  emulatorSubmission?: Readonly<{transactionId:string;arkTx:string;checkpoints:readonly string[]}>;
  submission?: Readonly<{transactionId:string;arkTx:string;checkpoints:readonly string[]}>;
  /** Private historical bytes, never interpreted as a signing/replay instruction. */
  observedPrevious?: string;
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
const fail = () => new ContractError('Contract recovery data could not be verified. Existing offers remain reserved.');
const hex = (value: unknown) => typeof value === 'string' && /^(?:[a-f0-9]{2})+$/i.test(value);
const keyHex = (value: unknown) => hex(value) && (value as string).length === 64;
function outpoint(value: ContractOutpoint) {
  return value && keyHex(value.txid) && Number.isSafeInteger(value.vout) && value.vout >= 0 && Number.isSafeInteger(value.value) && value.value > 0;
}
export function validateContractDocument(value: unknown): asserts value is ContractDocument {
  const document = value as ContractDocument;
  if (!document || document.version !== 1 || !Number.isSafeInteger(document.revision) || document.revision < 0 || !document.recovery || typeof document.recovery !== 'object' || Array.isArray(document.recovery)) throw fail();
  validateContractLedger(document.ledger);
  for (const contract of document.ledger.contracts) {
    const r = document.recovery[contract.id];
    if(r?.observedPrevious!==undefined&&(typeof r.observedPrevious!=='string'||r.observedPrevious.length>4000000||
      !JSON.parse(r.observedPrevious)?.operation))throw fail();
    if (!r || ![r.playerKey,r.gameKey,r.operatorKey].every(keyHex) || (!r.treasure&&!keyHex(r.secretHex)) || ![r.gameScript,r.playerScript,r.contractScript].every(hex) || !/^[1-9][0-9]{0,19}$/.test(r.exitDelay)) throw fail();
    if(r.treasure){
      const t=r.treasure;
      if(contract.validationMode!=='arkade-covenant-v2'||contract.amountSats!==1000||t.network!==contract.scope.network||
        t.offerSessionId!==contract.sessionId||t.hostReference!==contract.hostReference||t.startedAtMs!==contract.startedAt||
        (Math.floor(t.startedAtMs/1000)+90)*1000!==contract.expiresAt||t.player!==r.playerKey||t.game!==r.gameKey||t.operator!==r.operatorKey||
        ![t.emulator,t.playerDestination,t.gameDestination].every(keyHex)||String(t.exitDelay)!==r.exitDelay||r.secretHex!==undefined)throw fail();
    }else if(contract.validationMode==='arkade-covenant-v2')throw fail();
    validateTreasureStageRecovery(contract,r);
    validateTreasureServerRecovery(contract,r);
    if(r.emulatorSubmission&&(!r.treasure||!r.spend||r.emulatorSubmission.transactionId!==r.spend.transactionId||
      ![r.emulatorSubmission.arkTx,...r.emulatorSubmission.checkpoints].every(value=>typeof value==='string'&&value.length<=1000000&&/^[A-Za-z0-9+/]+={0,2}$/.test(value))||r.emulatorSubmission.checkpoints.length!==1))throw fail();
    if (r.fundingOutput && !outpoint(r.fundingOutput)) throw fail();
    if(r.submission&&(!r.spend||r.submission.transactionId!==r.spend.transactionId||
      !Array.isArray(r.submission.checkpoints)||!r.submission.checkpoints.length||
      ![r.submission.arkTx,...r.submission.checkpoints].every(value=>typeof value==='string'&&value.length<=1000000&&/^[A-Za-z0-9+/]+={0,2}$/.test(value))))throw fail();
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
function validate(value:unknown):asserts value is ContractDocument { validateContractDocument(value); }

export function advanceContractDocument(previous: ContractDocument, document: ContractDocument): ContractDocument {
  validate(previous); validate(document);
  if (previous.revision !== document.revision) throw fail();
  let serverJournalChanges=0;
  // Updates are additive. Older accounts, attempts and recovery records are retained.
  for (const old of previous.ledger.contracts) {
    const next = document.ledger.contracts.find(record => record.id === old.id);
    if (!next || next.startedAt !== old.startedAt || next.expiresAt !== old.expiresAt || next.amountSats !== old.amountSats || next.sessionId !== old.sessionId ||
      JSON.stringify(next.scope) !== JSON.stringify(old.scope) || next.purpose !== old.purpose || next.hostReference !== old.hostReference||next.validationMode!==old.validationMode) throw fail();
    if (contractResolved(old) && JSON.stringify(next) !== JSON.stringify(old)) throw fail();
    if (old.ended && next.ended !== old.ended) throw fail();
    const before=previous.recovery[old.id], after=document.recovery[old.id];
    advanceTreasureStageRecovery(old,next,before,after);
    serverJournalChanges+=advanceTreasureServerRecovery(old,next,before,after);
    if(before.observedPrevious!==undefined&&before.observedPrevious!==after.observedPrevious)throw fail();
    if(JSON.stringify(before.treasure)!==JSON.stringify(after.treasure))throw fail();
    if(old.operation.id===next.operation.id&&before.emulatorSubmission&&JSON.stringify(before.emulatorSubmission)!==JSON.stringify(after.emulatorSubmission))throw fail();
    if(old.operation.id===next.operation.id&&before.submission&&JSON.stringify(before.submission)!==JSON.stringify(after.submission))throw fail();
    for (const field of ['secretHex','playerKey','gameKey','operatorKey','exitDelay','gameScript','playerScript','contractScript'] as const) {
      if (before[field] !== after[field]) throw fail();
    }
    if (before.fundingOutput && JSON.stringify(before.fundingOutput)!==JSON.stringify(after.fundingOutput)) throw fail();
    if (old.operation.id === next.operation.id && before.spend && JSON.stringify(before.spend)!==JSON.stringify(after.spend)) throw fail();
    if (old.operation.id === next.operation.id && before.finalization && JSON.stringify(before.finalization)!==JSON.stringify(after.finalization)) throw fail();
  }
  for(const record of document.ledger.contracts)if(!previous.ledger.contracts.some(old=>old.id===record.id)){
    // Import may retain several terminal histories for one slot. A new normal
    // allocation must not bypass those guards, even by clearing them in this CAS.
    if(!record.recoveryRequired&&[previous,document].some(snapshot=>snapshot.ledger.contracts.some(other=>
      other.id!==record.id&&other.scope.network===record.scope.network&&other.scope.operator===record.scope.operator&&
      other.scope.playerId===record.scope.playerId&&other.scope.gameId===record.scope.gameId&&other.scope.exclusivityKey===record.scope.exclusivityKey&&
      (!contractResolved(other)||treasureServerRecoveryPending(snapshot.recovery[other.id])))))throw fail();
    serverJournalChanges+=advanceTreasureServerRecovery(undefined,record,undefined,document.recovery[record.id]);
  }
  if(serverJournalChanges>1)throw fail();
  for (const attempt of previous.ledger.attempts) if (!document.ledger.attempts.some(next => JSON.stringify(next) === JSON.stringify(attempt))) throw fail();
  const next: ContractDocument = { ...document, revision: document.revision + 1 };
  return next;
}

export function createContractStorage(backend: ContractBackend | undefined = undefined, network: TestNetwork = 'signet') {
  const storageBackend = backend ?? indexedContractBackend(network);
  const additionalData = (revision: number) => new TextEncoder().encode(`bis-contract-recovery-${network}-v1:${revision}`);
  async function load(): Promise<ContractDocument> {
    try {
      const envelope = await storageBackend.read();
      if (!envelope) return { version: 1, revision: 0, ledger: emptyContractLedger(), recovery: {} };
      if (envelope.version !== 1 || !Number.isSafeInteger(envelope.revision) || envelope.revision < 1 || !(envelope.key instanceof CryptoKey) || envelope.key.extractable) throw fail();
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: envelope.iv, additionalData: additionalData(envelope.revision) }, envelope.key, envelope.encrypted);
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
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: additionalData(next.revision) }, key, new TextEncoder().encode(JSON.stringify(next)));
        await storageBackend.write({ version: 1, revision: next.revision, key, iv, encrypted }, document.revision);
        return next;
      } catch { throw fail(); }
    },
    async reset(): Promise<void> {
      try {
        const previous = await load();
        if(previous.ledger.contracts.some(record=>!contractResolved(record)||treasureServerRecoveryPending(previous.recovery[record.id])))throw fail();
        const next: ContractDocument = { version: 1, revision: previous.revision + 1, ledger: emptyContractLedger(), recovery: {} };
        const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt','decrypt']);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: additionalData(next.revision) }, key, new TextEncoder().encode(JSON.stringify(next)));
        await storageBackend.write({ version: 1, revision: next.revision, key, iv, encrypted }, previous.revision);
      } catch { throw fail(); }
    },
  };
}

export function createNetworkScopedContractStorage(selectedNetwork: () => TestNetwork | undefined) {
  const stores = new Map<TestNetwork, ReturnType<typeof createContractStorage>>();
  const current = () => {
    const network = selectedNetwork() ?? 'signet';
    let store = stores.get(network);
    if (!store) { store = createContractStorage(indexedContractBackend(network), network); stores.set(network, store); }
    return store;
  };
  return {load: () => current().load(), save: (document: ContractDocument) => current().save(document), reset: () => current().reset()};
}

function indexedContractBackend(network: TestNetwork = 'signet'): ContractBackend {
  const database = `bis-contract-recovery-${network}-v1`;
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
