import {Transaction,DefaultVtxo,CSVMultisigTapscript,buildOffchainTx,Extension,EmulatorPacket,
  PrevArkTxField,setArkPsbtField,verifyTapscriptSignatures} from '@arkade-os/sdk';
import {RawWitness} from '@scure/btc-signer';
import {base64,hex} from '@scure/base';
import {sha256} from '@noble/hashes/sha2.js';
import {schnorr} from '@noble/curves/secp256k1.js';
import {buildAuthorizedTreasureScript,treasureAuthorizationDigest} from './treasure-authorized-script.ts';
import type {TreasureScriptTerms} from './treasure-script.ts';
import type {TreasureActorProofRequest} from './treasure-authorization-protocol.ts';
import {assertTreasurePsbtEquivalent,assertTreasureSignatureRetention,decodeTreasurePsbtMaps} from './treasure-psbt-equivalence.ts';

type Pair=Readonly<{arkTx:string;checkpoints:readonly string[]}>;
type Common=Readonly<{
  artifactVersion:4;contractId:string;operationId:string;endpoint:string;gameId:string;
  network:'mutinynet';profileId:string;publicKey:string;authority:'owner'|'player-proof';
  terms:TreasureScriptTerms;checkpointTapscript:string;
}>;
export type TreasureServerJournalBinding=Common&(
  |Readonly<{kind:'fund';original:Pair;sourceTransactions:readonly string[]}>
  |Readonly<{kind:'spend';branch:'reject'|'cancel'|'refund';funding:Readonly<{txid:string;vout:number;value:1000}>;
    previousTransaction:string;actorTemplate:Readonly<{arkTx:string;checkpoint:string;playerProof?:string}>}>
);
export type TreasureServerRequestPurpose='actor-proof'|'root'|'checkpoint';
export type TreasureServerRequestPhase='prepared'|'planned'|'sign-pending'|'sign-unknown'|'completed';
export type TreasureServerRequest=Readonly<{
  purpose:TreasureServerRequestPurpose;id:string;argsJson:string;checkpointIndex?:number;
  phase:TreasureServerRequestPhase;history:readonly Readonly<{phase:TreasureServerRequestPhase;atMs:number}>[];
  bodyJson?:string;bodyDigest?:string;connectionToken?:string;responseJson?:string;
}>;
/** Private recovery only. Never expose through public account/contract DTOs.
 * This pure helper does not encrypt, persist, call HTTP or grant signing rights. */
export type TreasureServerJournal=Readonly<{
  version:1;artifactVersion:4;observationClock:'local-journal-not-server-admission';
  binding:TreasureServerJournalBinding;bindingCommitment:string;requests:readonly TreasureServerRequest[];
}>;
export type TreasureServerRequestPreparation=Readonly<{
  purpose:TreasureServerRequestPurpose;id:string;argsJson:string;checkpointIndex?:number;
}>;
export type TreasureServerRequestEvent=Readonly<(
  |{type:'planned';bodyJson:string;connectionToken:string}
  |{type:'sign-pending'|'sign-unknown'}
  |{type:'completed';responseJson:string}
)&{atMs:number}>;

const fail=()=>Error('Treasure server recovery could not be verified. Original operations remain reserved.');
const equal=(a:Uint8Array,b:Uint8Array)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const stable=(value:unknown):string=>JSON.stringify(value,(_key,v:unknown)=>v&&typeof v==='object'&&!Array.isArray(v)
  ?Object.fromEntries(Object.keys(v).sort().map(key=>[key,(v as Record<string,unknown>)[key]])):v);
