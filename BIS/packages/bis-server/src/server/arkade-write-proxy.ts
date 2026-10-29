const UPSTREAM = 'https://signet.arkade.sh';
const MAX_TX_BYTES = 256 * 1024;
const MAX_CHECKPOINTS = 32;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

function validBase64(value: unknown) {
  if (typeof value !== 'string' || value.length < 4 || value.length > Math.ceil(MAX_TX_BYTES * 4 / 3) + 8 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) return false;
  const bytes = Buffer.from(value, 'base64');
  return bytes.length > 0 && bytes.length <= MAX_TX_BYTES && bytes.toString('base64') === value;
}

export type SignetArkadeSubmit = Readonly<{ signedArkTx: string; checkpointTxs: readonly string[] }>;
export type SignetArkadeFinalize = Readonly<{ arkTxid: string; finalCheckpointTxs: readonly string[] }>;
export type SignetSubmissionAuthorization = Readonly<{ request: unknown; connectionToken: string }>;

const allowedObject = (value: unknown, keys: readonly string[], required: readonly string[]) => !!value && typeof value === 'object' && !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value)) && Object.keys(value).every(key => keys.includes(key)) && required.every(key => Object.hasOwn(value, key));
const outpoint = (tx: Transaction, index: number) => {
  const input = tx.getInput(index);
  if (!input.txid || input.index === undefined) throw Error('Invalid Arkade transaction input.');
  return `${Buffer.from(input.txid).toString('hex')}:${input.index}`;
};
const isArkTransaction=(value:unknown):value is Transaction=>!!value&&typeof value==='object'&&typeof Reflect.get(value,'toPSBT')==='function'&&
  typeof Reflect.get(value,'getInput')==='function'&&Number.isSafeInteger(Reflect.get(value,'inputsLength'))&&Number.isSafeInteger(Reflect.get(value,'outputsLength'))&&typeof Reflect.get(value,'id')==='string';
