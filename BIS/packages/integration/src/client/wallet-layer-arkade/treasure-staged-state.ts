import {arkade,Transaction,VtxoScript,CSVMultisigTapscript,Extension,PrevArkTxField,getArkPsbtFields,verifyTapscriptSignatures} from '@arkade-os/sdk';
import {base64,hex} from '@scure/base';
import {RawWitness} from '@scure/btc-signer';
import {schnorr} from '@noble/curves/secp256k1.js';
import type {TreasureScriptTerms} from './treasure-script.ts';
import {buildStagedTreasureScript,treasureStagedBranches,type TreasureStagedBranch} from './treasure-staged-script.ts';
import {buildAuthorizedTreasureScript,treasureAuthorizationActors,treasureAuthorizationDigest} from './treasure-authorized-script.ts';
import {assertTreasurePsbtEquivalent,assertTreasureSignatureRetention,decodeTreasurePsbtMaps,mergeTreasurePsbtSignatures} from './treasure-psbt-equivalence.ts';

export type StagedTreasureOriginal=Readonly<{arkTx:string;checkpoints:readonly [string]}>;
export type StagedTreasureBinding=Readonly<{
  artifactVersion:3|4;contractId:string;operationId:string;branch:TreasureStagedBranch;terms:TreasureScriptTerms;
  funding:Readonly<{txid:string;vout:number;value:1000}>;previousTransaction:string;checkpointTapscript:string;original:StagedTreasureOriginal;
}>;
export type StagedTreasureSignedPair=Readonly<{signedArkTx:string;signedCheckpointTxs:readonly string[]}>;
export type StagedTreasureOperatorResponse=Readonly<{arkTxid:string;finalArkTx:string;signedCheckpointTxs:readonly string[]}>;
export type StagedTreasurePhase='prepared'|'emulator-pending'|'emulator-unknown'|'emulator-signed'|'actor-root-signed'|
  'submit-pending'|'submit-unknown'|'operator-signed'|'actor-checkpoints-signed'|'finalize-pending'|'finalize-unknown';
type Step=Readonly<{phase:StagedTreasurePhase;atMs:number}>;
type Authorization=Readonly<{
  contractId:string;operationId:string;branch:TreasureStagedBranch;network:TreasureScriptTerms['network'];
  offerSessionId:string;hostReference:string;player:string;game:string;operator:string;emulator:string;
  startedAtMs:number;deadlineMs:number;authorizedAtMs:number;
}>;
export type StagedTreasureState=Readonly<{
  artifactVersion:3|4;phase:StagedTreasurePhase;bindingCommitment:string;original:StagedTreasureOriginal;
  observationClock:'local-observation-not-signed-server-time';authorization:Authorization;history:readonly Step[];
  emulatorRequest?:StagedTreasureOriginal;emulator?:StagedTreasureSignedPair;actorRoot?:StagedTreasureSignedPair;
  submitRequest?:Readonly<{signedArkTx:string;checkpointTxs:readonly string[]}>;
  operatorReply?:StagedTreasureOperatorResponse;operator?:StagedTreasureOperatorResponse;
  actorCheckpoints?:StagedTreasureSignedPair;finalizeRequest?:Readonly<{arkTxid:string;finalCheckpointTxs:readonly string[]}>;
}>;
export type StagedTreasureEvent=(
  |{type:'emulator-request'|'submit'|'finalize'|'unknown'}
  |{type:'emulator-response';response:StagedTreasureSignedPair}
  |{type:'actor-root';arkTx:string}
  |{type:'operator-response';response:StagedTreasureOperatorResponse}
  |{type:'actor-checkpoints';checkpoints:readonly string[]}
)&Readonly<{atMs:number}>;

const fail=()=>Error('Staged treasure recovery could not be verified. Original funds remain reserved.');
const bytesEqual=(a:Uint8Array,b:Uint8Array)=>a.length===b.length&&a.every((byte,i)=>byte===b[i]);
const stable=(value:unknown):string=>JSON.stringify(value,(_key,v:unknown)=>v instanceof Uint8Array?{bytes:hex.encode(v)}:
  v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,(v as Record<string,unknown>)[k]])):v);
