import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SingleKey,Transaction,DefaultVtxo,CSVMultisigTapscript,buildOffchainTx,Extension,EmulatorPacket,PrevArkTxField,setArkPsbtField} from '@arkade-os/sdk';
import {RawWitness} from '@scure/btc-signer';
import {base64,hex} from '@scure/base';
import {createContractStorage,validateContractDocument,type ContractDocument,type ContractRecovery,type ContractBackend} from '../../src/client/state-layer-core/contract-storage.ts';
import {emptyContractLedger,startLto,finishContractOperation,beginContractOperation,presentContract,type ContractRecord} from '../../src/client/state-layer-core/contracts.ts';
import {exportContractRecovery,decryptContractRecovery,mergeContractRecovery} from '../../src/client/state-layer-core/contract-portable-recovery.ts';
import {publishContractReservations,reserveContract,readContractReservations} from '../../src/client/state-layer-core/contract-reservations.ts';
import {treasureServerRecoveryPending} from '../../src/client/state-layer-core/treasure-server-recovery.ts';
import {createTreasureServerJournal,prepareTreasureServerRequest,transitionTreasureServerRequest,treasureServerResultLookup,
  type TreasureServerJournal,type TreasureServerJournalBinding} from '../../src/client/wallet-layer-arkade/treasure-server-journal.ts';
import {buildAuthorizedTreasureScript,treasureAuthorizationDigest} from '../../src/client/wallet-layer-arkade/treasure-authorized-script.ts';
import {encodeSigningValue} from '../../src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import {TREASURE_EMULATOR} from '../../src/client/wallet-layer-arkade/treasure-capability.ts';

