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
  const source=new Transaction({version:3});source.addInput({txid:'ab'.repeat(32),index:0,witnessUtxo:{script:gameScript.pkScript,amount:1500n}});
  source.addOutput({script:gameScript.pkScript,amount:1500n});source.addOutput({script:hex.decode('51024e73'),amount:0n});
  const point={txid:source.id,vout:0,value:1500};
  const pair=buildOffchainTx([{...point,tapLeafScript:gameScript.forfeit(),tapTree:gameScript.encode()}],
    [{script:built.script.pkScript,amount:1000n},{script:gameScript.pkScript,amount:500n}],unroll);
  const ledger=startLto(emptyContractLedger(),{id:contractId,sessionId:terms.offerSessionId,operationId:fundId,purpose:'treasureLTO',hostReference:terms.hostReference,
    amountSats:1000,startedAt:start,expiresAt:built.deadlineSeconds*1000,scope:{...scope,operator:'https://mutinynet.arkade.sh',exclusivityKey:'server-journal-slot'}},start).ledger;
  const document:ContractDocument={version:1,revision:0,ledger:{...ledger,contracts:ledger.contracts.map(r=>({...r,validationMode:'arkade-covenant-v2'}))},recovery:{[contractId]:{
    treasureArtifactVersion:4,treasure:terms,playerKey:terms.player,gameKey:terms.game,operatorKey:terms.operator,exitDelay:'2048',
    gameScript:hex.encode(gameScript.encode()),playerScript:hex.encode(playerScript.encode()),contractScript:hex.encode(built.script.encode()),
    spend:{operationId:fundId,transactionId:pair.arkTx.id,inputs:[point],destinationScript:hex.encode(built.script.pkScript),amountSats:1000,
      change:{script:hex.encode(gameScript.pkScript),value:500}}}}};
  const common={artifactVersion:4 as const,contractId,operationId:fundId,endpoint:'https://server-journal.invalid/api/bis/',gameId:'stealth-and-steel',
    network:scope.network,profileId:scope.gameId,publicKey:gamePublic,authority:'player-proof' as const,terms,checkpointTapscript:hex.encode(unroll.script)};
  const binding:TreasureServerJournalBinding={...common,kind:'fund',original:{arkTx:encoded(pair.arkTx),checkpoints:pair.checkpoints.map(encoded)},sourceTransactions:[hex.encode(source.toBytes(false,false))]};
  return {document,binding,common,terms,built,unroll,source,point,pair,funding:{txid:pair.arkTx.id,vout:0,value:1000 as const}};
}
function replace(document:ContractDocument,map:Readonly<Record<string,TreasureServerJournal>>|undefined,recovery:Partial<ContractRecovery>={}):ContractDocument{
  const next=Object.fromEntries(Object.entries({...document.recovery[contractId],treasureServerJournals:map,...recovery})
    .filter(([,value])=>value!==undefined)) as ContractRecovery;
  return {...document,recovery:{...document.recovery,[contractId]:next}};
}
function journalStates(f:ReturnType<typeof fixture>){
  const empty=createTreasureServerJournal(f.binding),argsJson=JSON.stringify(encodeSigningValue([f.pair.arkTx,[0]]));
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
function shadow(){const rows=new Map<string,string>();return {getItem:(key:string)=>rows.get(key)??null,setItem:(key:string,value:string)=>{rows.set(key,value);},
  removeItem:(key:string)=>{rows.delete(key);},clear:()=>rows.clear(),key:(index:number)=>[...rows.keys()][index]??null,get length(){return rows.size;}} satisfies Storage;}
function spendBinding(f:ReturnType<typeof fixture>):TreasureServerJournalBinding{
  const leaf=f.built.script.functionByName('refund')!,packet=Extension.create([EmulatorPacket.create([{vin:0,script:leaf.arkadeScript!,witness:RawWitness.encode([new Uint8Array(64)])}])]);
  const pair=buildOffchainTx([{...f.funding,tapLeafScript:leaf.tapLeafScript,tapTree:f.built.script.encode()}],
    [{script:hex.decode('5120'+f.terms.gameDestination),amount:1000n},packet.txOut()],f.unroll);
  const previousTransaction=hex.encode(f.pair.arkTx.toBytes(false,false));setArkPsbtField(pair.arkTx,0,PrevArkTxField,hex.decode(previousTransaction));
  return {...f.common,operationId:refundId,authority:'owner',kind:'spend',branch:'refund',funding:f.funding,previousTransaction,
    actorTemplate:{arkTx:encoded(pair.arkTx),checkpoint:encoded(pair.checkpoints[0])}};
}
async function newRefund(document:ContractDocument,f:ReturnType<typeof fixture>,db:ReturnType<typeof backend>){
  // Offline injected receipt fact only. The signing response is not used to
  // infer financial confirmation; production adapters must verify a receipt.
  const funded=finishContractOperation(document.ledger.contracts[0],{operationId:fundId,kind:'fund',outcome:'confirmed'});
  document=await db.storage.save({...replace(document,document.recovery[contractId].treasureServerJournals,{fundingOutput:f.funding}),ledger:{...document.ledger,contracts:[funded]}});
  const original=document.recovery[contractId].treasureServerJournals![fundId];
  const signed=await game.sign(f.pair.arkTx,[0]);
  const completed=transitionTreasureServerRequest(original,'original-root-request',{type:'completed',atMs:start+90_000,
    responseJson:JSON.stringify({result:encodeSigningValue(signed),treasureRootReceipt:receipt})});
  document=await db.storage.save(replace(document,{[fundId]:completed}));
  const record=beginContractOperation(document.ledger.contracts[0],'refund',refundId,start+91_000),binding=spendBinding(f),journal=createTreasureServerJournal(binding);
  document=await db.storage.save({...replace(document,{...document.recovery[contractId].treasureServerJournals,[refundId]:journal},{spend:undefined}),ledger:{...document.ledger,contracts:[record]}});
  return {document,binding,journal};
}

test('encrypted CAS persists every server request phase and refuses skipped, stale or failed writes',async()=>{
  const {f,states}=await fixtures(),db=backend();let document=await db.storage.save(f.document);
  document=await db.storage.save(replace(document,{[fundId]:states.empty}));
  await assert.rejects(db.storage.save(replace(document,{[fundId]:states.planned})),'a planned request cannot skip its prepared write');
  document=await db.storage.save(replace(document,{[fundId]:states.prepared}));
  const stale=document;document=await db.storage.save(replace(document,{[fundId]:states.planned}));
  db.failNext();let externalRequests=0;
  await assert.rejects(db.storage.save(replace(document,{[fundId]:states.pending})).then(()=>{externalRequests++;}));
  assert.equal(externalRequests,0);assert.deepEqual(await db.storage.load(),document);
  document=await db.storage.save(replace(document,{[fundId]:states.pending}));
  document=await db.storage.save(replace(document,{[fundId]:states.unknown}));
  await assert.rejects(db.storage.save(stale));await assert.rejects(db.storage.save(replace(document,{[fundId]:states.pending})));
  await assert.rejects(db.storage.save(replace(document,undefined)));await assert.rejects(db.storage.reset());
  const loaded=await createContractStorage(db.db,scope.network).load();assert.deepEqual(loaded,document);
  const journal=loaded.recovery[contractId].treasureServerJournals![fundId];
  assert.equal(journal.requests[0].bodyJson,states.bodyJson);assert.equal(journal.requests[0].connectionToken,connection);
  assert.equal(journal.requests[0].phase,'sign-unknown');assert.equal(loaded.ledger.contracts[0].financial,'funding');
  assert.equal(db.peek()!.key.extractable,false);assert.equal(JSON.stringify(db.peek()).includes(plan),false);
  assert.equal(JSON.stringify(presentContract(loaded.ledger.contracts[0],start+2000)).includes('treasureServerJournals'),false);
});

test('explicit password export/import retains exact unknown wire bytes without enabling restored actions',async()=>{
  const {document,states}=await savedUnknown(),password='synthetic private server recovery password';
  const file=await exportContractRecovery(document,scope,password);assert.equal(file.includes(plan),false);assert.equal(file.includes(states.bodyJson),false);
  const incoming=await decryptContractRecovery(file,scope,password),target=backend();
  const imported=await target.storage.save(mergeContractRecovery(await target.storage.load(),incoming,scope));
  assert.deepEqual(imported.recovery[contractId].treasureServerJournals,document.recovery[contractId].treasureServerJournals);
  assert.equal(imported.ledger.contracts[0].recoveryRequired,true);assert.equal(presentContract(imported.ledger.contracts[0],start+2000).canClaim,false);
  assert.deepEqual(treasureServerResultLookup(imported.recovery[contractId].treasureServerJournals![fundId],'original-root-request'),
    treasureServerResultLookup(states.unknown,'original-root-request'));
  await assert.rejects(target.storage.reset());
  const stale=replace(incoming,{[fundId]:states.planned});assert.throws(()=>mergeContractRecovery(imported,stale,scope));
  assert.deepEqual(await target.storage.load(),imported);
});

test('mixed versions, foreign identities, malformed maps and mismatched original inputs fail closed',async()=>{
  const {f,states}=await fixtures(),db=backend(),document=await db.storage.save(replace(f.document,{[fundId]:states.empty}));
  for(const map of [null,[],{foreignOperation:states.empty},JSON.parse('{"__proto__":{}}'),{constructor:states.empty}])
    await assert.rejects(db.storage.save(replace(document,map as never)));
  for(const patch of [{treasureArtifactVersion:3},{treasureArtifactVersion:undefined},{fundingOutput:{...f.funding,txid:'11'.repeat(32)}},
    {spend:{...document.recovery[contractId].spend!,inputs:[{...f.point,txid:'22'.repeat(32)}]}}])
    await assert.rejects(db.storage.save(replace(document,{[fundId]:states.empty},patch as Partial<ContractRecovery>)));
  const foreignScope={...document.ledger.contracts[0].scope,gameId:'ff'.repeat(32)};
  const foreign={...document,ledger:{...document.ledger,contracts:[{...document.ledger.contracts[0],scope:foreignScope}],
    attempts:document.ledger.attempts.map(attempt=>({...attempt,scope:foreignScope}))}};
  await assert.rejects(db.storage.save(foreign));
  const otherTerms=fixture('another-run'),validForeignJournal=createTreasureServerJournal(otherTerms.binding);
  await assert.rejects(db.storage.save(replace(document,{[fundId]:validForeignJournal})),'a valid journal for other terms cannot replace this contract');
  const missingFund={...replace(document,{[refundId]:createTreasureServerJournal(spendBinding(f))},{spend:undefined}),
    ledger:{...document.ledger,contracts:[{...document.ledger.contracts[0],financial:'refunding' as const,operation:{id:refundId,kind:'refund' as const,submission:'prepared' as const}}]}};
  assert.throws(()=>validateContractDocument(missingFund),'a spend journal cannot create its own funded recovery descriptor');
  const changed=structuredClone(document);(changed.recovery[contractId].treasureServerJournals![fundId].binding.terms as {hostReference:string}).hostReference='another-run';
  await assert.rejects(db.storage.save(changed));assert.deepEqual(await db.storage.load(),document);
});

test('completed historical funding survives a later spend without enabling new old-operation requests',async()=>{
  const setup=await savedUnknown(),{f,db}=setup,current=await newRefund(setup.document,f,db);let document=current.document;
  const completed=document.recovery[contractId].treasureServerJournals![fundId];
  assert.equal(completed.requests[0].phase,'completed');
  assert.equal(document.recovery[contractId].treasureServerJournals![refundId].binding.authority,'owner');
  const b=current.binding;if(b.kind!=='spend')throw Error('Expected spend binding');
  const message=treasureAuthorizationDigest(f.terms,'refund',{arkTx:Transaction.fromPSBT(base64.decode(b.actorTemplate.arkTx)),checkpoint:Transaction.fromPSBT(base64.decode(b.actorTemplate.checkpoint)),funding:b.funding,checkpointTapscript:f.unroll});
  const actor=prepareTreasureServerRequest(current.journal,{purpose:'actor-proof',id:'refund-actor',argsJson:JSON.stringify(encodeSigningValue([message,'schnorr']))},start+92_000);
  await assert.rejects(db.storage.save(replace(document,{[refundId]:current.journal})),'changing operation cannot discard funding recovery');
  document=await db.storage.save(replace(document,{[fundId]:completed,[refundId]:actor}));
  assert.equal(document.ledger.contracts[0].financial,'refunding','a signing result is not a financial receipt');
  const cp=await operator.sign(f.pair.checkpoints[0],[0]);
  const oldAppend=prepareTreasureServerRequest(completed,{purpose:'checkpoint',id:'late-old-checkpoint',checkpointIndex:0,argsJson:JSON.stringify(encodeSigningValue([cp,[0]]))},start+92_001);
  await assert.rejects(db.storage.save(replace(document,{[fundId]:oldAppend,[refundId]:actor})),'old operations cannot allocate requests');
  const moved={...current.journal.binding,endpoint:'https://foreign.invalid/api/bis/'};
  await assert.rejects(db.storage.save(replace(document,{[fundId]:completed,[refundId]:createTreasureServerJournal(moved)})));
  assert.deepEqual(await db.storage.load(),document);
});
test('financial non-submission cannot discard private unknowns or clear the pre-cleanup reservation shadow',async()=>{
  const setup=await savedUnknown(),{db,f}=setup;
  // No financial POST was made in this synthetic case. Its known non-submission
  // does not settle the independent lost Game signing acknowledgement.
  const terminal=finishContractOperation(setup.document.ledger.contracts[0],{operationId:fundId,kind:'fund',outcome:'not-submitted'});
  const document=await db.storage.save({...setup.document,ledger:{...setup.document.ledger,contracts:[terminal]}}),storage=shadow();
  reserveContract(terminal,document.recovery[contractId],storage);publishContractReservations(document,storage);
  const [reserved]=readContractReservations(scope.network,storage);assert.equal(reserved.pending,true);
  assert.equal(reserved.gameId,scope.gameId);assert.equal(reserved.playerId,scope.playerId);
  assert.ok(reserved.inputs?.some(p=>p.txid===f.point.txid&&p.vout===f.point.vout));
  assert.equal(JSON.stringify(reserved).includes(plan),false);assert.equal(JSON.stringify(reserved).includes('bodyJson'),false);
  await assert.rejects(db.storage.reset());assert.equal(treasureServerRecoveryPending(document.recovery[contractId]),true);
  const password='synthetic resolved private unknown password',file=await exportContractRecovery(document,scope,password),incoming=await decryptContractRecovery(file,scope,password),target=backend();
  assert.equal(incoming.ledger.contracts[0].financial,'failed');assert.equal(incoming.ledger.contracts[0].recoveryRequired,true);
  const imported=await target.storage.save(mergeContractRecovery(await target.storage.load(),incoming,scope));await assert.rejects(target.storage.reset());
  assert.deepEqual(imported.recovery[contractId].treasureServerJournals,document.recovery[contractId].treasureServerJournals);
  const signed=await game.sign(f.pair.arkTx,[0]),completed=transitionTreasureServerRequest(setup.states.unknown,'original-root-request',{
    type:'completed',atMs:start+93_000,responseJson:JSON.stringify({result:encodeSigningValue(signed),treasureRootReceipt:receipt})});
  const saved=await db.storage.save(replace(document,{[fundId]:completed}));
  assert.equal(saved.ledger.contracts[0].financial,'failed');
  publishContractReservations(saved,storage);assert.equal(readContractReservations(scope.network,storage)[0].pending,false);
  await db.storage.reset();assert.equal((await db.storage.load()).ledger.contracts.length,0);
});