const same=(a:unknown,b:unknown)=>stable(a)===stable(b);
function object(value:unknown,allowed:string,required=allowed):asserts value is Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))||
    Object.keys(value).some(key=>!allowed.split(' ').includes(key))||required.split(' ').some(key=>!Object.hasOwn(value,key)))throw fail();
}
const text=(value:unknown)=>typeof value==='string'&&value.trim()===value&&value.length>0&&value.length<=256&&!/[\x00-\x1f\x7f]/.test(value);
const hexString=(value:unknown,max=500_000)=>typeof value==='string'&&value.length<=max&&/^(?:[a-f0-9]{2})+$/.test(value);
function encodedPair(value:unknown):asserts value is StagedTreasureSignedPair{
  object(value,'signedArkTx signedCheckpointTxs');
  if(typeof value.signedArkTx!=='string'||!Array.isArray(value.signedCheckpointTxs)||value.signedCheckpointTxs.length!==1||typeof value.signedCheckpointTxs[0]!=='string')throw fail();
}
function originalPair(value:unknown):asserts value is StagedTreasureOriginal{
  object(value,'arkTx checkpoints');
  if(typeof value.arkTx!=='string'||!Array.isArray(value.checkpoints)||value.checkpoints.length!==1||typeof value.checkpoints[0]!=='string')throw fail();
}
function operatorResponse(value:unknown):asserts value is StagedTreasureOperatorResponse{
  object(value,'arkTxid finalArkTx signedCheckpointTxs');
  if(typeof value.arkTxid!=='string'||typeof value.finalArkTx!=='string'||!Array.isArray(value.signedCheckpointTxs)||value.signedCheckpointTxs.length!==1||typeof value.signedCheckpointTxs[0]!=='string')throw fail();
}
function freeze<T>(value:T):T{
  const copy=structuredClone(value);
  const visit=(item:unknown)=>{if(item&&typeof item==='object'){Object.values(item).forEach(visit);Object.freeze(item);}};
  visit(copy);return copy;
}
const decode=(encoded:string)=>Transaction.fromPSBT(base64.decode(encoded));
function context(binding:StagedTreasureBinding){
  const built=binding.artifactVersion===4?buildAuthorizedTreasureScript(binding.terms):buildStagedTreasureScript(binding.terms),leaf=built.script.functionByName(binding.branch);
  if(!leaf?.arkadeScript||leaf.signerKeys.length<3)throw fail();
  const keys=leaf.signerKeys.map(key=>hex.encode(key));
  const checkpoint=new VtxoScript([hex.decode(binding.checkpointTapscript),leaf.leafScript]);
  let vmWitness:Uint8Array=new Uint8Array([0]);
  if(binding.artifactVersion===4){
    const arkTx=decode(binding.original.arkTx),cp=decode(binding.original.checkpoints[0]);
    const packet=Extension.fromTx(arkTx).getEmulatorPacket()?.entries;
    if(packet?.length!==1||packet[0].vin!==0||!packet[0].witness)throw fail();
    const proofs=RawWitness.decode(packet[0].witness),actors=treasureAuthorizationActors(binding.branch);
    const message=treasureAuthorizationDigest(binding.terms,binding.branch,{arkTx,checkpoint:cp,funding:binding.funding,
      checkpointTapscript:CSVMultisigTapscript.decode(hex.decode(binding.checkpointTapscript))});
    if(!bytesEqual(RawWitness.encode(proofs),packet[0].witness)||proofs.length!==actors.length||proofs.some((proof,index)=>proof.length!==64||
      !schnorr.verify(proof,message,hex.decode(binding.terms[actors[index]]))))throw fail();
    vmWitness=packet[0].witness;
  }
  return {built,leaf,checkpoint,keys,vmWitness,emulatorKey:keys[1],actorKeys:keys.slice(2),deadlineMs:built.deadlineSeconds*1000};
}
type Context=ReturnType<typeof context>;
function inspectPair(arkEncoded:string,checkpoints:readonly string[],binding:StagedTreasureBinding,c:Context,rootKeys:readonly string[],checkpointKeys=rootKeys){
  if(!Array.isArray(checkpoints)||checkpoints.length!==1)throw fail();
  assertTreasurePsbtEquivalent(arkEncoded,binding.original.arkTx,1,3);
  assertTreasurePsbtEquivalent(checkpoints[0],binding.original.checkpoints[0],1,2);
  const ark=decode(arkEncoded),cp=decode(checkpoints[0]),previous=Transaction.fromRaw(hex.decode(binding.previousTransaction));
  if(ark.inputsLength!==1||ark.outputsLength!==3||cp.inputsLength!==1||cp.outputsLength!==2)throw fail();
  const root=ark.getInput(0),source=cp.getInput(0),funded=previous.getOutput(binding.funding.vout),payout=ark.getOutput(0);
  const destination='5120'+(binding.branch==='claim'?binding.terms.playerDestination:binding.terms.gameDestination);
  if(previous.id!==binding.funding.txid||!source.txid||hex.encode(source.txid)!==previous.id||source.index!==binding.funding.vout||
    funded.amount!==1000n||!funded.script||!bytesEqual(funded.script,c.built.script.pkScript)||source.witnessUtxo?.amount!==1000n||
    !bytesEqual(source.witnessUtxo.script,c.built.script.pkScript)||!root.txid||hex.encode(root.txid)!==cp.id||root.index!==0||
    root.witnessUtxo?.amount!==1000n||!bytesEqual(root.witnessUtxo.script,c.checkpoint.pkScript)||cp.getOutput(0).amount!==1000n||
    !cp.getOutput(0).script||!bytesEqual(cp.getOutput(0).script!,c.checkpoint.pkScript)||payout.amount!==1000n||!payout.script||hex.encode(payout.script)!==destination)throw fail();
  const checkpointLeaf=c.checkpoint.findLeaf(hex.encode(c.leaf.leafScript));
  for(const [i,tx] of [ark,cp].entries()){
    const input=tx.getInput(0),required=i===0?rootKeys:checkpointKeys,anchor=tx.getOutput(tx.outputsLength-1);
    if(!same(input.tapLeafScript,[i===0?checkpointLeaf:c.leaf.tapLeafScript])||anchor.amount!==0n||!anchor.script||hex.encode(anchor.script)!=='51024e73'||
      (input.sighashType!==undefined&&input.sighashType!==0&&input.sighashType!==1))throw fail();
    const signatures=input.tapScriptSig??[],actual=signatures.map(([key])=>hex.encode(key.pubKey));
    if(new Set(actual).size!==actual.length||new Set(required).size!==required.length||actual.length!==required.length||actual.some(key=>!required.includes(key)))throw fail();
    for(const [,signature] of signatures)if(!(signature.length===64||(signature.length===65&&signature[64]===1)))throw fail();
    // SDK matches every signature leaf hash to the sole exact recompiled leaf.
    if(required.length)verifyTapscriptSignatures(tx,0,[...required],[],[0,1]);
  }
  const previousFields=getArkPsbtFields(ark,0,PrevArkTxField),packet=Extension.fromTx(ark);
  const entries=packet.getEmulatorPacket()?.entries;
  if(previousFields.length!==1||!bytesEqual(previousFields[0],hex.decode(binding.previousTransaction))||packet.getAssetPacket()||
    entries?.length!==1||entries[0].vin!==0||!bytesEqual(entries[0].script,c.leaf.arkadeScript!)||!entries[0].witness||!bytesEqual(entries[0].witness,c.vmWitness)||ark.getOutput(1).amount!==0n)throw fail();
  return {ark,cp};
}
function checkedBinding(value:unknown):Context{
  object(value,'artifactVersion contractId operationId branch terms funding previousTransaction checkpointTapscript original');
  if(![3,4].includes(value.artifactVersion as number)||!text(value.contractId)||!text(value.operationId)||!treasureStagedBranches.includes(value.branch as TreasureStagedBranch))throw fail();
  object(value.terms,'network offerSessionId hostReference startedAtMs player game operator emulator playerDestination gameDestination exitDelay');
  object(value.funding,'txid vout value');originalPair(value.original);
  if(typeof value.funding.txid!=='string'||!/^[a-f0-9]{64}$/.test(value.funding.txid)||!Number.isSafeInteger(value.funding.vout)||
    (value.funding.vout as number)<0||(value.funding.vout as number)>0xffffffff||value.funding.value!==1000||
    !hexString(value.previousTransaction)||!hexString(value.checkpointTapscript,10000))throw fail();
  const binding=value as unknown as StagedTreasureBinding,c=context(binding);
  CSVMultisigTapscript.decode(hex.decode(binding.checkpointTapscript));
  for(const maps of [decodeTreasurePsbtMaps(binding.original.arkTx,1,3),decodeTreasurePsbtMaps(binding.original.checkpoints[0],1,2)]){
    if(maps[1].some(({key})=>[0x02,0x07,0x08,0x13,0x14].includes(key[0])))throw fail();
  }
  inspectPair(binding.original.arkTx,binding.original.checkpoints,binding,c,[]);return c;
}
export function validateStagedTreasureBinding(value:unknown):asserts value is StagedTreasureBinding{
  try{checkedBinding(value);}catch{throw fail();}
}
const nextPhases:Record<StagedTreasurePhase,readonly StagedTreasurePhase[]>={
  prepared:['emulator-pending'],'emulator-pending':['emulator-unknown','emulator-signed'],'emulator-unknown':['emulator-signed'],
  'emulator-signed':['actor-root-signed'],'actor-root-signed':['submit-pending'],'submit-pending':['submit-unknown','operator-signed'],
  'submit-unknown':['operator-signed'],'operator-signed':['actor-checkpoints-signed'],'actor-checkpoints-signed':['finalize-pending'],
  'finalize-pending':['finalize-unknown'],'finalize-unknown':[],
};
const commitment=(binding:StagedTreasureBinding)=>hex.encode(arkade.arkadeScriptHash(new TextEncoder().encode('bis:treasure:stage:v'+binding.artifactVersion+':'+stable(binding))));
const eligible=(atMs:number,b:StagedTreasureBinding,c:Context)=>Number.isSafeInteger(atMs)&&atMs>=b.terms.startedAtMs&&(b.branch==='refund'?atMs>=c.deadlineMs:atMs<c.deadlineMs);
function authorization(b:StagedTreasureBinding,c:Context,atMs:number):Authorization{
  return {contractId:b.contractId,operationId:b.operationId,branch:b.branch,network:b.terms.network,offerSessionId:b.terms.offerSessionId,
    hostReference:b.terms.hostReference,player:b.terms.player,game:b.terms.game,operator:b.terms.operator,emulator:b.terms.emulator,
    startedAtMs:b.terms.startedAtMs,deadlineMs:c.deadlineMs,authorizedAtMs:atMs};
}
function normalizeOperator(state:StagedTreasureState,response:StagedTreasureOperatorResponse,b:StagedTreasureBinding,c:Context):StagedTreasureOperatorResponse{
  operatorResponse(response);if(response.arkTxid!==decode(b.original.arkTx).id)throw fail();
  const rootKeys=(decode(response.finalArkTx).getInput(0).tapScriptSig??[]).map(([key])=>hex.encode(key.pubKey));
  const cpKeys=(decode(response.signedCheckpointTxs[0]).getInput(0).tapScriptSig??[]).map(([key])=>hex.encode(key.pubKey));
  if(!rootKeys.includes(b.terms.operator)||rootKeys.some(key=>!c.keys.includes(key))||!cpKeys.includes(b.terms.operator)||cpKeys.some(key=>![b.terms.operator,c.emulatorKey].includes(key)))throw fail();
  inspectPair(response.finalArkTx,response.signedCheckpointTxs,b,c,rootKeys,cpKeys);
  const merged={arkTxid:response.arkTxid,finalArkTx:mergeTreasurePsbtSignatures(b.original.arkTx,state.actorRoot!.signedArkTx,response.finalArkTx,1,3),
    signedCheckpointTxs:[mergeTreasurePsbtSignatures(b.original.checkpoints[0],state.emulator!.signedCheckpointTxs[0],response.signedCheckpointTxs[0],1,2)]};
  inspectPair(merged.finalArkTx,merged.signedCheckpointTxs,b,c,c.keys,[b.terms.operator,c.emulatorKey]);return merged;
}
function checkedState(value:unknown,b:StagedTreasureBinding,c:Context):asserts value is StagedTreasureState{
  const base='artifactVersion phase bindingCommitment original observationClock authorization history';
  object(value,base+' emulatorRequest emulator actorRoot submitRequest operatorReply operator actorCheckpoints finalizeRequest',base);
  if(stable(value).length>4_000_000||value.artifactVersion!==b.artifactVersion||value.observationClock!=='local-observation-not-signed-server-time'||
    value.bindingCommitment!==commitment(b)||!same(value.original,b.original))throw fail();
  object(value.authorization,'contractId operationId branch network offerSessionId hostReference player game operator emulator startedAtMs deadlineMs authorizedAtMs');
  const atMs=value.authorization.authorizedAtMs as number;
  if(!eligible(atMs,b,c)||!same(value.authorization,authorization(b,c,atMs))||!Array.isArray(value.history)||value.history.length<1||value.history.length>12)throw fail();
  const s=value as unknown as StagedTreasureState;
  for(let i=0;i<s.history.length;i++){
    const step=s.history[i];object(step,'phase atMs');
    if(!Number.isSafeInteger(step.atMs)||(i===0?(step.phase!=='prepared'||step.atMs!==atMs):
      step.atMs<s.history[i-1].atMs||!nextPhases[s.history[i-1].phase]?.includes(step.phase)))throw fail();
  }
  if(s.history.at(-1)!.phase!==s.phase)throw fail();
  const seen=(phase:StagedTreasurePhase)=>s.history.find(step=>step.phase===phase),allowed=base.split(' ');
  // V4's verified emulator ROOT signature commits the actor-authorized packet
  // and its VM clock rule. A delayed response/completion is not a new admission.
  // V3 has no actor-proof requirement and retains its original timing guards.
  const timedPhases=b.artifactVersion===4?['emulator-pending'] as const:
    ['emulator-pending','emulator-signed','actor-root-signed','submit-pending','operator-signed'] as const;
  for(const phase of timedPhases){
    const event=seen(phase);if(event&&!eligible(event.atMs,b,c))throw fail();
  }
  if(seen('emulator-pending')){allowed.push('emulatorRequest');originalPair(s.emulatorRequest);if(!same(s.emulatorRequest,b.original))throw fail();}
  if(seen('emulator-signed')){allowed.push('emulator');encodedPair(s.emulator);inspectPair(s.emulator.signedArkTx,s.emulator.signedCheckpointTxs,b,c,[c.emulatorKey]);}
  if(seen('actor-root-signed')){
    allowed.push('actorRoot');encodedPair(s.actorRoot);
    if(!same(s.actorRoot.signedCheckpointTxs,s.emulator!.signedCheckpointTxs))throw fail();
    inspectPair(s.actorRoot.signedArkTx,s.actorRoot.signedCheckpointTxs,b,c,[c.emulatorKey,...c.actorKeys],[c.emulatorKey]);
    assertTreasureSignatureRetention(s.emulator!.signedArkTx,s.actorRoot.signedArkTx,1,3);
  }
  if(seen('submit-pending')){allowed.push('submitRequest');if(!same(s.submitRequest,{signedArkTx:s.actorRoot!.signedArkTx,checkpointTxs:s.emulator!.signedCheckpointTxs}))throw fail();}
  if(seen('operator-signed')){
    allowed.push('operatorReply','operator');operatorResponse(s.operatorReply);operatorResponse(s.operator);
    if(!same(s.operator,normalizeOperator(s,s.operatorReply,b,c)))throw fail();
  }
  if(seen('actor-checkpoints-signed')){
    allowed.push('actorCheckpoints');encodedPair(s.actorCheckpoints);
    if(s.actorCheckpoints.signedArkTx!==s.operator!.finalArkTx)throw fail();
    inspectPair(s.actorCheckpoints.signedArkTx,s.actorCheckpoints.signedCheckpointTxs,b,c,c.keys);
    assertTreasureSignatureRetention(s.operator!.signedCheckpointTxs[0],s.actorCheckpoints.signedCheckpointTxs[0],1,2);
  }
  if(seen('finalize-pending')){allowed.push('finalizeRequest');if(!same(s.finalizeRequest,{arkTxid:s.operator!.arkTxid,finalCheckpointTxs:s.actorCheckpoints!.signedCheckpointTxs}))throw fail();}
  if(Object.keys(value).some(key=>!allowed.includes(key)))throw fail();
}
export function validateStagedTreasureState(value:unknown,binding:StagedTreasureBinding):asserts value is StagedTreasureState{
  try{const c=checkedBinding(binding);checkedState(value,binding,c);}catch{throw fail();}
}
export function createStagedTreasureState(binding:StagedTreasureBinding,authorizedAtMs:number):StagedTreasureState{
  try{
    const c=checkedBinding(binding);
    const result={artifactVersion:binding.artifactVersion,phase:'prepared' as const,bindingCommitment:commitment(binding),original:binding.original,
      observationClock:'local-observation-not-signed-server-time' as const,authorization:authorization(binding,c,authorizedAtMs),history:[{phase:'prepared' as const,atMs:authorizedAtMs}]};
    checkedState(result,binding,c);return freeze(result);
  }catch{throw fail();}
}
function advance(previous:unknown,next:unknown,b:StagedTreasureBinding,c:Context):StagedTreasureState{
  checkedState(previous,b,c);checkedState(next,b,c);
  if(next.history.length!==previous.history.length+1||!same(next.history.slice(0,-1),previous.history)||!nextPhases[previous.phase].includes(next.phase))throw fail();
  for(const key of Object.keys(previous) as (keyof StagedTreasureState)[])if(!['phase','history'].includes(key)&&!same(previous[key],next[key]))throw fail();
  return freeze(next);
}
/** Caller must atomically compare/persist the original revision before calls.
 * This validates monotonic data, not the caller's durable storage or network. */