// Public synthetic SDK transactions and local signatures. Financial reducer
// transitions below are injected test facts, not provider/network acceptance.
const [player,game,operator]=[1,2,3].map(n=>SingleKey.fromHex(n.toString(16).padStart(64,'0')));
const [playerPublic,gamePublic,operatorPublic]=await Promise.all([player,game,operator].map(async key=>hex.encode(await key.compressedPublicKey())));
const profile=(publicKey:string)=>createHash('sha256').update(hex.decode(publicKey)).digest('hex');
const scope={network:'mutinynet' as const,playerId:profile(playerPublic),gameId:profile(gamePublic)};
const contractId='server-journal-contract',fundId='server-journal-fund',refundId='server-journal-refund',start=1_800_000_000_123;
const token=(label:string)=>label+'.'+'a'.repeat(43),connection=token('original-connection'),plan=token('original-plan'),receipt=token('original-receipt');
const encoded=(tx:Transaction)=>base64.encode(tx.toPSBT());
function backend(){
  let envelope:Awaited<ReturnType<ContractBackend['read']>>,fail=false,writes=0;
  const db:ContractBackend={read:async()=>structuredClone(envelope),write:async(value,revision)=>{
    if(fail){fail=false;throw Error('Synthetic write failure');}
    if((envelope?.revision??0)!==revision)throw Error('CAS conflict');envelope=structuredClone(value);writes++;
  }};
  return {db,peek:()=>envelope,writes:()=>writes,failNext:()=>{fail=true;},storage:createContractStorage(db,scope.network)};
}
const wallet=(key:string)=>new DefaultVtxo.Script({pubKey:hex.decode(key.slice(2)),serverPubKey:hex.decode(operatorPublic.slice(2)),csvTimelock:{type:'seconds',value:2048n}});
function fixture(hostReference='server-journal-run'){
  const playerScript=wallet(playerPublic),gameScript=wallet(gamePublic),terms={network:scope.network,offerSessionId:'server-journal-offer',hostReference,startedAtMs:start,
    player:playerPublic.slice(2),game:gamePublic.slice(2),operator:operatorPublic.slice(2),emulator:TREASURE_EMULATOR.key.slice(2),
    playerDestination:hex.encode(playerScript.pkScript.slice(2)),gameDestination:hex.encode(gameScript.pkScript.slice(2)),exitDelay:2048};
  const built=buildAuthorizedTreasureScript(terms),unroll=CSVMultisigTapscript.encode({pubkeys:[hex.decode(terms.operator)],timelock:{type:'seconds',value:2048n}});
  const source=new Transaction({version:3});source.addInput({txid:'ab'.repeat(32),index:0,witnessUtxo:{script:gameScript.pkScript,amount:3000n}});
  source.addOutput({script:gameScript.pkScript,amount:1500n});source.addOutput({script:gameScript.pkScript,amount:1500n});source.addOutput({script:hex.decode('51024e73'),amount:0n});
  const point={txid:source.id,vout:0,value:1500};
  const points=[point,{...point,vout:1}];
  const pair=buildOffchainTx(points.map(p=>({...p,tapLeafScript:gameScript.forfeit(),tapTree:gameScript.encode()})),
    [{script:built.script.pkScript,amount:1000n},{script:gameScript.pkScript,amount:2000n}],unroll);
  const ledger=startLto(emptyContractLedger(),{id:contractId,sessionId:terms.offerSessionId,operationId:fundId,purpose:'treasureLTO',hostReference:terms.hostReference,
    amountSats:1000,startedAt:start,expiresAt:built.deadlineSeconds*1000,scope:{...scope,operator:'https://mutinynet.arkade.sh',exclusivityKey:'server-journal-slot'}},start).ledger;
  const document:ContractDocument={version:1,revision:0,ledger:{...ledger,contracts:ledger.contracts.map(r=>({...r,validationMode:'arkade-covenant-v2'}))},recovery:{[contractId]:{
    treasureArtifactVersion:4,treasure:terms,playerKey:terms.player,gameKey:terms.game,operatorKey:terms.operator,exitDelay:'2048',
    gameScript:hex.encode(gameScript.encode()),playerScript:hex.encode(playerScript.encode()),contractScript:hex.encode(built.script.encode()),
    spend:{operationId:fundId,transactionId:pair.arkTx.id,inputs:points,destinationScript:hex.encode(built.script.pkScript),amountSats:1000,
      change:{script:hex.encode(gameScript.pkScript),value:2000}}}}};
  const common={artifactVersion:4 as const,contractId,operationId:fundId,endpoint:'https://server-journal.invalid/api/bis/',gameId:'stealth-and-steel',
    network:scope.network,profileId:scope.gameId,publicKey:gamePublic,authority:'player-proof' as const,terms,checkpointTapscript:hex.encode(unroll.script)};
  const binding:TreasureServerJournalBinding={...common,kind:'fund',original:{arkTx:encoded(pair.arkTx),checkpoints:pair.checkpoints.map(encoded)},sourceTransactions:[hex.encode(source.toBytes(false,false))]};
  return {document,binding,common,terms,built,unroll,source,point,points,pair,funding:{txid:pair.arkTx.id,vout:0,value:1000 as const}};
}
function replace(document:ContractDocument,map:Readonly<Record<string,TreasureServerJournal>>|undefined,recovery:Partial<ContractRecovery>={}):ContractDocument{
  const next=Object.fromEntries(Object.entries({...document.recovery[contractId],treasureServerJournals:map,...recovery})
    .filter(([,value])=>value!==undefined)) as ContractRecovery;
  return {...document,recovery:{...document.recovery,[contractId]:next}};
}
function journalStates(f:ReturnType<typeof fixture>){
  const empty=createTreasureServerJournal(f.binding),argsJson=JSON.stringify(encodeSigningValue([f.pair.arkTx,[0,1]]));
  const prepared=prepareTreasureServerRequest(empty,{purpose:'root',id:'original-root-request',argsJson},start+1000);
  const bodyJson=JSON.stringify({id:'original-root-request',operationId:fundId,method:'sign',network:scope.network,profileId:scope.gameId,
    args:JSON.parse(argsJson),paymentPlan:plan});
  const planned=transitionTreasureServerRequest(prepared,'original-root-request',{type:'planned',bodyJson,connectionToken:connection,atMs:start+1001});
  const pending=transitionTreasureServerRequest(planned,'original-root-request',{type:'sign-pending',atMs:start+1002});
  const unknown=transitionTreasureServerRequest(pending,'original-root-request',{type:'sign-unknown',atMs:start+1003});
  return {empty,prepared,planned,pending,unknown,bodyJson};
}
let shared:Promise<{f:ReturnType<typeof fixture>;states:ReturnType<typeof journalStates>}>|undefined;
const fixtures=()=>shared??=Promise.resolve().then(()=>{const f=fixture();return {f,states:journalStates(f)};});
async function savedUnknown(){
  const {f,states}=await fixtures(),db=backend();let document=await db.storage.save(f.document);
  for(const journal of [states.empty,states.prepared,states.planned,states.pending,states.unknown])document=await db.storage.save(replace(document,{[fundId]:journal}));
  return {f,states,db,document};
}
async function completeRoot(journal:TreasureServerJournal,f:ReturnType<typeof fixture>,atMs=start+2000){
  const signed=await game.sign(f.pair.arkTx,[0,1]);
  return transitionTreasureServerRequest(journal,'original-root-request',{type:'completed',atMs,
    responseJson:JSON.stringify({result:encodeSigningValue(signed),treasureRootReceipt:receipt})});
}
function record(document:ContractDocument,value:ContractRecord):ContractDocument{
  return {...document,ledger:{...document.ledger,contracts:[value]}};
}
function replacement(document:ContractDocument,f:ReturnType<typeof fixture>,kind:'fund'|'refund'='refund'){
  const current=document.ledger.contracts[0];
  const next:ContractRecord={...current,financial:kind==='fund'?'funding':'refunding',
    operation:{id:'replacement-operation',kind,submission:'prepared'}};
  return record(replace(document,document.recovery[contractId].treasureServerJournals,{spend:undefined,fundingOutput:f.funding}),next);
}

