import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SingleKey,Transaction,DefaultVtxo,CSVMultisigTapscript,buildOffchainTx} from '@arkade-os/sdk';
import {base64,hex} from '@scure/base';
import {createContractStorage,validateContractDocument,type ContractBackend,type ContractDocument,type ContractRecovery} from '../../src/client/state-layer-core/contract-storage.ts';
import {emptyContractLedger,startLto,beginContractOperation,finishContractOperation,validateContractLedger,contractResolved,presentContract,
  type ContractLedger,type ContractRecord} from '../../src/client/state-layer-core/contracts.ts';
import {exportContractRecovery,decryptContractRecovery,mergeContractRecovery} from '../../src/client/state-layer-core/contract-portable-recovery.ts';
import {publishContractReservations,readContractReservations} from '../../src/client/state-layer-core/contract-reservations.ts';
import {createTreasureServerJournal,prepareTreasureServerRequest,transitionTreasureServerRequest,type TreasureServerJournal} from '../../src/client/wallet-layer-arkade/treasure-server-journal.ts';
import {buildAuthorizedTreasureScript} from '../../src/client/wallet-layer-arkade/treasure-authorized-script.ts';
import {encodeSigningValue} from '../../src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import {TREASURE_EMULATOR} from '../../src/client/wallet-layer-arkade/treasure-capability.ts';
import {inspectContractDocument} from '../../src/client/state-layer-core/lto-service.ts';

// Public synthetic transactions/local keys. Terminal financial states are
// injected offline facts, not signing-result inference or network receipts.
const [player,game,operator]=[1,2,3].map(n=>SingleKey.fromHex(n.toString(16).padStart(64,'0')));
const [playerPublic,gamePublic,operatorPublic]=await Promise.all([player,game,operator].map(async key=>hex.encode(await key.compressedPublicKey())));
const profile=(key:string)=>createHash('sha256').update(hex.decode(key)).digest('hex');
const scope={network:'mutinynet' as const,playerId:profile(playerPublic),gameId:profile(gamePublic)};
const slot={...scope,operator:'https://mutinynet.arkade.sh',exclusivityKey:'one-history-slot'};
const sealed=(name:string)=>name+'.'+'a'.repeat(43),connection=sealed('original-connection'),plan=sealed('original-plan');
const encoded=(tx:Transaction)=>base64.encode(tx.toPSBT());
function db(){
  let saved:Awaited<ReturnType<ContractBackend['read']>>,writes=0;
  const backend:ContractBackend={read:async()=>structuredClone(saved),write:async(value,revision)=>{
    if((saved?.revision??0)!==revision)throw Error('CAS conflict');saved=structuredClone(value);writes++;
  }};
  return {storage:createContractStorage(backend,scope.network),writes:()=>writes};
}
function shadow(){const rows=new Map<string,string>();return {getItem:(key:string)=>rows.get(key)??null,setItem:(key:string,value:string)=>{rows.set(key,value);},
  removeItem:(key:string)=>{rows.delete(key);},clear:()=>rows.clear(),key:(index:number)=>[...rows.keys()][index]??null,get length(){return rows.size;}} satisfies Storage;}
