import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SingleKey,Transaction,DefaultVtxo,CSVMultisigTapscript,buildOffchainTx} from '@arkade-os/sdk';
import {base64,hex} from '@scure/base';
import {createLtoService} from '../../src/client/state-layer-core/lto-service.ts';
import {createContractStorage,type ContractBackend,type ContractRecovery} from '../../src/client/state-layer-core/contract-storage.ts';
import {emptyContractLedger,startLto,beginContractOperation,finishContractOperation,markContractSubmission,type ContractRecord} from '../../src/client/state-layer-core/contracts.ts';
import {treasureServerRecoveryPending} from '../../src/client/state-layer-core/treasure-server-recovery.ts';
import {buildAuthorizedTreasureScript} from '../../src/client/wallet-layer-arkade/treasure-authorized-script.ts';
import {createTreasureServerJournal,prepareTreasureServerRequest,transitionTreasureServerRequest} from '../../src/client/wallet-layer-arkade/treasure-server-journal.ts';
import {encodeSigningValue} from '../../src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import {TREASURE_EMULATOR} from '../../src/client/wallet-layer-arkade/treasure-capability.ts';
import {operatorFor} from '../../src/client/wallet-layer-arkade/account.ts';

// Offline synthetic financial facts and actual SDK/journal/encrypted storage.
// No real receipt, provider, wallet phrase or remote signature is claimed.
type Mode='funded'|'historical-funded'|'terminal'|'prepared'|'submitted';
async function fixture(mode:Mode,expired=false){
  const identities=[1,2,3].map(n=>SingleKey.fromHex(n.toString(16).padStart(64,'0')));
  const [player,game,operator]=await Promise.all(identities.map(async i=>hex.encode(await i.xOnlyPublicKey())));
  const startedAt=Date.now()-(expired?100_000:1000),id='pending-contract',fundId='pending-fund';
  const profile=async(index:number)=>createHash('sha256').update(await identities[index].compressedPublicKey()).digest('hex');
  const scope={network:'mutinynet' as const,operator:operatorFor('mutinynet'),playerId:await profile(0),gameId:await profile(1),exclusivityKey:'pending-slot'};
  const script=(key:string)=>new DefaultVtxo.Script({pubKey:hex.decode(key),serverPubKey:hex.decode(operator),csvTimelock:{type:'seconds',value:2048n}});
  const playerScript=script(player),gameScript=script(game);
  const terms={network:scope.network,offerSessionId:id,hostReference:'pending-host',startedAtMs:startedAt,player,game,operator,
    emulator:TREASURE_EMULATOR.key.slice(2),playerDestination:hex.encode(playerScript.pkScript.slice(2)),gameDestination:hex.encode(gameScript.pkScript.slice(2)),exitDelay:2048};
  const built=buildAuthorizedTreasureScript(terms),unroll=CSVMultisigTapscript.encode({pubkeys:[hex.decode(operator)],timelock:{type:'seconds',value:4096n}});
  const source=new Transaction({version:3});source.addInput({txid:'a6'.repeat(32),index:0,witnessUtxo:{script:gameScript.pkScript,amount:1500n}});
  source.addOutput({script:gameScript.pkScript,amount:1500n});source.addOutput({script:hex.decode('51024e73'),amount:0n});
  const sourcePoint={txid:source.id,vout:0,value:1500},pair=buildOffchainTx([{...sourcePoint,tapLeafScript:gameScript.forfeit(),tapTree:gameScript.encode()}],
    [{script:built.script.pkScript,amount:1000n},{script:gameScript.pkScript,amount:500n}],unroll);
  const encode=(tx:Transaction)=>base64.encode(tx.toPSBT()),request={scope,id,sessionId:id,operationId:fundId,purpose:'treasureLTO',hostReference:terms.hostReference,
    amountSats:1000,startedAt,expiresAt:built.deadlineSeconds*1000};
  const allocation=startLto(emptyContractLedger(),request,startedAt),allocated={...allocation.contract!,validationMode:'arkade-covenant-v2' as const};
  let record:ContractRecord=finishContractOperation(allocated,{operationId:fundId,kind:'fund',outcome:'confirmed'});
  if(mode==='historical-funded'||mode==='terminal'){
    record=beginContractOperation(record,'refund','earlier-refund',startedAt+1000);
    record=finishContractOperation(record,{operationId:record.operation.id,kind:'refund',outcome:mode==='terminal'?'confirmed':'not-submitted'});
  }else if(mode==='prepared')record=allocated;
  else if(mode==='submitted')record=markContractSubmission(allocated,fundId,startedAt+1000,true);
  let journal=createTreasureServerJournal({artifactVersion:4,kind:'fund',contractId:id,operationId:fundId,endpoint:'https://pending.invalid/api/bis/',gameId:'stealth-and-steel',
    network:scope.network,profileId:scope.gameId,publicKey:hex.encode(await identities[1].compressedPublicKey()),authority:'player-proof',terms,
    checkpointTapscript:hex.encode(unroll.script),original:{arkTx:encode(pair.arkTx),checkpoints:pair.checkpoints.map(encode)},sourceTransactions:[hex.encode(source.toBytes(false,false))]});
  const requestId='original-root',argsJson=JSON.stringify(encodeSigningValue([pair.arkTx,[0]])),sealed=(s:string)=>s+'.'+'a'.repeat(43);
  journal=prepareTreasureServerRequest(journal,{id:requestId,purpose:'root',argsJson},startedAt+10);
  journal=transitionTreasureServerRequest(journal,requestId,{type:'planned',atMs:startedAt+11,connectionToken:sealed('original-connection'),
    bodyJson:JSON.stringify({id:requestId,operationId:fundId,method:'sign',network:scope.network,profileId:scope.gameId,args:JSON.parse(argsJson),paymentPlan:sealed('original-plan')})});
  journal=transitionTreasureServerRequest(journal,requestId,{type:'sign-pending',atMs:startedAt+12});
  journal=transitionTreasureServerRequest(journal,requestId,{type:'sign-unknown',atMs:startedAt+13});
  const recovery:ContractRecovery={treasureArtifactVersion:4,treasure:terms,playerKey:player,gameKey:game,operatorKey:operator,exitDelay:'2048',
    playerScript:hex.encode(playerScript.encode()),gameScript:hex.encode(gameScript.encode()),contractScript:hex.encode(built.script.encode()),
    ...(mode==='prepared'?{}:{fundingOutput:{txid:pair.arkTx.id,vout:0,value:1000}}),treasureServerJournals:{[fundId]:journal},
    ...(mode==='submitted'?{spend:{operationId:fundId,transactionId:pair.arkTx.id,inputs:[sourcePoint],destinationScript:hex.encode(built.script.pkScript),amountSats:1000,
      change:{script:hex.encode(gameScript.pkScript),value:500}},finalization:{transactionId:pair.arkTx.id,checkpoints:pair.checkpoints.map(encode)}}:{})};
  return {record,recovery,journal,request,requestId,fundId,identities,pair,sealed,attempt:allocation.ledger.attempts[0]};
}
type Dependencies=Parameters<typeof createLtoService>[1];
async function setup(t:TestContext,mode:Mode='funded',expired=false){
  const rows=new Map<string,string>(),shadow={getItem:(key:string)=>rows.get(key)??null,setItem:(key:string,value:string)=>{rows.set(key,value);},
    removeItem:(key:string)=>{rows.delete(key);},clear:()=>rows.clear(),key:(index:number)=>[...rows.keys()][index]??null,get length(){return rows.size;}} satisfies Storage;
  const held=new Set<string>(),locks={request:async(name:string,options:{ifAvailable?:boolean;mode?:'exclusive'|'shared'},use:(lock:{name:string;mode:'exclusive'|'shared'}|null)=>Promise<unknown>)=>{
    if(held.has(name)){if(options.ifAvailable)return use(null);throw Error('Unexpected concurrent fixture lock');}
    held.add(name);try{return await use({name,mode:options.mode??'exclusive'});}finally{held.delete(name);}
  }};
  for(const [key,value] of Object.entries({localStorage:shadow,navigator:{locks}})){
    const before=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{configurable:true,value});
    t.after(()=>{if(before)Object.defineProperty(globalThis,key,before);else Reflect.deleteProperty(globalThis,key);});
  }
  t.mock.method(globalThis,'fetch',async()=>{throw Error('Offline controller test forbids provider requests');});
  const f=await fixture(mode,expired);let envelope:Awaited<ReturnType<ContractBackend['read']>>;
  const storage=createContractStorage({read:async()=>structuredClone(envelope),write:async(next,revision)=>{assert.equal(envelope?.revision??0,revision);envelope=structuredClone(next);}},'mutinynet');
  // Seed through the explicit imported-history boundary, then expose the raw
  // record case under review. Private authority remains genuinely unresolved.
  let seeded=await storage.save({version:1,revision:0,ledger:{contracts:[{...f.record,recoveryRequired:true}],attempts:[f.attempt]},recovery:{[f.record.id]:f.recovery}});
  seeded=await storage.save({...seeded,ledger:{...seeded.ledger,contracts:[f.record]}});
  assert.equal(seeded.ledger.contracts[0].recoveryRequired,undefined);assert.ok(treasureServerRecoveryPending(seeded.recovery[f.record.id]));
  const playerState={profileId:f.record.scope.playerId,phase:'active',network:'mutinynet'},gameState={profileId:f.record.scope.gameId,status:'ready',network:'mutinynet'};
  const calls:string[]=[],toasts:string[]=[],forbidden=async()=>{calls.push('mutation');throw Error('No new operation while private signing is unresolved');};
  const context={getState:()=>playerState,showToast:(text:string)=>{toasts.push(text);},refreshBalance:async()=>{}};
  const gameWallet={getState:()=>gameState,refresh:async()=>{}};
  const dependencies:Dependencies={storage,playerStorage:{load:async()=>({generation:0,account:{profileId:f.record.scope.playerId,network:'mutinynet',phrase:'public fixture only'}})},
    gameStorage:{load:async()=>({profileId:f.record.scope.gameId,network:'mutinynet',phrase:'public fixture only'}),dispose(){}},
    prepare:forbidden,submit:forbidden,resume:forbidden,poll:false,reconcile:async(record,recovery)=>{calls.push('receipt-read');return {record,recovery};}};
  const service=createLtoService({context,gameWallet} as unknown as Parameters<typeof createLtoService>[0],dependencies);
  t.after(()=>service.dispose({endSessions:false}));
  return {...f,storage,service,dependencies,calls,toasts,playerState,shadow,seeded};
}

