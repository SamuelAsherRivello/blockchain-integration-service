import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {SingleKey,DefaultVtxo,CSVMultisigTapscript,Transaction,ConditionWitness,getArkPsbtFields} from '@arkade-os/sdk';
import {base64,hex} from '@scure/base';
import {prepareLtoSdkPlan,validateLtoPrivateOriginal,buildLtoWire,inspectLtoSubmission,inspectLtoFinalization,observeLtoWire,bindLtoRefundOperation,waitLtoExit,ltoStrategy,type LtoPlan,type LtoWire} from '../scripts/funded-workflow-lto.ts';
import {validateLifecycleAssignment,lifecycleScope,type LifecycleAssignment} from '../scripts/funded-workflow-lifecycle.ts';
import {buildLtoScript} from '../../integration/src/client/wallet-layer-arkade/lto-script.ts';
import {startLto,emptyContractLedger,finishContractOperation,endContract,beginContractOperation} from '../../integration/src/client/state-layer-core/contracts.ts';
import {encodeSigningValue} from '../../integration/src/client/wallet-layer-arkade/server-wallet-protocol.ts';
const game=SingleKey.fromHex('1'.padStart(64,'0')),operator=SingleKey.fromHex('2'.padStart(64,'0')),player=SingleKey.fromHex('3'.padStart(64,'0'));
const gamePublicKey=hex.encode(await game.compressedPublicKey()),playerPublicKey=hex.encode(await player.compressedPublicKey()),operatorPublicKey=hex.encode(await operator.compressedPublicKey());
const gameKey=hex.encode(await game.xOnlyPublicKey()),playerKey=hex.encode(await player.xOnlyPublicKey()),operatorKey=hex.encode(await operator.xOnlyPublicKey());
const defaults={serverPubKey:hex.decode(operatorKey),csvTimelock:{type:'seconds' as const,value:2048n}},own=new DefaultVtxo.Script({...defaults,pubKey:hex.decode(gameKey)}),destination=new DefaultVtxo.Script({...defaults,pubKey:hex.decode(playerKey)});
const checkpoint=CSVMultisigTapscript.encode({pubkeys:[hex.decode(operatorKey)],timelock:{type:'seconds',value:2048n}});
const info={network:'signet',signerPubkey:operatorPublicKey,unilateralExitDelay:2048n,vtxoMinAmount:1n,vtxoMaxAmount:-1n,checkpointTapscript:hex.encode(checkpoint.script),fees:{txFeeRate:'0',intentFee:{onchainInput:'0',offchainInput:'0',onchainOutput:'0',offchainOutput:'0'}}};
function assignment():LifecycleAssignment{
 const required=['funded-workflow-live','protected-browser-journal','tests/funded-workflow-preflight','funded-workflow-lifecycle','funded-workflow-lto'];
 return {runId:'standard-lto-001',network:'signet',pair:'test-pair',candidateId:'signet:01',playerProfileId:createHash('sha256').update(Buffer.from(playerPublicKey,'hex')).digest('hex'),gameProfileId:createHash('sha256').update(Buffer.from(gamePublicKey,'hex')).digest('hex'),serverPublicKey:gamePublicKey,endpoint:'https://reviewed-example.vercel.app/api/bis/',amountSats:1000,feeSats:0,workflow:'standard-lto',authorizationMode:'player-proof',sourceHashes:Object.fromEntries(required.map(path=>['BIS/packages/bis-server/scripts/'+path+'.ts','a'.repeat(64)]))};
}
function fixture(){
 const a=assignment(),coins=[{txid:'11'.repeat(32),vout:0,value:2500,script:hex.encode(own.pkScript),assets:[]}],plan=prepareLtoSdkPlan({a,info,playerPublicKey,coins});
 const secretHex='ab'.repeat(32),secretHash=createHash('sha256').update(Buffer.from(secretHex,'hex')).digest(),contract=buildLtoScript({playerKey:hex.decode(playerKey),gameKey:hex.decode(gameKey),operatorKey:hex.decode(operatorKey),secretHash,exitDelay:2048n});
 const now=Date.now(),allocated=startLto(emptyContractLedger(),{id:a.runId,sessionId:a.runId,operationId:'synthetic-fund',purpose:'server-sdk-standard-lto',hostReference:'server-acceptance:'+a.runId,amountSats:1000,startedAt:now,expiresAt:now+600000,approved:true,scope:{network:a.network,operator:'https://signet.arkade.sh',playerId:a.playerProfileId,gameId:a.gameProfileId,exclusivityKey:'server-sdk:'+a.runId}},now);
 const record={...allocated.contract!,validationMode:'browser-policy-v1' as const};
 const recovery={secretHex,playerKey,gameKey,operatorKey,exitDelay:'2048',playerScript:plan.playerScript,gameScript:plan.gameScript,contractScript:hex.encode(contract.script.encode())};
 return {a,plan,recovery,document:{version:1,revision:0,ledger:{...allocated.ledger,contracts:[record]},recovery:{[a.runId]:recovery}}};
}
const decode=(encoded:string)=>Transaction.fromPSBT(base64.decode(encoded)),encode=(tx:Transaction)=>base64.encode(tx.toPSBT());
async function signed(wire:LtoWire,identity:typeof game){return {signedArkTx:encode(await identity.sign(decode(wire.arkTx),[0])),checkpointTxs:await Promise.all(wire.checkpoints.map(async encoded=>encode(await identity.sign(decode(encoded),[0]))))};}
function indexer(wire:LtoWire){
 const cps=wire.checkpoints.map(decode),root=decode(wire.arkTx),rows:any[]=cps.map(cp=>{const input=cp.getInput(0);return {txid:hex.encode(input.txid!),vout:input.index,value:Number(input.witnessUtxo!.amount),script:hex.encode(input.witnessUtxo!.script),isSpent:true,spentBy:cp.id,arkTxId:wire.transactionId,assets:[]};});
 rows.push({txid:root.id,vout:0,value:1000,script:wire.destinationScript,assets:[]});if(wire.changeSats)rows.push({txid:root.id,vout:1,value:wire.changeSats,script:wire.changeScript,assets:[]});
 return {rows,getVtxos:async()=>({vtxos:rows}),getVirtualTxs:async()=>({txs:[wire.arkTx,...wire.checkpoints]})};
}
test('standard LTO preparation pins actual production selection and an explicit fresh-private-hash template',()=>{
 const f=fixture();assert.equal(f.plan.approval,'fresh-private-hash-template');assert.deepEqual(f.plan.outpoints,['11'.repeat(32)+':0']);assert.equal(f.plan.amountSats,1000);assert.equal(f.plan.feeSats,0);
 const alternative=prepareLtoSdkPlan({a:f.a,info,playerPublicKey,coins:[...f.plan.inputs,{txid:'22'.repeat(32),vout:0,value:1000,script:hex.encode(own.pkScript),assets:[]}]});assert.deepEqual(alternative.outpoints,['22'.repeat(32)+':0']);
 assert.throws(()=>prepareLtoSdkPlan({a:f.a,info:{...info,fees:{txFeeRate:'1',intentFee:{}}},playerPublicKey,coins:f.plan.inputs}));
 assert.throws(()=>prepareLtoSdkPlan({a:f.a,info,playerPublicKey,coins:f.plan.inputs.map(coin=>({...coin,assets:[{assetId:'ff'.repeat(34),amount:1n}]}))}));
});
test('fresh private preimage must reconstruct the exact saved SDK script and original scope',async()=>{
 const f=fixture();assert.equal((await validateLtoPrivateOriginal(f.document,f.a,f.plan)).built.script.encode().length>0,true);
 const changed=structuredClone(f.document);changed.recovery[f.a.runId].secretHex='cd'.repeat(32);await assert.rejects(validateLtoPrivateOriginal(changed,f.a,f.plan));
 const wrong=structuredClone(f.document);wrong.ledger.contracts[0]={...wrong.ledger.contracts[0],scope:{...wrong.ledger.contracts[0].scope,network:'mutinynet'}};await assert.rejects(validateLtoPrivateOriginal(wrong,f.a,f.plan));
});
test('real Game funding and Player hashlocked claim signatures match exact original wire',async()=>{
 const f=fixture(),fund=buildLtoWire(f.plan,f.recovery,'fund'),funded=await signed(fund,game);
 assert.equal(inspectLtoSubmission(funded,fund),fund.transactionId);assert.equal(fund.changeSats,1500);
 const final={arkTxid:fund.transactionId,finalCheckpointTxs:await Promise.all(funded.checkpointTxs.map(async value=>encode(await operator.sign(decode(value),[0]))))};assert.doesNotThrow(()=>inspectLtoFinalization(final,fund));
 const claim=buildLtoWire(f.plan,{...f.recovery,fundingOutput:{txid:fund.transactionId,vout:0,value:1000}},'claim');assert.equal(claim.changeSats,0);assert.equal(inspectLtoSubmission(await signed(claim,player),claim),claim.transactionId);
 await assert.rejects(async()=>inspectLtoSubmission(await signed(claim,game),claim));
});
test('LTO signed payout substitutions and missing original signatures cannot pass canonical binding',async()=>{
 const f=fixture(),wire=buildLtoWire(f.plan,f.recovery,'fund'),tx=decode(wire.arkTx);tx.updateOutput(0,{script:destination.pkScript});
 const wrong={signedArkTx:encode(await game.sign(tx,[0])),checkpointTxs:(await signed(wire,game)).checkpointTxs};assert.throws(()=>inspectLtoSubmission(wrong,wire));
 assert.throws(()=>inspectLtoSubmission({signedArkTx:wire.arkTx,checkpointTxs:wire.checkpoints},wire));
 const valid=await signed(wire,game);assert.throws(()=>inspectLtoFinalization({arkTxid:wire.transactionId,finalCheckpointTxs:valid.checkpointTxs},wire));
});
test('exact funding and claim receipts require full source/checkpoint/payout wire ancestry',async()=>{
 const f=fixture(),fund=buildLtoWire(f.plan,f.recovery,'fund'),fundIndex=indexer(fund);assert.equal((await observeLtoWire(fundIndex,fund)).verified,true);
 const claim=buildLtoWire(f.plan,{...f.recovery,fundingOutput:{txid:fund.transactionId,vout:0,value:1000}},'claim');assert.equal((await observeLtoWire(indexer(claim),claim)).verified,true);
 await assert.rejects(observeLtoWire({...fundIndex,getVirtualTxs:async()=>({txs:[]})},fund));
 fundIndex.rows[0].spentBy='f'.repeat(64);await assert.rejects(observeLtoWire(fundIndex,fund));
 const wrong=indexer(fund);wrong.rows[0].script=hex.encode(destination.pkScript);await assert.rejects(observeLtoWire(wrong,fund));
 const lost=indexer(fund);lost.rows[1].value=999;await assert.rejects(observeLtoWire(lost,fund));
});
test('LTO CLI cannot read an assignment or wallet without its exact private slot',()=>{
 const a=assignment();assert.doesNotThrow(()=>validateLifecycleAssignment(a,'standard-lto'));assert.throws(()=>validateLifecycleAssignment({...a,amountSats:999},'standard-lto'));
 const result=spawnSync(process.execPath,['BIS/packages/bis-server/scripts/funded-workflow-lto.ts','run','absent-private-assignment.json',a.runId],{encoding:'utf8',timeout:20000,env:{...process.env,BIS_SERVER_ACCEPTANCE_SLOT:'',BIS_SERVER_FINANCIAL_SLOT:''}});
 assert.equal(result.status,1);assert.equal(result.stdout.trim().split(/\r?\n/).length,1);assert.equal(JSON.parse(result.stdout).reason,'guarded-lifecycle-acceptance-incomplete');assert.ok(!result.stdout.includes('absent-private'));
});