function fixture(index:number,financial:'claimed'|'refunded'='refunded'){
  const startedAt=1_800_000_000_123+index*100_000,id='old-history-'+index,fundId='old-fund-'+index,sessionId='old-session-'+index;
  const wallet=(key:string)=>new DefaultVtxo.Script({pubKey:hex.decode(key.slice(2)),serverPubKey:hex.decode(operatorPublic.slice(2)),csvTimelock:{type:'seconds',value:2048n}});
  const playerScript=wallet(playerPublic),gameScript=wallet(gamePublic),terms={network:scope.network,offerSessionId:sessionId,hostReference:'old-run-'+index,startedAtMs:startedAt,
    player:playerPublic.slice(2),game:gamePublic.slice(2),operator:operatorPublic.slice(2),emulator:TREASURE_EMULATOR.key.slice(2),
    playerDestination:hex.encode(playerScript.pkScript.slice(2)),gameDestination:hex.encode(gameScript.pkScript.slice(2)),exitDelay:2048};
  const built=buildAuthorizedTreasureScript(terms),unroll=CSVMultisigTapscript.encode({pubkeys:[hex.decode(terms.operator)],timelock:{type:'seconds',value:2048n}});
  const source=new Transaction({version:3});source.addInput({txid:index.toString(16).padStart(2,'0').repeat(32),index:0,witnessUtxo:{script:gameScript.pkScript,amount:1500n}});
  source.addOutput({script:gameScript.pkScript,amount:1500n});source.addOutput({script:hex.decode('51024e73'),amount:0n});
  const sourcePoint={txid:source.id,vout:0,value:1500},pair=buildOffchainTx([{...sourcePoint,tapLeafScript:gameScript.forfeit(),tapTree:gameScript.encode()}],
    [{script:built.script.pkScript,amount:1000n},{script:gameScript.pkScript,amount:500n}],unroll);
  const request={scope:slot,id,sessionId,operationId:fundId,purpose:'treasureLTO',hostReference:terms.hostReference,amountSats:1000,startedAt,expiresAt:built.deadlineSeconds*1000};
  const initial=startLto(emptyContractLedger(),request,startedAt),allocated={...initial.contract!,validationMode:'arkade-covenant-v2' as const};
  const funded=finishContractOperation(allocated,{operationId:fundId,kind:'fund',outcome:'confirmed'}),kind=financial==='claimed'?'claim':'refund';
  const terminal=finishContractOperation(beginContractOperation(funded,kind,'terminal-'+index,startedAt+(kind==='claim'?1000:91_000)),
    {operationId:'terminal-'+index,kind,outcome:'confirmed'});
  const descriptor:ContractRecovery={treasureArtifactVersion:4,treasure:terms,playerKey:terms.player,gameKey:terms.game,operatorKey:terms.operator,exitDelay:'2048',
    gameScript:hex.encode(gameScript.encode()),playerScript:hex.encode(playerScript.encode()),contractScript:hex.encode(built.script.encode())};
  let journal=createTreasureServerJournal({artifactVersion:4,kind:'fund',contractId:id,operationId:fundId,endpoint:'https://history.invalid/api/bis/',gameId:'stealth-and-steel',
    network:scope.network,profileId:scope.gameId,publicKey:gamePublic,authority:'player-proof',terms,checkpointTapscript:hex.encode(unroll.script),
    original:{arkTx:encoded(pair.arkTx),checkpoints:pair.checkpoints.map(encoded)},sourceTransactions:[hex.encode(source.toBytes(false,false))]});
  const argsJson=JSON.stringify(encodeSigningValue([pair.arkTx,[0]])),requestId='stored-root-'+index;
  journal=prepareTreasureServerRequest(journal,{purpose:'root',id:requestId,argsJson},startedAt+1000);
  const bodyJson=JSON.stringify({id:requestId,operationId:fundId,method:'sign',network:scope.network,profileId:scope.gameId,args:JSON.parse(argsJson),paymentPlan:plan});
  journal=transitionTreasureServerRequest(journal,requestId,{type:'planned',bodyJson,connectionToken:connection,atMs:startedAt+1001});
  journal=transitionTreasureServerRequest(journal,requestId,{type:'sign-pending',atMs:startedAt+1002});
  journal=transitionTreasureServerRequest(journal,requestId,{type:'sign-unknown',atMs:startedAt+1003});
  const recovery:ContractRecovery={...descriptor,fundingOutput:{txid:pair.arkTx.id,vout:0,value:1000},treasureServerJournals:{[fundId]:journal}};
  return {id,fundId,request,allocated,terminal,descriptor,recovery,journal,pair,sourcePoint,requestId,bodyJson,attempt:initial.ledger.attempts[0]};
}
let prepared:Promise<{old:readonly ReturnType<typeof fixture>[];fresh:ReturnType<typeof fixture>;source:ContractDocument}>|undefined;
const fixtures=()=>prepared??=Promise.resolve().then(()=>{
  const old=[fixture(1,'refunded'),fixture(2,'claimed')],fresh=fixture(4);
  const source:ContractDocument={version:1,revision:0,ledger:{contracts:old.map(f=>f.terminal),attempts:old.map(f=>f.attempt)},
    recovery:Object.fromEntries(old.map(f=>[f.id,f.recovery]))};validateContractDocument(source);return {old,fresh,source};
});
function appendOrdinary(document:ContractDocument,fresh:ReturnType<typeof fixture>,record=fresh.allocated):ContractDocument{
  return {...document,ledger:{contracts:[...document.ledger.contracts,record],attempts:[...document.ledger.attempts,fresh.attempt]},
    recovery:{...document.recovery,[fresh.id]:fresh.descriptor}};
}
function clearFlags(document:ContractDocument):ContractDocument{
  return {...document,ledger:{...document.ledger,contracts:document.ledger.contracts.map(({recoveryRequired:_flag,...record})=>record)}};
}
async function completed(f:ReturnType<typeof fixture>):Promise<TreasureServerJournal>{
  const signed=await game.sign(f.pair.arkTx,[0]);return transitionTreasureServerRequest(f.journal,f.requestId,{type:'completed',atMs:f.request.startedAt+2000,
    responseJson:JSON.stringify({result:encodeSigningValue(signed),treasureRootReceipt:sealed('old-receipt-'+f.id)})});
}