test('unknown original signing pins operation identity even when its result completes in the same encrypted save',async t=>{
  let requests=0;t.mock.method(globalThis,'fetch',async()=>{requests++;throw Error('No provider in synthetic journal test');});
  const {f,db,document}=await savedUnknown(),writes=db.writes();
  for(const kind of ['fund','refund'] as const){
    const candidate=replacement(document,f,kind);validateContractDocument(candidate);
    await assert.rejects(db.storage.save(candidate));assert.equal(db.writes(),writes);
  }
  const completed=await completeRoot(document.recovery[contractId].treasureServerJournals![fundId],f);
  const sameSave=replace(replacement(document,f),{[fundId]:completed});validateContractDocument(sameSave);
  await assert.rejects(db.storage.save(sameSave));assert.deepEqual(await db.storage.load(),document);
  assert.equal(requests,0);assert.equal(db.peek()!.key.extractable,false);
});

test('original pending and unknown results reconcile monotonically, with financial receipt observation kept separate',async()=>{
  const {f,states}=await fixtures(),db=backend();let document=await db.storage.save(f.document);
  for(const journal of [states.empty,states.prepared,states.planned,states.pending])document=await db.storage.save(replace(document,{[fundId]:journal}));
  document=await db.storage.save(replace(document,{[fundId]:states.unknown}));
  const funded=finishContractOperation(document.ledger.contracts[0],{operationId:fundId,kind:'fund',outcome:'confirmed'});
  document=await db.storage.save(record(replace(document,{[fundId]:states.unknown},{fundingOutput:f.funding}),funded));
  assert.equal(document.ledger.contracts[0].financial,'funded');assert.equal(treasureServerRecoveryPending(document.recovery[contractId]),true);
  const completed=await completeRoot(states.unknown,f);
  document=await db.storage.save(replace(document,{[fundId]:completed}));
  assert.equal(document.ledger.contracts[0].operation.id,fundId);assert.equal(document.ledger.contracts[0].financial,'funded');
  assert.equal(treasureServerRecoveryPending(document.recovery[contractId]),false);
  const next=beginContractOperation(funded,'refund',refundId,start+91_000);
  document=await db.storage.save(record(replace(document,{[fundId]:completed},{spend:undefined}),next));
  assert.equal(document.ledger.contracts[0].operation.id,refundId,'new action requires a later CAS');
});

test('financial non-submission remains distinct from an unresolved signing acknowledgement',async()=>{
  const {db,document}=await savedUnknown();
  const failed=finishContractOperation(document.ledger.contracts[0],{operationId:fundId,kind:'fund',outcome:'not-submitted'});
  const saved=await db.storage.save(record(document,failed));assert.equal(saved.ledger.contracts[0].financial,'failed');
  assert.equal(treasureServerRecoveryPending(saved.recovery[contractId]),true);await assert.rejects(db.storage.reset());
});