const same=(a:unknown,b:unknown)=>stable(a)===stable(b);
const encoded=(tx:Transaction)=>base64.encode(tx.toPSBT());
const hash=(text:string)=>hex.encode(sha256(new TextEncoder().encode(text)));
const id=(v:unknown)=>typeof v==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(v);
const key=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
function object(v:unknown,allowed:string,required=allowed):asserts v is Record<string,unknown>{
  if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v))||
    Object.keys(v).some(k=>!allowed.split(' ').includes(k))||required.split(' ').some(k=>!Object.hasOwn(v,k)))throw fail();
}
function freeze<T>(value:T):T{
  const copy=structuredClone(value);const visit=(v:unknown)=>{if(v&&typeof v==='object'){Object.values(v).forEach(visit);Object.freeze(v);}};
  visit(copy);return copy;
}
function json(text:unknown,max=1_048_576):unknown{
  if(typeof text!=='string'||text.length>max)throw fail();const value:unknown=JSON.parse(text);
  // Reject duplicate keys/whitespace normalization; keep original property order.
  if(JSON.stringify(value)!==text)throw fail();return value;
}
function sealed(value:unknown,max=512*1024):value is string{
  if(typeof value!=='string'||value.length>max)return false;
  const parts=value.split('.');return parts.length===2&&/^[a-zA-Z0-9_-]+$/.test(parts[0])&&/^[a-zA-Z0-9_-]{43}$/.test(parts[1]);
}
function transaction(value:unknown):Transaction{
  if(typeof value!=='string'||value.length>250_000)throw fail();const bytes=base64.decode(value);
  if(base64.encode(bytes)!==value)throw fail();const tx=Transaction.fromPSBT(bytes);
  assertTreasureSignatureRetention(value,encoded(tx),tx.inputsLength,tx.outputsLength);return tx;
}
function rawTransaction(value:unknown):Transaction{
  if(typeof value!=='string'||value.length>500_000||!/^(?:[a-f0-9]{2})+$/.test(value))throw fail();
  return Transaction.fromRaw(hex.decode(value));
}
function compare(value:string,canonical:Transaction,allowed:readonly string[],requireGameAbsent?:string){
  const tx=transaction(value);assertTreasurePsbtEquivalent(value,encoded(canonical),tx.inputsLength,tx.outputsLength);
  const maps=decodeTreasurePsbtMaps(value,tx.inputsLength,tx.outputsLength);
  for(let i=0;i<tx.inputsLength;i++){
    if(maps[i+1].some(({key})=>[0x02,0x07,0x08,0x13].includes(key[0])))throw fail();
    const input=tx.getInput(i),sigs=input.tapScriptSig??[],keys=sigs.map(([k])=>hex.encode(k.pubKey));
    if(input.sighashType!==undefined&&![0,1].includes(input.sighashType)||new Set(keys).size!==keys.length||
      keys.some(k=>!allowed.includes(k)||k===requireGameAbsent))throw fail();
    for(const [,sig] of sigs)if(!(sig.length===64||sig.length===65&&sig[64]===1))throw fail();
    if(keys.length)verifyTapscriptSignatures(tx,i,keys,[],[0,1]);
  }
  return tx;
}
function context(value:unknown){
  object(value,'artifactVersion contractId operationId endpoint gameId network profileId publicKey authority terms checkpointTapscript kind original sourceTransactions branch funding previousTransaction actorTemplate',
    'artifactVersion contractId operationId endpoint gameId network profileId publicKey authority terms checkpointTapscript kind');
  if(value.artifactVersion!==4||![value.contractId,value.operationId,value.gameId].every(id)||value.network!=='mutinynet'||
    !key(value.profileId)||typeof value.publicKey!=='string'||!/^0[23][a-f0-9]{64}$/.test(value.publicKey)||
    !['owner','player-proof'].includes(String(value.authority))||typeof value.endpoint!=='string')throw fail();
  const url=new URL(value.endpoint);
  if(url.href!==value.endpoint||url.username||url.password||url.search||url.hash||!url.pathname.endsWith('/api/bis/')||
    !(url.protocol==='https:'||url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname))||
    hex.encode(sha256(hex.decode(value.publicKey)))!==value.profileId)throw fail();
  object(value.terms,'network offerSessionId hostReference startedAtMs player game operator emulator playerDestination gameDestination exitDelay');
  const b=value as unknown as TreasureServerJournalBinding,t=b.terms,built=buildAuthorizedTreasureScript(t);
  if(t.network!==b.network||t.game!==b.publicKey.slice(2))throw fail();
  const wallet=(pubKey:string)=>new DefaultVtxo.Script({pubKey:hex.decode(pubKey),serverPubKey:hex.decode(t.operator),csvTimelock:{type:'seconds',value:BigInt(t.exitDelay)}});
  const game=wallet(t.game),player=wallet(t.player);
  if(hex.encode(game.pkScript)!=='5120'+t.gameDestination||hex.encode(player.pkScript)!=='5120'+t.playerDestination||
    typeof b.checkpointTapscript!=='string'||b.checkpointTapscript.length>10_000||!/^(?:[a-f0-9]{2})+$/.test(b.checkpointTapscript))throw fail();
  const unroll=CSVMultisigTapscript.decode(hex.decode(b.checkpointTapscript));
  // Preserve the original advertised checkpoint closure. Its forfeit key is
  // a distinct role from the ordinary operator signing key in the terms.
  if(unroll.params.pubkeys.length!==1)throw fail();
  let pair:ReturnType<typeof buildOffchainTx>,actorRequest:TreasureActorProofRequest|undefined,message:Uint8Array|undefined,allowed:string[];
  if(b.kind==='fund'){
    if(['branch','funding','previousTransaction','actorTemplate'].some(k=>Object.hasOwn(b,k)))throw fail();
    object(b.original,'arkTx checkpoints');const root=transaction(b.original.arkTx);
    if(root.inputsLength<1||root.inputsLength>100||!Array.isArray(b.original.checkpoints)||b.original.checkpoints.length!==root.inputsLength||
      !Array.isArray(b.sourceTransactions)||b.sourceTransactions.length<1||b.sourceTransactions.length>100)throw fail();
    const sources=b.sourceTransactions.map(rawTransaction),byId=new Map(sources.map(tx=>[tx.id,tx]));if(byId.size!==sources.length)throw fail();
    const used=new Set<string>(),outpoints=new Set<string>();
    const inputs=b.original.checkpoints.map(value=>{
      const cp=transaction(value);if(cp.inputsLength!==1||cp.outputsLength!==2)throw fail();const source=cp.getInput(0);
      if(!source.txid||source.index===undefined||!source.witnessUtxo)throw fail();const txid=hex.encode(source.txid),previous=byId.get(txid);
      if(!previous)throw fail();const output=previous.getOutput(source.index),point=txid+':'+source.index;used.add(txid);
      if(outpoints.has(point)||!output.script||!equal(output.script,game.pkScript)||!equal(output.script,source.witnessUtxo.script)||
        output.amount!==source.witnessUtxo.amount||output.amount===undefined||output.amount<=0n||output.amount>BigInt(Number.MAX_SAFE_INTEGER))throw fail();
      outpoints.add(point);return {txid,vout:source.index,value:Number(output.amount),tapLeafScript:game.forfeit(),tapTree:game.encode()};
    });
    if(used.size!==byId.size)throw fail();const total=inputs.reduce((sum,v)=>sum+BigInt(v.value),0n),change=total-1000n;
    if(change<0n||total>BigInt(Number.MAX_SAFE_INTEGER))throw fail();
    pair=buildOffchainTx(inputs,[{script:built.script.pkScript,amount:1000n},...(change?[{script:game.pkScript,amount:change}]:[])],unroll);
    allowed=[t.game,t.operator];compare(b.original.arkTx,pair.arkTx,allowed);
    b.original.checkpoints.forEach((cp,i)=>compare(cp,pair.checkpoints[i],allowed));
  }else if(b.kind==='spend'){
    if(Object.hasOwn(b,'original')||Object.hasOwn(b,'sourceTransactions')||!['reject','cancel','refund'].includes(b.branch))throw fail();
    object(b.funding,'txid vout value');object(b.actorTemplate,'arkTx checkpoint playerProof','arkTx checkpoint');
    if(!key(b.funding.txid)||!Number.isSafeInteger(b.funding.vout)||b.funding.vout<0||b.funding.vout>0xffffffff||b.funding.value!==1000)throw fail();
    const previous=rawTransaction(b.previousTransaction),output=previous.getOutput(b.funding.vout),leaf=built.script.functionByName(b.branch)!;
    if(previous.id!==b.funding.txid||output.amount!==1000n||!output.script||!equal(output.script,built.script.pkScript))throw fail();
    const proof=b.actorTemplate.playerProof;
    if(b.branch==='refund'?proof!==undefined:typeof proof!=='string'||!/^[a-f0-9]{128}$/.test(proof))throw fail();
    const witness=RawWitness.encode(proof?[hex.decode(proof),new Uint8Array(64)]:[new Uint8Array(64)]);
    const packet=Extension.create([EmulatorPacket.create([{vin:0,script:leaf.arkadeScript!,witness}])]);
    pair=buildOffchainTx([{...b.funding,tapLeafScript:leaf.tapLeafScript,tapTree:built.script.encode()}],
      [{script:game.pkScript,amount:1000n},packet.txOut()],unroll);setArkPsbtField(pair.arkTx,0,PrevArkTxField,previous.toBytes(false,false));
    allowed=leaf.signerKeys.map(hex.encode);const root=compare(b.actorTemplate.arkTx,pair.arkTx,[]),cp=compare(b.actorTemplate.checkpoint,pair.checkpoints[0],[]);
    message=treasureAuthorizationDigest(t,b.branch,{arkTx:root,checkpoint:cp,funding:b.funding,checkpointTapscript:unroll});
    if(proof&&!schnorr.verify(hex.decode(proof),message,hex.decode(t.player)))throw fail();
    actorRequest={artifactVersion:4,branch:b.branch,operationId:b.operationId,offerSessionId:t.offerSessionId,hostReference:t.hostReference,
      startedAtMs:t.startedAtMs,funding:{txid:b.funding.txid,vout:b.funding.vout},arkTx:b.actorTemplate.arkTx,checkpoint:b.actorTemplate.checkpoint,
      ...(proof?{playerProof:proof}:{})};
  }else throw fail();
  return {b,t,built,game,pair,unroll,allowed,actorRequest,message};
}
type Context=ReturnType<typeof context>;
const commitment=(b:TreasureServerJournalBinding)=>hash('bis:treasure:private-server-journal:v4:'+stable(b));
function args(record:TreasureServerRequest){const value=json(record.argsJson,750_000);if(!Array.isArray(value)||value.length!==2)throw fail();return value;}
function actorSignature(journal:TreasureServerJournal,c:Context){
  const record=journal.requests.find(r=>r.purpose==='actor-proof');if(!record||record.phase!=='completed'||!record.responseJson||!c.message)throw fail();
  const response=json(record.responseJson);object(response,'result');object(response.result,'$type value');
  if(response.result.$type!=='bytes'||typeof response.result.value!=='string'||!/^[a-f0-9]{128}$/.test(response.result.value)||
    !schnorr.verify(hex.decode(response.result.value),c.message,hex.decode(c.t.game)))throw fail();return hex.decode(response.result.value);
}
function rootTemplate(journal:TreasureServerJournal,c:Context){
  if(c.b.kind==='fund')return c.pair.arkTx;
  const proof=actorSignature(journal,c),leaf=c.built.script.functionByName(c.b.branch)!;
  const player=c.b.actorTemplate.playerProof,witness=RawWitness.encode(player?[hex.decode(player),proof]:[proof]);
  const packet=Extension.create([EmulatorPacket.create([{vin:0,script:leaf.arkadeScript!,witness}])]);
  const pair=buildOffchainTx([{...c.b.funding,tapLeafScript:leaf.tapLeafScript,tapTree:c.built.script.encode()}],
    [{script:c.game.pkScript,amount:1000n},packet.txOut()],c.unroll);setArkPsbtField(pair.arkTx,0,PrevArkTxField,rawTransaction(c.b.previousTransaction).toBytes(false,false));
  return pair.arkTx;
}
function preparedArguments(record:TreasureServerRequest,journal:TreasureServerJournal,c:Context){
  if(record.purpose==='actor-proof'){
    if(c.b.kind!=='spend'||record.checkpointIndex!==undefined||!c.message)throw fail();
    const value=args(record);object(value[0],'$type value');
    if(value[0].$type!=='bytes'||value[0].value!==hex.encode(c.message)||value[1]!=='schnorr')throw fail();return;
  }
  const value=args(record);object(value[0],'$type value');
  if(value[0].$type!=='transaction'||typeof value[0].value!=='string'||!/^(?:[a-f0-9]{2})+$/.test(value[0].value))throw fail();
  const raw=base64.encode(hex.decode(value[0].value)),tx=transaction(raw);
  if(value[1]!==null&&(!Array.isArray(value[1])||value[1].length!==tx.inputsLength||value[1].some((v,i)=>v!==i)))throw fail();
  let canonical:Transaction;
  if(record.purpose==='root'){
    if(record.checkpointIndex!==undefined)throw fail();canonical=rootTemplate(journal,c);
  }else if(record.purpose==='checkpoint'){
    const index=record.checkpointIndex,root=journal.requests.find(r=>r.purpose==='root');
    if(!Number.isSafeInteger(index)||index!<0||index!>=c.pair.checkpoints.length||!root||root.phase!=='completed')throw fail();
    canonical=c.pair.checkpoints[index!];
  }else throw fail();
  compare(raw,canonical,c.allowed,c.t.game);
  const emulatorKey=c.b.kind==='spend'?hex.encode(c.built.script.functionByName(c.b.branch)!.signerKeys[1]):undefined;
  const required=record.purpose==='checkpoint'
    ?[c.t.operator,...(emulatorKey?[emulatorKey]:[]),...(c.b.kind==='spend'&&c.b.branch!=='refund'?[c.t.player]:[])]
    :c.b.kind==='spend'?[emulatorKey!,...(c.b.branch!=='refund'?[c.t.player]:[])]:[];
  for(let i=0;i<tx.inputsLength;i++){
    const present=(tx.getInput(i).tapScriptSig??[]).map(([k])=>hex.encode(k.pubKey));
    if(required.some(k=>!present.includes(k)))throw fail();
  }
  return tx;
}
function plannedBody(record:TreasureServerRequest,journal:TreasureServerJournal,c:Context){
  if(!sealed(record.connectionToken,4096)||typeof record.bodyJson!=='string'||record.bodyDigest!==hash(record.bodyJson))throw fail();
  const body=json(record.bodyJson),base='id operationId method network profileId args';
  object(body,record.purpose==='actor-proof'?base+' treasureActorProof treasureActorPlan connectionToken':base+' paymentPlan ownerPlan connectionToken treasureRootReceipt',base);
  if(body.id!==record.id||body.operationId!==c.b.operationId||body.network!==c.b.network||body.profileId!==c.b.profileId||
    JSON.stringify(body.args)!==record.argsJson||body.method!==(record.purpose==='actor-proof'?'signMessage':'sign'))throw fail();
  if(record.purpose==='actor-proof'){
    if(!sealed(body.treasureActorPlan)||body.connectionToken!==record.connectionToken||!same(body.treasureActorProof,c.actorRequest))throw fail();
  }else{
    const owner=c.b.authority==='owner',plan=owner?body.ownerPlan:body.paymentPlan;
    if(!sealed(plan)||Object.hasOwn(body,owner?'paymentPlan':'ownerPlan')||
      owner&&body.connectionToken!==record.connectionToken||!owner&&body.connectionToken!==undefined&&body.connectionToken!==record.connectionToken)throw fail();
    if(record.purpose==='root'){if(body.treasureRootReceipt!==undefined)throw fail();}
    else{
      const root=journal.requests.find(r=>r.purpose==='root');if(!root?.responseJson)throw fail();
      const response=json(root.responseJson);object(response,'result treasureRootReceipt');
      const rootBody=json(root.bodyJson);object(rootBody,base+' paymentPlan ownerPlan connectionToken treasureRootReceipt',base);
      if(body.treasureRootReceipt!==response.treasureRootReceipt||plan!==rootBody[owner?'ownerPlan':'paymentPlan']||
        record.connectionToken!==root.connectionToken)throw fail();
    }
  }
}
function completedResponse(record:TreasureServerRequest,journal:TreasureServerJournal,c:Context){
  const response=json(record.responseJson);object(response,record.purpose==='root'?'result treasureRootReceipt':'result');
  if(record.purpose==='actor-proof'){actorSignature(journal,c);return;}
  if(record.purpose==='root'&&!sealed(response.treasureRootReceipt))throw fail();
  object(response.result,'$type value');if(response.result.$type!=='transaction'||typeof response.result.value!=='string'||!/^(?:[a-f0-9]{2})+$/.test(response.result.value))throw fail();
  const before=preparedArguments(record,journal,c);if(!before)throw fail();
  const original=encoded(before),result=base64.encode(hex.decode(response.result.value)),tx=compare(result,before,c.allowed);
  assertTreasureSignatureRetention(original,result,tx.inputsLength,tx.outputsLength);
  for(let i=0;i<tx.inputsLength;i++){
    const previous=(before.getInput(i).tapScriptSig??[]).map(([k])=>hex.encode(k.pubKey));
    const actual=(tx.getInput(i).tapScriptSig??[]).map(([k])=>hex.encode(k.pubKey));
    if(actual.length!==previous.length+1||!actual.includes(c.t.game)||actual.some(k=>k!==c.t.game&&!previous.includes(k)))throw fail();
    verifyTapscriptSignatures(tx,i,[c.t.game],[],[0,1]);
  }
}
const edges:Record<TreasureServerRequestPhase,readonly TreasureServerRequestPhase[]>={
  prepared:['planned'],planned:['sign-pending'],'sign-pending':['sign-unknown','completed'],'sign-unknown':['completed'],completed:[],
};
function checked(value:unknown):Context{
  object(value,'version artifactVersion observationClock binding bindingCommitment requests');
  if(value.version!==1||value.artifactVersion!==4||value.observationClock!=='local-journal-not-server-admission'||stable(value).length>4_000_000)throw fail();
  const c=context(value.binding),journal=value as unknown as TreasureServerJournal;
  if(value.bindingCommitment!==commitment(c.b)||!Array.isArray(value.requests)||value.requests.length>102)throw fail();
  const ids=new Set<string>(),slots=new Set<string>();let rootSeen=false,actorSeen=false;
  for(const record of journal.requests){
    object(record,'purpose id argsJson checkpointIndex phase history bodyJson bodyDigest connectionToken responseJson','purpose id argsJson phase history');
    if(!id(record.id)||ids.has(record.id)||!['actor-proof','root','checkpoint'].includes(record.purpose)||
      !Array.isArray(record.history)||record.history.length<1||record.history.length>5)throw fail();ids.add(record.id);
    const slot=record.purpose+(record.purpose==='checkpoint'?':'+record.checkpointIndex:'');if(slots.has(slot))throw fail();slots.add(slot);
    if(record.purpose==='actor-proof'){if(rootSeen||actorSeen)throw fail();actorSeen=true;}
    if(record.purpose==='root'){if(rootSeen)throw fail();rootSeen=true;}
    if(record.purpose==='checkpoint'&&!rootSeen)throw fail();
    const history=record.history as TreasureServerRequest['history'];
    for(let i=0;i<history.length;i++){
      const step=history[i];object(step,'phase atMs');
      if(!Number.isSafeInteger(step.atMs)||step.atMs<c.t.startedAtMs||
        (i===0?step.phase!=='prepared':step.atMs<history[i-1].atMs||!edges[history[i-1].phase]?.includes(step.phase)))throw fail();
    }
    if(record.history.at(-1)!.phase!==record.phase)throw fail();preparedArguments(record,journal,c);
    const dependency=record.purpose==='root'&&c.b.kind==='spend'?journal.requests.find(r=>r.purpose==='actor-proof'):
      record.purpose==='checkpoint'?journal.requests.find(r=>r.purpose==='root'):undefined;
    if(dependency&&record.history[0].atMs<dependency.history.at(-1)!.atMs)throw fail();
    const planned=record.history.some(s=>s.phase==='planned');
    if(planned)plannedBody(record,journal,c);
    else if(['bodyJson','bodyDigest','connectionToken'].some(k=>Object.hasOwn(record,k)))throw fail();
    if(record.phase==='completed')completedResponse(record,journal,c);
    else if(Object.hasOwn(record,'responseJson'))throw fail();
  }
  return c;
}
export function validateTreasureServerJournal(value:unknown):asserts value is TreasureServerJournal{
  try{checked(value);}catch{throw fail();}
}
export function createTreasureServerJournal(binding:TreasureServerJournalBinding):TreasureServerJournal{
  try{context(binding);const value:TreasureServerJournal={version:1,artifactVersion:4,observationClock:'local-journal-not-server-admission',
    binding:structuredClone(binding),bindingCommitment:commitment(binding),requests:[]};checked(value);return freeze(value);}catch{throw fail();}
}
/** Persist the returned value in encrypted CAS before doing the corresponding
 * network work. No persistence or HTTP action is performed by this helper. */