export function advanceStagedTreasureState(previous:unknown,next:unknown,binding:StagedTreasureBinding):StagedTreasureState{
  try{return advance(previous,next,binding,checkedBinding(binding));}catch{throw fail();}
}
/** Consumes actual externally signed material; never signs or calls a provider. */
export function transitionStagedTreasureState(previous:unknown,event:StagedTreasureEvent,binding:StagedTreasureBinding):StagedTreasureState{
  try{
    const c=checkedBinding(binding);checkedState(previous,binding,c);
    const extras=event.type==='emulator-response'||event.type==='operator-response'?' response':event.type==='actor-root'?' arkTx':event.type==='actor-checkpoints'?' checkpoints':'';
    object(event,'type atMs'+extras);
    let phase:StagedTreasurePhase,patch:Partial<StagedTreasureState>={};
    switch(event.type){
      case 'emulator-request':phase='emulator-pending';patch={emulatorRequest:binding.original};break;
      case 'emulator-response':phase='emulator-signed';patch={emulator:event.response};break;
      case 'actor-root':phase='actor-root-signed';patch={actorRoot:{signedArkTx:event.arkTx,signedCheckpointTxs:previous.emulator!.signedCheckpointTxs}};break;
      case 'submit':phase='submit-pending';patch={submitRequest:{signedArkTx:previous.actorRoot!.signedArkTx,checkpointTxs:previous.emulator!.signedCheckpointTxs}};break;
      case 'operator-response':phase='operator-signed';patch={operatorReply:event.response,operator:normalizeOperator(previous,event.response,binding,c)};break;
      case 'actor-checkpoints':phase='actor-checkpoints-signed';patch={actorCheckpoints:{signedArkTx:previous.operator!.finalArkTx,signedCheckpointTxs:event.checkpoints}};break;
      case 'finalize':phase='finalize-pending';patch={finalizeRequest:{arkTxid:previous.operator!.arkTxid,finalCheckpointTxs:previous.actorCheckpoints!.signedCheckpointTxs}};break;
      case 'unknown':{
        const phases:Partial<Record<StagedTreasurePhase,StagedTreasurePhase>>={'emulator-pending':'emulator-unknown','submit-pending':'submit-unknown','finalize-pending':'finalize-unknown'};
        const target=phases[previous.phase];if(!target)throw fail();phase=target;break;
      }
      default:throw fail();
    }
    const next={...previous,...patch,phase,history:[...previous.history,{phase,atMs:event.atMs}]};
    return advance(previous,next,binding,c);
  }catch{throw fail();}
}