const sameBytes=(left:unknown,right:unknown)=>left instanceof Uint8Array&&right instanceof Uint8Array&&Buffer.from(left).equals(Buffer.from(right));
function sameCommittedInput(original:Transaction,signed:Transaction,index:number){
  const before=original.getInput(index),after=signed.getInput(index);
  return outpoint(original,index)===outpoint(signed,index)&&before.witnessUtxo!==undefined&&after.witnessUtxo!==undefined&&
    before.witnessUtxo.amount===after.witnessUtxo.amount&&sameBytes(before.witnessUtxo.script,after.witnessUtxo.script)&&
    before.sighashType===after.sighashType&&
    (before.witnessScript===undefined&&after.witnessScript===undefined||sameBytes(before.witnessScript,after.witnessScript))&&
    (before.redeemScript===undefined&&after.redeemScript===undefined||sameBytes(before.redeemScript,after.redeemScript));
}
const signatureFields=new Set(['partialSig','finalScriptSig','finalScriptWitness','tapKeySig','tapScriptSig','musig2PartialSig']);
const signatureEntryFields=new Set(['partialSig','tapScriptSig','musig2PartialSig']);
const signatureField=(key:string)=>signatureFields.has(key);
function stable(value:unknown):unknown{
  if(value instanceof Uint8Array)return `0x${Buffer.from(value).toString('hex')}`;
  if(typeof value==='bigint')return `${value}n`;
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,stable(item)]));
  return value;
}
function sameUnsignedPsbtMetadata(before:Transaction,after:Transaction,index:number){
  const fields=(tx:Transaction)=>Object.fromEntries(Object.entries(tx.getInput(index)).filter(([key,value])=>!signatureField(key)&&value!==undefined));
  return JSON.stringify(stable(fields(before)))===JSON.stringify(stable(fields(after)));
}
type SignatureMaterial=Map<string,Map<string,string>|string>;
function signatureValue(key:string,value:unknown):Map<string,string>|string|undefined{
  if(!signatureEntryFields.has(key))return JSON.stringify(stable(value));
  if(!Array.isArray(value))return undefined;
  const entries=new Map<string,string>();
  for(const entry of value){
    if(!Array.isArray(entry)||entry.length!==2)return undefined;
    const entryKey=JSON.stringify(stable(entry[0])),entryValue=JSON.stringify(stable(entry[1])),prior=entries.get(entryKey);
    if(prior!==undefined&&prior!==entryValue)return undefined;
    entries.set(entryKey,entryValue);
  }
  return entries;
}
function signatureMaterial(tx:Transaction,index:number):SignatureMaterial|undefined{
  const material:SignatureMaterial=new Map();
  for(const [key,value] of Object.entries(tx.getInput(index)).filter(([key,value])=>signatureField(key)&&value!==undefined)){
    const normalized=signatureValue(key,value);if(normalized===undefined)return undefined;
    material.set(key,normalized);
  }
  return material;
}
function mergeSignatureMaterial(receipts:readonly Transaction[],index:number):SignatureMaterial|undefined{
  const merged:SignatureMaterial=new Map();
  for(const receipt of receipts){
    const material=signatureMaterial(receipt,index);if(!material)return undefined;
    for(const [field,value] of material){
      const prior=merged.get(field);
      if(value instanceof Map){
        if(prior!==undefined&&!(prior instanceof Map))return undefined;
        const entries=prior instanceof Map?prior:new Map<string,string>();
        for(const [key,signature] of value){
          const existing=entries.get(key);if(existing!==undefined&&existing!==signature)return undefined;
          entries.set(key,signature);
        }
        merged.set(field,entries);
      }else{
        if(prior!==undefined&&(prior instanceof Map||prior!==value))return undefined;
        merged.set(field,value);
      }
    }
  }
  return merged;
}
function sameSignatureMaterial(expected:SignatureMaterial,actual:SignatureMaterial){
  if(expected.size!==actual.size)return false;
  for(const [field,value] of expected){
    const received=actual.get(field);if(received===undefined||typeof received!==typeof value)return false;
    if(value instanceof Map){
      if(!(received instanceof Map)||value.size!==received.size)return false;
      for(const [key,signature] of value)if(received.get(key)!==signature)return false;
    }else if(value!==received)return false;
  }
  return true;
}
function hasExactAuthorizedSignatures(receipts:readonly Transaction[],submitted:Transaction,index:number){
  const expected=mergeSignatureMaterial(receipts,index),actual=signatureMaterial(submitted,index);
  return !!expected&&expected.size>0&&!!actual&&sameSignatureMaterial(expected,actual);
}
export function preservesArkadeSignatures(before:Transaction,after:Transaction){
  if(before.id!==after.id||before.inputsLength!==after.inputsLength)return false;
  for(let index=0;index<before.inputsLength;index++){
    const fields=Object.entries(before.getInput(index)).filter(([key,value])=>signatureField(key)&&value!==undefined);
    if(fields.some(([key,value])=>JSON.stringify(stable(Reflect.get(after.getInput(index),key)))!==JSON.stringify(stable(value))))return false;
  }
  return true;
}
export function sameArkadeSignatureMaterial(before:Transaction,after:Transaction){
  if(before.id!==after.id||before.inputsLength!==after.inputsLength)return false;
  for(let index=0;index<before.inputsLength;index++){
    const left=signatureMaterial(before,index),right=signatureMaterial(after,index);
    if(!left||!right||!sameSignatureMaterial(left,right))return false;
  }
  return true;
}

/** A completed signer journal is the sole write authorization. This verifies the exact
 * original signing request, its connected Signet profile and the approved txid/input set. */