export function prepareTreasureServerRequest(journal:TreasureServerJournal,request:TreasureServerRequestPreparation,atMs:number):TreasureServerJournal{
  try{checked(journal);object(request,'purpose id argsJson checkpointIndex','purpose id argsJson');
    const record:TreasureServerRequest={...structuredClone(request),phase:'prepared',history:[{phase:'prepared',atMs}]};
    const next={...journal,requests:[...journal.requests,record]};checked(next);return freeze(next);}catch{throw fail();}
}
export function transitionTreasureServerRequest(journal:TreasureServerJournal,requestId:string,event:TreasureServerRequestEvent):TreasureServerJournal{
  try{
    checked(journal);const current=journal.requests.find(r=>r.id===requestId);if(!current)throw fail();
    object(event,event.type==='planned'?'type atMs bodyJson connectionToken':event.type==='completed'?'type atMs responseJson':'type atMs');
    const phase=event.type;if(!edges[current.phase]?.includes(phase))throw fail();
    const next:TreasureServerRequest={...current,phase,history:[...current.history,{phase,atMs:event.atMs}],
      ...(event.type==='planned'?{bodyJson:event.bodyJson,bodyDigest:hash(event.bodyJson),connectionToken:event.connectionToken}:{}),
      ...(event.type==='completed'?{responseJson:event.responseJson}:{})};
    const value={...journal,requests:journal.requests.map(r=>r===current?next:r)};checked(value);return freeze(value);
  }catch{throw fail();}
}
/** One additive CAS step only. Imports cannot clear/replace/rewind an original. */
export function advanceTreasureServerJournal(before:TreasureServerJournal,after:TreasureServerJournal):void{
  try{
    checked(before);checked(after);if(!same(before.binding,after.binding)||before.bindingCommitment!==after.bindingCommitment)throw fail();
    let changes=after.requests.length-before.requests.length;if(changes<0||changes>1)throw fail();
    for(let i=0;i<before.requests.length;i++){
      const previous=before.requests[i],next=after.requests[i];if(same(previous,next))continue;
      changes++;if(changes!==1||previous.id!==next.id||previous.purpose!==next.purpose||previous.argsJson!==next.argsJson||
        previous.checkpointIndex!==next.checkpointIndex||next.history.length!==previous.history.length+1||
        !same(previous.history,next.history.slice(0,-1))||!edges[previous.phase].includes(next.phase)||
        ['bodyJson','bodyDigest','connectionToken','responseJson'].some(k=>Object.hasOwn(previous,k)&&Reflect.get(previous,k)!==Reflect.get(next,k)))throw fail();
    }
    if(after.requests.length>before.requests.length&&after.requests.at(-1)!.phase!=='prepared')throw fail();
  }catch{throw fail();}
}
/** Private read-only lookup coordinates, never an authorization grant. */
export function treasureServerResultLookup(journal:TreasureServerJournal,requestId:string){
  try{checked(journal);const record=journal.requests.find(r=>r.id===requestId);
    if(!record||!['sign-pending','sign-unknown','completed'].includes(record.phase)||!record.bodyDigest)throw fail();
    return Object.freeze({scope:`${journal.binding.gameId}:${journal.binding.network}:${journal.binding.profileId}`,id:record.id,digest:record.bodyDigest});
  }catch{throw fail();}
}