async function checkpointUnknown(second:'absent'|'prepared'|'planned'){
  const {f,states}=await fixtures(),db=backend();let document=await db.storage.save(f.document);
  for(const journal of [states.empty,states.prepared,states.planned,states.pending])document=await db.storage.save(replace(document,{[fundId]:journal}));
  let journal=await completeRoot(states.pending,f);document=await db.storage.save(replace(document,{[fundId]:journal}));
  const prepare=async(index:number)=>{
    const cp=await operator.sign(f.pair.checkpoints[index],[0]);
    return {purpose:'checkpoint' as const,id:'original-checkpoint-'+index,checkpointIndex:index,argsJson:JSON.stringify(encodeSigningValue([cp,[0]]))};
  };
  const planCheckpoint=(j:TreasureServerJournal,id:string,atMs:number)=>{
    const request=j.requests.find(r=>r.id===id)!;
    return transitionTreasureServerRequest(j,id,{type:'planned',atMs,connectionToken:connection,
      bodyJson:JSON.stringify({id,operationId:fundId,method:'sign',network:scope.network,profileId:scope.gameId,
        args:JSON.parse(request.argsJson),paymentPlan:plan,treasureRootReceipt:receipt})});
  };
  const first=await prepare(0),other=await prepare(1);
  const save=async(next:TreasureServerJournal)=>{journal=next;document=await db.storage.save(replace(document,{[fundId]:journal}));};
  await save(prepareTreasureServerRequest(journal,first,start+3000));await save(planCheckpoint(journal,first.id,start+3001));
  if(second!=='absent')await save(prepareTreasureServerRequest(journal,other,start+3002));
  if(second==='planned')await save(planCheckpoint(journal,other.id,start+3003));
  await save(transitionTreasureServerRequest(journal,first.id,{type:'sign-pending',atMs:start+3004}));
  await save(transitionTreasureServerRequest(journal,first.id,{type:'sign-unknown',atMs:start+3005}));
  return {f,db,document,journal,first,other,planCheckpoint};
}
test('unknown checkpoints prohibit allocating or advancing a different exact signing request',async()=>{
  for(const phase of ['absent','prepared','planned'] as const){
    const s=await checkpointUnknown(phase),writes=s.db.writes();
    const candidate=phase==='absent'?prepareTreasureServerRequest(s.journal,s.other,start+4000):
      phase==='prepared'?s.planCheckpoint(s.journal,s.other.id,start+4000):
      transitionTreasureServerRequest(s.journal,s.other.id,{type:'sign-pending',atMs:start+4000});
    const proposed=replace(s.document,{[fundId]:candidate});validateContractDocument(proposed);
    await assert.rejects(s.db.storage.save(proposed));assert.equal(s.db.writes(),writes);assert.deepEqual(await s.db.storage.load(),s.document);
  }
});

test('restored historical unknown authority prevents adding a current-operation journal',async()=>{
  const {f,states}=await fixtures();
  const funded=finishContractOperation(f.document.ledger.contracts[0],{operationId:fundId,kind:'fund',outcome:'confirmed'});
  const current={...beginContractOperation(funded,'refund',refundId,start+91_000),recoveryRequired:true};
  const legacy=record(replace(f.document,{[fundId]:states.unknown},{fundingOutput:f.funding,spend:undefined}),current);
  validateContractDocument(legacy);const db=backend(),document=await db.storage.save(legacy);
  const leaf=f.built.script.functionByName('refund')!,packet=Extension.create([EmulatorPacket.create([{vin:0,script:leaf.arkadeScript!,witness:RawWitness.encode([new Uint8Array(64)])}])]);
  const pair=buildOffchainTx([{...f.funding,tapLeafScript:leaf.tapLeafScript,tapTree:f.built.script.encode()}],
    [{script:hex.decode('5120'+f.terms.gameDestination),amount:1000n},packet.txOut()],f.unroll);
  const previousTransaction=hex.encode(f.pair.arkTx.toBytes(false,false));setArkPsbtField(pair.arkTx,0,PrevArkTxField,hex.decode(previousTransaction));
  const journal=createTreasureServerJournal({...f.common,operationId:refundId,authority:'owner',kind:'spend',branch:'refund',funding:f.funding,
    previousTransaction,actorTemplate:{arkTx:encoded(pair.arkTx),checkpoint:encoded(pair.checkpoints[0])}});
  const candidate=replace(document,{[fundId]:states.unknown,[refundId]:journal});validateContractDocument(candidate);
  await assert.rejects(db.storage.save(candidate));assert.deepEqual(await db.storage.load(),document);
});