test('private unknown signing remains visible through the safe account projection after its financial outcome resolves',async t=>{
  const before=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:shadow()});
  t.after(()=>{if(before)Object.defineProperty(globalThis,'localStorage',before);else Reflect.deleteProperty(globalThis,'localStorage');});
  let network=0;t.mock.method(globalThis,'fetch',async()=>{network++;throw Error('Read-only account projection');});
  const {source,old}=await fixtures(),original=JSON.stringify(source);
  for(const profileId of [scope.playerId,scope.gameId]){
    const result=inspectContractDocument(source,profileId,{},scope.network);
    assert.equal(result.status,'ready');assert.equal(result.contracts.length,2);
    assert.deepEqual(result.contracts.map(record=>record.financial),source.ledger.contracts.map(record=>record.financial));
    assert.ok(result.contracts.every(record=>record.recoveryRequired===true&&!record.canClaim&&!record.canReject&&!record.canRefund));
    for(const secret of ['bodyJson','connectionToken','treasureServerJournals',plan,connection])assert.equal(JSON.stringify(result).includes(secret),false);
  }
  assert.equal(inspectContractDocument(source,'ff'.repeat(32),{},scope.network).contracts.length,0);
  assert.equal(inspectContractDocument(source,scope.playerId,{},'signet').contracts.length,0);
  assert.equal(JSON.stringify(source),original,'projection never changes financial state or private originals');
  const completedRecovery:Record<string,ContractRecovery>={...source.recovery};
  for(const f of old)completedRecovery[f.id]={...f.recovery,treasureServerJournals:{[f.fundId]:await completed(f)}};
  const reconciled:ContractDocument={...source,recovery:completedRecovery};
  assert.equal(inspectContractDocument(reconciled,scope.playerId,{},scope.network).contracts.length,0);
  assert.equal(network,0);
});

test('two terminal private-unknown histories survive password export/import and keep fresh offers unavailable',async t=>{
  let network=0;t.mock.method(globalThis,'fetch',async()=>{network++;throw Error('No network in history fixture');});
  const {old,fresh,source}=await fixtures(),password='public synthetic multi history password',financial=source.ledger.contracts.map(r=>r.financial);
  const file=await exportContractRecovery(source,scope,password);assert.equal(file.includes(plan),false);
  for(const f of old){assert.equal(file.includes(f.bodyJson),false);assert.equal(source.ledger.contracts.find(r=>r.id===f.id)!.recoveryRequired,undefined);}
  await assert.rejects(decryptContractRecovery(file,scope,'wrong synthetic password'));
  await assert.rejects(decryptContractRecovery(file,{...scope,gameId:'ff'.repeat(32)},password));
  const incoming=await decryptContractRecovery(file,scope,password),target=db();
  let document=await target.storage.save(mergeContractRecovery(await target.storage.load(),incoming,scope));
  assert.deepEqual(document.ledger.contracts.map(r=>r.financial),financial);assert.equal(document.ledger.contracts.length,2);
  assert.ok(document.ledger.contracts.every(r=>r.recoveryRequired===true&&!contractResolved(r)));
  for(const f of old){assert.deepEqual(document.recovery[f.id],source.recovery[f.id]);const publicRecord=presentContract(document.ledger.contracts.find(r=>r.id===f.id)!,fresh.request.startedAt);
    assert.equal(publicRecord.canClaim,false);assert.equal(publicRecord.canRefund,false);}
  const local=shadow();publishContractReservations(document,local);const shadowRows=readContractReservations(scope.network,local);
  assert.equal(shadowRows.length,2);assert.ok(shadowRows.every(r=>r.pending));
  for(const f of old)assert.ok(shadowRows.find(r=>r.id===f.id)!.inputs?.some(point=>point.txid===f.sourcePoint.txid&&point.vout===f.sourcePoint.vout));
  assert.equal(JSON.stringify(shadowRows).includes('bodyJson'),false);await assert.rejects(target.storage.reset());
  const blocked=startLto(document.ledger,{...fresh.request,id:'blocked-start',sessionId:'blocked-session',operationId:'blocked-fund'},fresh.request.startedAt);
  assert.equal(blocked.status,'occupied');document=await target.storage.save({...document,ledger:blocked.ledger});
  const bypass=appendOrdinary(document,fresh);validateContractDocument(bypass);
  await assert.rejects(target.storage.save(bypass),'direct storage writes cannot bypass occupied restored history');
  for(const f of old){
    const journal=await completed(f);document=await target.storage.save({...document,recovery:{...document.recovery,
      [f.id]:{...document.recovery[f.id],treasureServerJournals:{[f.fundId]:journal}}}});
    assert.deepEqual(document.ledger.contracts.map(r=>r.financial),financial);assert.ok(document.ledger.contracts.every(r=>r.recoveryRequired===true));
  }
  assert.throws(()=>mergeContractRecovery(document,incoming,scope),'an old unknown backup cannot replace exact completed results');
  publishContractReservations(document,local);assert.ok(readContractReservations(scope.network,local).every(r=>r.pending));
  await assert.rejects(target.storage.save(appendOrdinary(clearFlags(document),fresh)),
    'reconciliation flags cannot be cleared in the same write as competing allocation');
  // Explicit offline reconciliation fact, separate from signing acknowledgement.
  document=await target.storage.save(clearFlags(document));publishContractReservations(document,local);
  assert.ok(readContractReservations(scope.network,local).every(r=>!r.pending));
  assert.equal(startLto(document.ledger,{...fresh.request,id:'blocked-start',sessionId:'blocked-session',operationId:'blocked-fund'},fresh.request.startedAt).status,'occupied');
  const allowed=startLto(document.ledger,fresh.request,fresh.request.startedAt);assert.equal(allowed.status,'created');
  const selected={...allowed.ledger,contracts:allowed.ledger.contracts.map(record=>record.id===fresh.id?{...record,validationMode:'arkade-covenant-v2' as const}:record)};
  const saved=await target.storage.save({...document,ledger:selected,recovery:{...document.recovery,[fresh.id]:fresh.descriptor}});
  assert.equal(saved.ledger.contracts.length,3);assert.deepEqual(saved.recovery[old[0].id],document.recovery[old[0].id]);assert.equal(network,0);
});

