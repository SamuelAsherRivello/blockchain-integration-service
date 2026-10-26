import {Transaction,CSVMultisigTapscript,buildOffchainTx,Extension,EmulatorPacket,PrevArkTxField,setArkPsbtField} from '@arkade-os/sdk';
import {RawWitness} from '@scure/btc-signer';
import {base64,hex} from '@scure/base';
import {schnorr} from '@noble/curves/secp256k1.js';
import {buildAuthorizedTreasureScript,treasureAuthorizationActors,treasureAuthorizationDigest,type AuthorizedTreasureBranch} from './treasure-authorized-script.ts';
import type {TreasureScriptTerms} from './treasure-script.ts';
import type {TreasureActorProofRequest} from './treasure-authorization-protocol.ts';
import {validateStagedTreasureBinding,type StagedTreasureBinding,type StagedTreasureOriginal} from './treasure-staged-state.ts';

export type AuthorizedTreasureTransactionInput=Readonly<{
  contractId:string;operationId:string;branch:AuthorizedTreasureBranch;terms:TreasureScriptTerms;
  funding:Readonly<{txid:string;vout:number;value:1000}>;previousTransaction:string;checkpointTapscript:string;
}>;
export type AuthorizedTreasureActorTemplate=Readonly<{
  artifactVersion:4;input:AuthorizedTreasureTransactionInput;actorTemplate:StagedTreasureOriginal;digest:string;playerProof?:string;
}>;
const invalid=()=>Error('Authorized treasure transaction does not match its original terms.');
const encoded=(tx:Transaction)=>base64.encode(tx.toPSBT());
const stable=(value:unknown):string=>JSON.stringify(value,(_key,v:unknown)=>v&&typeof v==='object'&&!Array.isArray(v)
  ?Object.fromEntries(Object.keys(v).sort().map(key=>[key,(v as Record<string,unknown>)[key]])):v);
function freeze<T>(value:T):T{
  const result=structuredClone(value);
  const visit=(v:unknown)=>{if(v&&typeof v==='object'){Object.values(v).forEach(visit);Object.freeze(v);}};
  visit(result);return result;
}
function object(value:unknown,keys:string,optional=''):asserts value is Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))||
    Reflect.ownKeys(value).length!==Object.keys(value).length||Object.entries(Object.getOwnPropertyDescriptors(value)).some(([key,descriptor])=>
      !keys.split(' ').includes(key)||!Object.hasOwn(descriptor,'value'))||keys.split(' ').some(key=>!optional.split(' ').includes(key)&&!Object.hasOwn(value,key)))throw invalid();
}
function normalizedInput(value:unknown):AuthorizedTreasureTransactionInput{
  object(value,'contractId operationId branch terms funding previousTransaction checkpointTapscript');
  for(const id of [value.contractId,value.operationId])if(typeof id!=='string'||!id.length||id.length>256||id.trim()!==id||/[\x00-\x1f\x7f]/.test(id))throw invalid();
  object(value.terms,'network offerSessionId hostReference startedAtMs player game operator emulator playerDestination gameDestination exitDelay');
  object(value.funding,'txid vout value');
  if(value.terms.network!=='mutinynet'||typeof value.funding.txid!=='string'||!/^[a-f0-9]{64}$/.test(value.funding.txid)||
    !Number.isSafeInteger(value.funding.vout)||(value.funding.vout as number)<0||(value.funding.vout as number)>0xffffffff||value.funding.value!==1000||
    typeof value.previousTransaction!=='string'||value.previousTransaction.length>500000||!/^(?:[a-f0-9]{2})+$/.test(value.previousTransaction)||
    typeof value.checkpointTapscript!=='string'||value.checkpointTapscript.length>10000||!/^(?:[a-f0-9]{2})+$/.test(value.checkpointTapscript))throw invalid();
  const input=value as unknown as AuthorizedTreasureTransactionInput,built=buildAuthorizedTreasureScript(input.terms);
  if(!treasureAuthorizationActors(input.branch).length)throw invalid();
  const previous=Transaction.fromRaw(hex.decode(input.previousTransaction)),fund=previous.getOutput(input.funding.vout);
  if(previous.id!==input.funding.txid||fund.amount!==1000n||!fund.script||hex.encode(fund.script)!==hex.encode(built.script.pkScript))throw invalid();
  // PrevArkTxField uses the SDK's non-witness wire representation of this same
  // actual funding transaction. No new transaction or altered txid is created.
  return freeze({...input,previousTransaction:hex.encode(previous.toBytes(false,false))});
}
function pair(input:AuthorizedTreasureTransactionInput,proofs:readonly Uint8Array[]){
  const built=buildAuthorizedTreasureScript(input.terms),leaf=built.script.functionByName(input.branch);
  if(!leaf?.arkadeScript||proofs.length!==treasureAuthorizationActors(input.branch).length||proofs.some(proof=>proof.length!==64))throw invalid();
  const unroll=CSVMultisigTapscript.decode(hex.decode(input.checkpointTapscript));
  const packet=Extension.create([EmulatorPacket.create([{vin:0,script:leaf.arkadeScript,witness:RawWitness.encode([...proofs])}])]);
  const result=buildOffchainTx([{...input.funding,tapLeafScript:leaf.tapLeafScript,tapTree:built.script.encode()}],
    [{script:hex.decode('5120'+(input.branch==='claim'?input.terms.playerDestination:input.terms.gameDestination)),amount:1000n},packet.txOut()],unroll);
  if(result.checkpoints.length!==1)throw invalid();
  setArkPsbtField(result.arkTx,0,PrevArkTxField,hex.decode(input.previousTransaction));
  const digest=treasureAuthorizationDigest(input.terms,input.branch,{arkTx:result.arkTx,checkpoint:result.checkpoints[0],funding:input.funding,checkpointTapscript:unroll});
  return {original:{arkTx:encoded(result.arkTx),checkpoints:[encoded(result.checkpoints[0])] as readonly [string]},digest:hex.encode(digest)};
}
function validProof(proof:string,digest:string,key:string){
  if(typeof proof!=='string'||!/^[a-f0-9]{128}$/.test(proof)||!schnorr.verify(hex.decode(proof),hex.decode(digest),hex.decode(key)))throw invalid();
}
function template(input:AuthorizedTreasureTransactionInput,playerProof?:string):AuthorizedTreasureActorTemplate{
  const actors=treasureAuthorizationActors(input.branch),zeros:Uint8Array[]=actors.map(()=>new Uint8Array(64)),unsigned=pair(input,zeros);
  if(playerProof!==undefined){
    if(!actors.includes('player'))throw invalid();validProof(playerProof,unsigned.digest,input.terms.player);
    zeros[actors.indexOf('player')]=hex.decode(playerProof);
  }
  const actual=pair(input,zeros);
  if(actual.digest!==unsigned.digest||actual.original.checkpoints[0]!==unsigned.original.checkpoints[0])throw invalid();
  return freeze({artifactVersion:4,input,actorTemplate:actual.original,digest:actual.digest,...(playerProof!==undefined?{playerProof}:{})});
}
export function validateAuthorizedTreasureActorTemplate(value:unknown):asserts value is AuthorizedTreasureActorTemplate{
  try{
    object(value,'artifactVersion input actorTemplate digest playerProof','playerProof');
    if(value.artifactVersion!==4)throw invalid();
    const input=normalizedInput(value.input),expected=template(input,value.playerProof as string|undefined);
    if(stable(value)!==stable(expected))throw invalid();
  }catch{throw invalid();}
}
/** Canonical zero-proof template only. Caller must persist its exact original
 * signing intent before requesting a Player/Game authorization proof. */