export async function verifySignetSubmissionAuthorizations(options: {
  gameId: string; operationId: string; authorizations: unknown; signedArkTx: string; checkpointTxs: readonly string[];
  store: Pick<SigningStore, 'readCompleted'>;
  verifyConnection(token: string, profileId: string): Promise<boolean> | boolean;
}) {
  const { gameId, operationId, signedArkTx, checkpointTxs } = options;
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(gameId) || !/^[a-z0-9-]{1,100}$/i.test(operationId) || !validBase64(signedArkTx) ||
    checkpointTxs.length > MAX_CHECKPOINTS || !checkpointTxs.every(validBase64) || !Array.isArray(options.authorizations) ||
    options.authorizations.length < 1 || options.authorizations.length > MAX_CHECKPOINTS + 1) throw Error('Arkade submission authorization is invalid.');
  const submitted = [signedArkTx, ...checkpointTxs].map(value => Transaction.fromPSBT(Buffer.from(value, 'base64')));
  const byTxid = new Map<string, { tx: Transaction; indexes: Set<number> }>();
  for (const tx of submitted) {
    if (tx.inputsLength < 1 || tx.inputsLength > 100 || tx.outputsLength > 100) throw Error('Arkade submission transaction is invalid.');
    const current = byTxid.get(tx.id);
    if (current) throw Error('Arkade submission contains duplicate transactions.');
    byTxid.set(tx.id, { tx, indexes: new Set() });
  }
  const seen = new Set<string>();
  const receiptsByInput=new Map<string,Map<number,Transaction[]>>();
  let profileId = '';
  for (const value of options.authorizations) {
    if (!allowedObject(value, ['request', 'connectionToken'], ['request', 'connectionToken'])) throw Error('Arkade submission authorization is invalid.');
    const item = value as Record<string, unknown>, raw = item.request as Record<string, unknown>;
    if (typeof item.connectionToken !== 'string' || item.connectionToken.length < 16 || item.connectionToken.length > 4096 ||
      !allowedObject(raw, ['id', 'operationId', 'method', 'network', 'profileId', 'args', 'sessionId', 'paymentPlan', 'ownerPlan', 'settlementPlan', 'ownerSettlementPlan', 'settlementBatchPlan', 'settlementFinalization', 'settlementCommitment', 'settlementConnectors', 'connectionToken', 'treasureRootReceipt'],
        ['id', 'operationId', 'method', 'network', 'profileId', 'args']))
      throw Error('Arkade submission authorization is invalid.');
    if (typeof raw.id !== 'string' || !/^[a-z0-9-]{1,100}$/i.test(raw.id) || raw.operationId !== operationId || raw.method !== 'sign' ||
      raw.network !== 'signet' || typeof raw.profileId !== 'string' || !/^[a-f0-9]{64}$/.test(raw.profileId) ||
      raw.connectionToken !== undefined && raw.connectionToken !== item.connectionToken) throw Error('Arkade submission authorization is invalid.');
    if (profileId && profileId !== raw.profileId || !await options.verifyConnection(item.connectionToken, raw.profileId)) throw Error('Arkade submission connection is invalid.');
    profileId = raw.profileId;
    const lookup = `${raw.id}:${signingDigest(raw)}`;
    if (seen.has(lookup)) throw Error('Arkade submission authorization is duplicated.');
    seen.add(lookup);
    const completed = await options.store.readCompleted?.({ scope: `${gameId}:signet:${profileId}`, id: raw.id, digest: signingDigest(raw) });
    if (!completed || completed.status !== 'completed') throw Error('Arkade signing request is not durably completed.');
    const args = decodeSigningValue(raw.args);
    if (!Array.isArray(args) || !isArkTransaction(args[0])) throw Error('Arkade signing request is invalid.');
    const signedResult=decodeSigningValue(completed.result);
    if(!isArkTransaction(signedResult)||signedResult.id!==args[0].id)throw Error('Arkade signing receipt is invalid.');
    const signed = byTxid.get(args[0].id);
    if (!signed) throw Error('Arkade submitted transaction differs from its approved signer request.');
    const indexes: number[] = args[1] ?? Array.from({ length: args[0].inputsLength }, (_, index) => index);
    if (!Array.isArray(indexes) || indexes.length < 1 || indexes.length > args[0].inputsLength || new Set(indexes).size !== indexes.length) throw Error('Arkade signing input authorization is invalid.');
    for (const index of indexes) {
      if (!Number.isSafeInteger(index) || index < 0 || index >= args[0].inputsLength || !sameCommittedInput(args[0],signed.tx,index) ||
        !sameUnsignedPsbtMetadata(args[0],signedResult,index)||!sameUnsignedPsbtMetadata(signedResult,signed.tx,index)) throw Error('Arkade submitted input differs from its approved signer result.');
      const receipts=receiptsByInput.get(args[0].id)??new Map<number,Transaction[]>(),forIndex=receipts.get(index)??[];
      forIndex.push(signedResult);receipts.set(index,forIndex);receiptsByInput.set(args[0].id,receipts);
      signed.indexes.add(index);
    }
  }
  for (const [txid,transaction] of byTxid){
    if(transaction.indexes.size!==transaction.tx.inputsLength)throw Error('Arkade submission has inputs outside the completed signer authorization.');
    for(let index=0;index<transaction.tx.inputsLength;index++)if(!hasExactAuthorizedSignatures(receiptsByInput.get(txid)?.get(index)??[],transaction.tx,index))
      throw Error('Arkade submitted input signature material differs from its completed signer receipts.');
  }
  return { profileId, transactionId: submitted[0].id };
}

export function sameUnsignedArkadePsbtMetadata(before:Transaction,after:Transaction){
  if(before.id!==after.id||before.inputsLength!==after.inputsLength)return false;
  for(let index=0;index<before.inputsLength;index++)if(!sameUnsignedPsbtMetadata(before,after,index))return false;
  return true;
}