test('Claim Reject Refund and Approve deny current and historical private pending authority without changing originals',async t=>{
  for(const mode of ['funded','historical-funded'] as const){
    await t.test(mode,async child=>{
      const s=await setup(child,mode),before=await s.storage.load();
      for(const kind of ['claim','reject','refund','approve'] as const){
        s.playerState.profileId=kind==='refund'?s.record.scope.gameId:s.record.scope.playerId;
        const result=await s.service[kind](s.record.id);assert.equal(result.status,'unavailable');assert.equal(result.contract?.recoveryRequired,true);
        assert.deepEqual(await s.storage.load(),before);
      }
      assert.deepEqual(s.calls,[]);assert.deepEqual(s.toasts,[]);
    });
  }
});
test('expiry and session end preserve original private pending state without automatic refund or legacy finalization',async t=>{
  const s=await setup(t,'historical-funded',true),before=await s.storage.load();
  await s.service.endSession(s.record.sessionId);
  const after=await s.storage.load();assert.deepEqual(after.ledger,before.ledger);assert.deepEqual(after.recovery,before.recovery);
  assert.deepEqual(s.calls,['receipt-read']);assert.deepEqual(s.toasts,[]);
});
test('prepared and submitted financial operations are never abandoned or resumed while private signing remains unknown',async t=>{
  for(const mode of ['prepared','submitted'] as const)await t.test(mode,async child=>{
    const s=await setup(child,mode,true),before=await s.storage.load();await s.service.reconcile({feedback:'explicit'});
    const after=await s.storage.load();assert.deepEqual(after.ledger,before.ledger);assert.deepEqual(after.recovery,before.recovery);
    assert.deepEqual(s.calls,['receipt-read']);assert.deepEqual(s.toasts,[]);
  });
});
test('financially terminal private pending history stays visible and reaches only its original-result recovery callback',async t=>{
  const s=await setup(t,'terminal'),before=await s.storage.load();
  s.dependencies.recoverSigning=async(record,recovery)=>{s.calls.push('original-lookup');assert.deepEqual(record,s.record);assert.deepEqual(recovery,s.recovery);};
  await s.service.reconcile({contractId:s.record.id,feedback:'explicit'});
  const after=await s.storage.load();assert.deepEqual(after.ledger,before.ledger);assert.deepEqual(after.recovery,before.recovery);
  const view=await s.service.checkContractsAsync();assert.equal(view.contracts.length,1);assert.equal(view.contracts[0].financial,'refunded');
  assert.equal(view.contracts[0].recoveryRequired,true);assert.deepEqual(s.calls,['original-lookup','receipt-read']);assert.deepEqual(s.toasts,[]);
});
test('new allocation and duplicate Start cannot bypass a financially terminal private pending original',async t=>{
  const s=await setup(t,'terminal'),before=await s.storage.load(),now=Date.now();
  const replacement={sessionId:'replacement-session',purpose:'treasureLTO',hostReference:'replacement',exclusivityKey:s.record.scope.exclusivityKey,
    amountSats:1000,startedAt:now,expiresAt:now+90000};
  assert.equal((await s.service.start(replacement)).status,'unavailable');assert.deepEqual(await s.storage.load(),before);
  const key=JSON.stringify([s.record.scope.gameId,s.record.scope.playerId,s.record.scope.exclusivityKey,s.record.sessionId]);
  s.shadow.setItem('bis-lto-attempt-v1:'+encodeURIComponent(key),'attempted');
  const duplicate=await s.service.start({...replacement,sessionId:s.record.sessionId});
  assert.equal(duplicate.status,'pending');assert.equal(duplicate.contract?.financial,'refunded');assert.equal(duplicate.contract?.recoveryRequired,true);
  assert.deepEqual(await s.storage.load(),before);assert.deepEqual(s.calls,[]);
});
test('authenticated original completion commits the exact historical journal without allocating another operation in that pass',async t=>{
  const s=await setup(t,'historical-funded',true),before=await s.storage.load();
  const signed=await s.identities[1].sign(s.pair.arkTx,[0]);
  const completed=transitionTreasureServerRequest(s.journal,s.requestId,{type:'completed',atMs:Date.now(),
    responseJson:JSON.stringify({result:encodeSigningValue(signed),treasureRootReceipt:s.sealed('original-receipt')})});
  s.dependencies.recoverSigning=async(record,recovery,commit)=>{
    s.calls.push('original-lookup');assert.equal(record.operation.id,s.record.operation.id);
    await commit({...recovery,treasureServerJournals:{...recovery.treasureServerJournals,[s.fundId]:completed}});
    assert.equal((await s.storage.load()).recovery[record.id].treasureServerJournals?.[s.fundId].requests[0].phase,'completed');
  };
  await s.service.reconcile({contractId:s.record.id});const after=await s.storage.load();
  assert.deepEqual(after.ledger,before.ledger);assert.equal(treasureServerRecoveryPending(after.recovery[s.record.id]),false);
  assert.deepEqual(after.recovery[s.record.id].treasureServerJournals?.[s.fundId],completed);
  assert.deepEqual(s.calls,['original-lookup','receipt-read']);assert.deepEqual(s.toasts,[]);
});
test('an unavailable original-result lookup preserves all financial and private material and never falls back to signing',async t=>{
  const s=await setup(t,'terminal'),before=await s.storage.load();
  s.dependencies.recoverSigning=async()=>{s.calls.push('original-lookup');throw Error('Original completion still unavailable');};
  await s.service.reconcile({contractId:s.record.id});assert.deepEqual(await s.storage.load(),before);
  assert.deepEqual(s.calls,['original-lookup']);assert.deepEqual(s.toasts,[]);
});