test('explicit rejection is a distinct approved template and claim remains the default',()=>{
 const f=fixture(),a=validateLifecycleAssignment(f.a,'standard-lto'),explicit=validateLifecycleAssignment({...f.a,ltoAction:'claim'},'standard-lto'),refund=validateLifecycleAssignment({...f.a,ltoAction:'reject-refund'},'standard-lto');
 assert.equal(a.ltoAction,'claim');assert.equal(lifecycleScope(a),lifecycleScope(explicit));assert.notEqual(lifecycleScope(a),lifecycleScope(refund));
 const plan=prepareLtoSdkPlan({a:refund,info,playerPublicKey,coins:f.plan.inputs});assert.equal(plan.ltoAction,'reject-refund');assert.notEqual(plan.fingerprint,f.plan.fingerprint);
 assert.throws(()=>validateLifecycleAssignment({...f.a,ltoAction:'refund'},'standard-lto'));
 assert.throws(()=>validateLifecycleAssignment({...f.a,workflow:'boarding',ltoAction:'reject-refund'},'boarding'));
});
test('real SDK Game refund uses the exact refund leaf without a preimage and returns 1000 to Game',async()=>{
 const f=fixture(),fund=buildLtoWire(f.plan,f.recovery,'fund'),recovery={...f.recovery,fundingOutput:{txid:fund.transactionId,vout:0,value:1000}},refund=buildLtoWire(f.plan,recovery,'refund');
 assert.equal(refund.destinationScript,hex.encode(own.pkScript));assert.equal(refund.roleKey,gameKey);assert.equal(refund.changeSats,0);
 for(const value of [refund.arkTx,...refund.checkpoints])assert.deepEqual(getArkPsbtFields(decode(value),0,ConditionWitness),[]);
 const body=await signed(refund,game);assert.equal(inspectLtoSubmission(body,refund),refund.transactionId);
 const final={arkTxid:refund.transactionId,finalCheckpointTxs:await Promise.all(body.checkpointTxs.map(async value=>encode(await operator.sign(decode(value),[0]))))};assert.doesNotThrow(()=>inspectLtoFinalization(final,refund));
 await assert.rejects(async()=>inspectLtoSubmission(await signed(refund,player),refund));
 const claim=buildLtoWire(f.plan,recovery,'claim');assert.notDeepEqual(decode(claim.arkTx).getInput(0).tapLeafScript,decode(refund.arkTx).getInput(0).tapLeafScript);assert.throws(()=>inspectLtoSubmission(body,claim));
 const tx=decode(refund.arkTx);tx.updateOutput(0,{script:destination.pkScript});const wrongDestination=await game.sign(tx,[0]);assert.throws(()=>inspectLtoSubmission({...body,signedArkTx:encode(wrongDestination)},refund));
 const substituted=buildLtoWire(f.plan,{...recovery,fundingOutput:{...recovery.fundingOutput,txid:'44'.repeat(32)}},'refund');const wrongSource=await signed(substituted,game);assert.throws(()=>inspectLtoSubmission(wrongSource,refund));
 assert.equal((await observeLtoWire(indexer(refund),refund)).verified,true);
 for(const mutate of [(i:any)=>{i.rows[1].script=hex.encode(destination.pkScript);},(i:any)=>{i.rows[0].txid='55'.repeat(32);},(i:any)=>{i.rows[1].assets=[{assetId:'ff',amount:1}];},(i:any)=>{i.rows[1].value=999;}]){const i=indexer(refund);mutate(i);await assert.rejects(observeLtoWire(i,refund));}
});
function refundContext(){
 const f=fixture();f.a={...f.a,ltoAction:'reject-refund'};f.plan=prepareLtoSdkPlan({a:f.a,info,playerPublicKey,coins:f.plan.inputs});
 const fund=buildLtoWire(f.plan,f.recovery,'fund'),document:any=structuredClone(f.document),initial=structuredClone(f.document),record=document.ledger.contracts[0];
 document.ledger.contracts[0]=beginContractOperation(endContract(finishContractOperation(record,{operationId:record.operation.id,kind:'fund',outcome:'confirmed'}),'rejected'),'refund','private-refund-op',Date.now());
 document.recovery[f.a.runId].fundingOutput={txid:fund.transactionId,vout:0,value:1000};
 const saved:any={phase:'execution-started',plan:f.plan,privateOriginalDocument:initial,originalFundSubmit:{synthetic:'saved before provider'},fundWire:fund,fundingReceipt:{verified:true,transactionId:fund.transactionId},refundScope:{stage:'awaiting-original-player-reject',previousServerOperationId:'original-fund-server-op'}};
 const state:any={operations:[{intent:{id:f.a.runId+'-fund'},state:'settled',providerId:fund.transactionId}]};
 const ctx:any={a:f.a,plan:f.plan,mode:'run',financial:true,deadline:Date.now()+30000,serverOperationId:'original-fund-server-op',read:async()=>structuredClone(saved),save:async(use:any)=>use(saved,state),owner:{page:{evaluate:async(fn:any)=>String(fn).includes('createContractStorage')?structuredClone(document):undefined}}};
 return {f,fund,document,saved,state,ctx};
}
test('new refund Game operation is bound once to independently settled funding and actual rejected contract',async()=>{
 const c=refundContext();await bindLtoRefundOperation(c.ctx,'player/challenge',{operationId:'original-refund-server-op'});
 assert.equal(c.saved.refundScope.stage,'bound');assert.equal(c.saved.refundScope.contractOperationId,'private-refund-op');assert.equal(c.ctx.serverOperationId,'original-refund-server-op');
 await bindLtoRefundOperation(c.ctx,'sign',{operationId:'original-refund-server-op'});
 await assert.rejects(bindLtoRefundOperation(c.ctx,'sign',{operationId:'third-operation'}));
 c.document.ledger.contracts[0].operation.id='different-private-op';await assert.rejects(bindLtoRefundOperation(c.ctx,'sign',{operationId:'original-refund-server-op'}));
});
test('unresolved funding, wrong scope, absent rejection and nonoriginal windows never open another signer scope',async()=>{
 for(const change of [(c:any)=>{c.state.operations[0].state='unknown';},(c:any)=>{c.saved.fundingReceipt.verified=false;},(c:any)=>{c.saved.phase='unresolved';},(c:any)=>{c.document.ledger.contracts[0].scope.playerId='other';},(c:any)=>{c.document.recovery[c.f.a.runId].secretHex='cd'.repeat(32);},(c:any)=>{delete c.document.ledger.contracts[0].ended;},(c:any)=>{c.ctx.financial=false;},(c:any)=>{c.ctx.mode='reconcile';},(c:any)=>{c.ctx.deadline=Date.now()-1;},(c:any)=>{c.document.recovery[c.f.a.runId].fundingOutput.txid='66'.repeat(32);},(c:any)=>{c.document.ledger.contracts[0].operation.submission='unknown';}]){
  const c=refundContext();change(c);await assert.rejects(bindLtoRefundOperation(c.ctx,'player/authenticate',{operationId:'original-refund-server-op'}));assert.equal(c.saved.refundScope.stage,'awaiting-original-player-reject');assert.equal(c.ctx.serverOperationId,'original-fund-server-op');
 }
 const c=refundContext();await assert.rejects(bindLtoRefundOperation(c.ctx,'player/challenge',{operationId:c.ctx.serverOperationId}));
});
test('actual public-proof and owner plan payloads bind refund metadata and all subsequent SDK signing wires',async()=>{
 for(const authorizationMode of ['player-proof','owner'] as const){
  const c=refundContext();c.ctx.a={...c.ctx.a,authorizationMode};await bindLtoRefundOperation(c.ctx,authorizationMode==='owner'?'owner/plan':'player/challenge',{operationId:'original-refund-server-op'});
  const wire=buildLtoWire(c.ctx.plan,c.document.recovery[c.f.a.runId],'refund'),prefix=authorizationMode==='owner'?'owner/':'payment/';
  const body:any={request:{method:'sign',operationId:'original-refund-server-op',args:encodeSigningValue([decode(wire.arkTx),[0]])},contract:{kind:'refund',secretHash:createHash('sha256').update(Buffer.from(c.f.recovery.secretHex,'hex')).digest('hex')},outpoints:[c.document.recovery[c.f.a.runId].fundingOutput],...(authorizationMode==='owner'?{contractPlayerPublicKey:'02'+playerKey}:{})};
  for(const mutate of [(b:any)=>{b.contract.kind='fund';},(b:any)=>{b.contract.secretHash='ff'.repeat(32);},(b:any)=>{b.outpoints[0].txid='ff'.repeat(32);},...(authorizationMode==='owner'?[(b:any)=>{b.contractPlayerPublicKey='02'+gameKey;}]:[])]){const bad=structuredClone(body);mutate(bad);await assert.rejects(ltoStrategy.server(c.ctx,prefix+'plan',bad));}
  await ltoStrategy.server(c.ctx,prefix+'plan',body);assert.equal(c.saved.refundWire.transactionId,wire.transactionId);
  for(const value of [wire.arkTx,...wire.checkpoints])await ltoStrategy.server(c.ctx,'sign',{method:'sign',operationId:'original-refund-server-op',args:encodeSigningValue([decode(value),[0]])});
  const claim=buildLtoWire(c.ctx.plan,c.document.recovery[c.f.a.runId],'claim');await assert.rejects(ltoStrategy.server(c.ctx,'sign',{method:'sign',operationId:'original-refund-server-op',args:encodeSigningValue([decode(claim.arkTx),[0]])}));
 }
});
test('pending refund acknowledgement cannot close financial observation before wire, actual Game sign, and journal terminal receipt',async()=>{
 const c=refundContext();await bindLtoRefundOperation(c.ctx,'player/challenge',{operationId:'original-refund-server-op'});
 const recovery=c.document.recovery[c.f.a.runId],wire=buildLtoWire(c.f.plan,recovery,'refund');c.ctx.deadline=Date.now()+5000;
 let finished=false;const waiting=waitLtoExit(c.ctx,'refund',indexer(wire)).then(result=>{finished=true;return result;});
 await new Promise(resolve=>setTimeout(resolve,30));assert.equal(finished,false);assert.equal(c.ctx.financial,true);
 c.saved.refundWire=wire;c.saved.originalRefundSubmit=await signed(wire,game);c.saved.originalRefundFinalize={arkTxid:wire.transactionId,finalCheckpointTxs:await Promise.all(c.saved.originalRefundSubmit.checkpointTxs.map(async(value:string)=>encode(await operator.sign(decode(value),[0]))))};
 c.document.ledger.contracts[0]=finishContractOperation(c.document.ledger.contracts[0],{operationId:'private-refund-op',kind:'refund',outcome:'confirmed'});recovery.spend={transactionId:wire.transactionId,operationId:'private-refund-op',destinationScript:wire.destinationScript,amountSats:1000,inputs:[recovery.fundingOutput]};
 await new Promise(resolve=>setTimeout(resolve,300));assert.equal(finished,false);
 c.saved.successfulServerSigns=[{operationId:'wrong-game-operation',method:'sign'}];await new Promise(resolve=>setTimeout(resolve,300));assert.equal(finished,false);
 c.saved.successfulServerSigns=[{operationId:'original-refund-server-op',method:'sign'}];assert.equal((await waiting).transactionId,wire.transactionId);
});
test('default claim keeps its original observation open until asynchronous execution has a terminal protected receipt',async()=>{
 const c=refundContext();c.ctx.a={...c.f.a,ltoAction:'claim'};c.ctx.plan=prepareLtoSdkPlan({a:c.ctx.a,info,playerPublicKey,coins:c.f.plan.inputs});
 const funded=finishContractOperation(c.saved.privateOriginalDocument.ledger.contracts[0],{operationId:'synthetic-fund',kind:'fund',outcome:'confirmed'});
 c.document.ledger.contracts[0]=beginContractOperation(funded,'claim','private-claim-op',Date.now());
 const recovery=c.document.recovery[c.f.a.runId],wire=buildLtoWire(c.ctx.plan,recovery,'claim');c.ctx.deadline=Date.now()+5000;
 let finished=false;const pending=waitLtoExit(c.ctx,'claim',indexer(wire)).then(value=>{finished=true;return value;});await new Promise(resolve=>setTimeout(resolve,30));assert.equal(finished,false);
 c.saved.claimWire=wire;c.saved.originalClaimSubmit=await signed(wire,player);c.saved.originalClaimFinalize={arkTxid:wire.transactionId,finalCheckpointTxs:await Promise.all(c.saved.originalClaimSubmit.checkpointTxs.map(async(value:string)=>encode(await operator.sign(decode(value),[0]))))};
 recovery.spend={transactionId:wire.transactionId,operationId:'private-claim-op',destinationScript:wire.destinationScript,amountSats:1000,inputs:[recovery.fundingOutput]};
 await new Promise(resolve=>setTimeout(resolve,300));assert.equal(finished,false);
 c.document.ledger.contracts[0]=finishContractOperation(c.document.ledger.contracts[0],{operationId:'private-claim-op',kind:'claim',outcome:'confirmed'});assert.equal((await pending).transactionId,wire.transactionId);
});