export function validSignetArkadeSubmit(value: unknown): value is SignetArkadeSubmit {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return Object.keys(row).sort().join(',') === 'checkpointTxs,signedArkTx' && validBase64(row.signedArkTx) &&
    Array.isArray(row.checkpointTxs) && row.checkpointTxs.length <= MAX_CHECKPOINTS && row.checkpointTxs.every(validBase64);
}

export function validSignetArkadeFinalize(value: unknown): value is SignetArkadeFinalize {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return Object.keys(row).sort().join(',') === 'arkTxid,finalCheckpointTxs' && typeof row.arkTxid === 'string' && /^[a-f0-9]{64}$/i.test(row.arkTxid) &&
    Array.isArray(row.finalCheckpointTxs) && row.finalCheckpointTxs.length <= MAX_CHECKPOINTS && row.finalCheckpointTxs.every(validBase64);
}

async function readJson(response: Response): Promise<unknown> {
  const type = response.headers.get('content-type') ?? '';
  if (!type.toLowerCase().includes('application/json')) throw Error('Arkade response type is unavailable.');
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_RESPONSE_BYTES) throw Error('Arkade response is too large.');
  if (!response.body) throw Error('Arkade response is empty.');
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) { await reader.cancel(); throw Error('Arkade response is too large.'); }
    chunks.push(value);
  }
  const bytes = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
  return JSON.parse(bytes.toString('utf8'));
}

/** Fixed-network Arkade writes. The caller must persist a pending attempt before
 * entering this function; this helper never retries and never follows redirects. */
export async function submitSignetArkadeTransaction(payload: SignetArkadeSubmit, fetcher: typeof fetch = fetch): Promise<unknown> {
  if (!validSignetArkadeSubmit(payload)) throw Error('Invalid Arkade transaction submission.');
  const response = await fetcher(new URL('/v1/tx/submit', UPSTREAM), {
    method: 'POST', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10_000),
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ signedArkTx: payload.signedArkTx, checkpointTxs: [...payload.checkpointTxs] }),
  });
  if (!response.ok) throw Error('Arkade transaction submission was not acknowledged.');
  const result = await readJson(response);
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw Error('Arkade submission receipt is invalid.');
  const row = result as Record<string, unknown>;
  if (typeof row.arkTxid !== 'string' || !/^[a-f0-9]{64}$/i.test(row.arkTxid) ||
    typeof row.finalArkTx !== 'string' || !validBase64(row.finalArkTx) || !Array.isArray(row.signedCheckpointTxs) ||
    row.signedCheckpointTxs.length !== payload.checkpointTxs.length || !row.signedCheckpointTxs.every(validBase64)) throw Error('Arkade submission receipt is invalid.');
  const root=Transaction.fromPSBT(Buffer.from(payload.signedArkTx,'base64')),finalRoot=Transaction.fromPSBT(Buffer.from(row.finalArkTx,'base64'));
  if(row.arkTxid!==root.id||finalRoot.id!==root.id||!sameArkadeSignatureMaterial(root,finalRoot)||payload.checkpointTxs.some((checkpoint,index)=>{
    const submitted=Transaction.fromPSBT(Buffer.from(checkpoint,'base64')),received=Transaction.fromPSBT(Buffer.from((row.signedCheckpointTxs as string[])[index],'base64'));
    return submitted.id!==received.id||!sameArkadeSignatureMaterial(submitted,received);
  }))
    throw Error('Arkade submission receipt does not match the authorized transactions.');
  return { arkTxid: row.arkTxid, finalArkTx: row.finalArkTx, signedCheckpointTxs: row.signedCheckpointTxs };
}

/** Fixed-network Arkade finalization. It is single-attempt at the caller and has no retry. */
export async function finalizeSignetArkadeTransaction(payload: SignetArkadeFinalize, fetcher: typeof fetch = fetch): Promise<void> {
  if (!validSignetArkadeFinalize(payload)) throw Error('Invalid Arkade transaction finalization.');
  const response = await fetcher(new URL('/v1/tx/finalize', UPSTREAM), {
    method: 'POST', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10_000),
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ arkTxid: payload.arkTxid, finalCheckpointTxs: [...payload.finalCheckpointTxs] }),
  });
  if (!response.ok) throw Error('Arkade transaction finalization was not acknowledged.');
  if (response.body) { const reader = response.body.getReader(); await reader.cancel(); }
}
import { Transaction } from '@arkade-os/sdk';
import { decodeSigningValue } from '../../../integration/src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import { signingDigest } from './signing-authorization.ts';
import type { SigningStore } from './signing-store.ts';