export function prepareAuthorizedTreasureTransaction(input:AuthorizedTreasureTransactionInput):AuthorizedTreasureActorTemplate{
  try{return template(normalizedInput(input));}catch{throw invalid();}
}
export function attachAuthorizedTreasurePlayerProof(value:AuthorizedTreasureActorTemplate,proofHex:string):AuthorizedTreasureActorTemplate{
  try{
    validateAuthorizedTreasureActorTemplate(value);
    if(value.playerProof!==undefined&&value.playerProof!==proofHex)throw invalid();
    return template(value.input,proofHex);
  }catch{throw invalid();}
}
/** The typed server callback receives this exact template, not an arbitrary
 * caller-chosen message. Reject/cancel cannot request Game consent first. */
export function authorizedTreasureGameProofRequest(value:AuthorizedTreasureActorTemplate):TreasureActorProofRequest{
  try{
    validateAuthorizedTreasureActorTemplate(value);const input=value.input;
    if(input.branch==='claim'||input.branch!=='refund'&&value.playerProof===undefined)throw invalid();
    return freeze({artifactVersion:4,branch:input.branch,operationId:input.operationId,offerSessionId:input.terms.offerSessionId,
      hostReference:input.terms.hostReference,startedAtMs:input.terms.startedAtMs,funding:{txid:input.funding.txid,vout:input.funding.vout},
      arkTx:value.actorTemplate.arkTx,checkpoint:value.actorTemplate.checkpoints[0],...(value.playerProof!==undefined?{playerProof:value.playerProof}:{})});
  }catch{throw invalid();}
}
/** Complete proof-bearing original once. Root journals the actor response before
 * adopting this immutable binding; no network, signing or journal is hidden here. */
export function completeAuthorizedTreasureTransaction(value:AuthorizedTreasureActorTemplate,gameProofHex?:string):StagedTreasureBinding{
  try{
    validateAuthorizedTreasureActorTemplate(value);const input=value.input,actors=treasureAuthorizationActors(input.branch);
    if(actors.includes('player')&&value.playerProof===undefined||actors.includes('game')!==!!gameProofHex)throw invalid();
    if(gameProofHex!==undefined){authorizedTreasureGameProofRequest(value);validProof(gameProofHex,value.digest,input.terms.game);}
    const proofs=actors.map(actor=>hex.decode(actor==='player'?value.playerProof!:gameProofHex!)),actual=pair(input,proofs);
    if(actual.digest!==value.digest||actual.original.checkpoints[0]!==value.actorTemplate.checkpoints[0])throw invalid();
    const binding:StagedTreasureBinding={artifactVersion:4,contractId:input.contractId,operationId:input.operationId,branch:input.branch,terms:input.terms,
      funding:input.funding,previousTransaction:input.previousTransaction,checkpointTapscript:input.checkpointTapscript,original:actual.original};
    validateStagedTreasureBinding(binding);return freeze(binding);
  }catch{throw invalid();}
}