test('the write boundary checks proposed restored history and private acknowledgements while preserving scope isolation',async()=>{
  const {old,fresh,source}=await fixtures(),password='public synthetic after document password';
  const incoming=await decryptContractRecovery(await exportContractRecovery(source,scope,password),scope,password),target=db();
  const combined=appendOrdinary(mergeContractRecovery(await target.storage.load(),incoming,scope),fresh);
  validateContractDocument(combined);await assert.rejects(target.storage.save(combined),'new history and new ordinary allocation cannot share a write');assert.equal(target.writes(),0);
  let document=await target.storage.save(mergeContractRecovery(await target.storage.load(),incoming,scope));
  document=await target.storage.save(clearFlags(document));
  assert.ok(document.ledger.contracts.every(contractResolved));
  await assert.rejects(target.storage.save(appendOrdinary(document,fresh)),
    'financial verification cannot release a still-unknown signing acknowledgement');
  const changedScope={...fresh.allocated.scope,exclusivityKey:'another-slot'},other={...fresh.allocated,scope:changedScope};
  const isolated={...appendOrdinary(document,fresh,other),ledger:{contracts:[...document.ledger.contracts,other],
    attempts:[...document.ledger.attempts,{...fresh.attempt,scope:changedScope}]}};
  const saved=await target.storage.save(isolated);assert.equal(saved.ledger.contracts.length,3);
  for(const f of old)assert.deepEqual(saved.recovery[f.id],document.recovery[f.id]);
});

test('only financially terminal restored history is excluded from duplicate active-slot validation',()=>{
  const scope={network:'signet',operator:'https://signet.arkade.sh',playerId:'public-player',gameId:'public-game',exclusivityKey:'original-slot'};
  const make=(id:string,financial:'claimed'|'refunded'|'failed'):ContractRecord=>({version:1,type:'lto',scope,id,sessionId:id,purpose:'treasureLTO',hostReference:id,
    amountSats:1000,startedAt:1,expiresAt:90000,recoveryRequired:true,financial,operation:{id:'operation-'+id,
      kind:financial==='claimed'?'claim':financial==='failed'?'fund':'refund',submission:financial==='failed'?'not-submitted':'confirmed'}});
  const contracts=[make('claimed','claimed'),make('refunded','refunded'),make('failed','failed')];
  const ledger=(records:readonly ContractRecord[]):ContractLedger=>({contracts:records,attempts:records.map(record=>({scope:record.scope,sessionId:record.sessionId,status:'created',contractId:record.id}))});
  validateContractLedger(ledger(contracts));
  const active=(id:string,required=false):ContractRecord=>({...make(id,'failed'),financial:'funding',recoveryRequired:required,operation:{id:'fund-'+id,kind:'fund',submission:'prepared'}});
  assert.throws(()=>validateContractLedger(ledger([active('a'),active('b')])),/conflicting offers/);
  assert.throws(()=>validateContractLedger(ledger([active('a',true),active('b',true)])),/conflicting offers/);
  validateContractLedger(ledger([...contracts,active('one-existing-active')]));
  assert.equal(startLto(ledger(contracts),{scope,id:'new',sessionId:'new',operationId:'new-fund',purpose:'treasureLTO',hostReference:'new',amountSats:1000,startedAt:1,expiresAt:90000},2).status,'occupied');
});
