import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {assertReviewedSource} from '../scripts/funded-workflow-live.ts';
import {SingleKey,DefaultVtxo,ArkAddress,Intent,Transaction,getNetwork,type IntentCoin} from '@arkade-os/sdk';
import {Address} from '@scure/btc-signer';
import {base64,hex} from '@scure/base';
import {planBoardingSdk,inspectBoardingIntent,traceBoardingReceipt,assertBoardingServerPath,type BoardingPlan} from '../scripts/funded-workflow-boarding.ts';
import {validateLifecycleAssignment,assertLifecycleAuthority,lifecycleScope,assertLifecycleConnection,retainLifecycleExecutionPlan,type LifecycleAssignment} from '../scripts/funded-workflow-lifecycle.ts';
const game=SingleKey.fromHex('1'.padStart(64,'0')),operator=SingleKey.fromHex('2'.padStart(64,'0')),player=SingleKey.fromHex('3'.padStart(64,'0'));
const gamePublicKey=hex.encode(await game.compressedPublicKey()),operatorPublicKey=hex.encode(await operator.compressedPublicKey()),playerPublicKey=hex.encode(await player.compressedPublicKey());
const makeScript=async(delay:bigint)=>new DefaultVtxo.Script({pubKey:await game.xOnlyPublicKey(),serverPubKey:await operator.xOnlyPublicKey(),csvTimelock:{type:'seconds',value:delay}});
const offchain=await makeScript(2048n),boarding=await makeScript(4096n);
const gameAddress=new ArkAddress(await operator.xOnlyPublicKey(),offchain.pkScript.slice(2),'tark').encode(),bitcoinAddress=Address(getNetwork('signet')).encode({type:'tr',pubkey:boarding.pkScript.slice(2)});
const info={network:'signet',signerPubkey:operatorPublicKey,unilateralExitDelay:2048n,boardingExitDelay:4096n,dust:330n,vtxoMinAmount:1n,vtxoMaxAmount:-1n,fees:{txFeeRate:'0',intentFee:{onchainInput:'0.0',offchainOutput:'0.0',offchainInput:'0.0',onchainOutput:'0.0'}}};
function assignment():LifecycleAssignment{
 const required=['funded-workflow-live','protected-browser-journal','tests/funded-workflow-preflight','funded-workflow-lifecycle','funded-workflow-boarding','protected-lifecycle-responses'];
 return {runId:'boarding-case-01',network:'signet',pair:'test-pair',candidateId:'signet:01',playerProfileId:createHash('sha256').update(Buffer.from(playerPublicKey,'hex')).digest('hex'),gameProfileId:createHash('sha256').update(Buffer.from(gamePublicKey,'hex')).digest('hex'),serverPublicKey:gamePublicKey,endpoint:'https://reviewed-example.vercel.app/api/bis/',amountSats:1000,feeSats:0,workflow:'boarding',authorizationMode:'owner',sourceHashes:Object.fromEntries(required.map(path=>['BIS/packages/bis-server/scripts/'+path+'.ts','a'.repeat(64)]))};
}
test('the revised executable lifecycle requires and verifies its protected response helper source',async()=>{
 const a=assignment(),path='BIS/packages/bis-server/scripts/protected-lifecycle-responses.ts',missing={...a,sourceHashes:{...a.sourceHashes}};
 delete missing.sourceHashes[path];assert.throws(()=>validateLifecycleAssignment(missing,'boarding'),/Reviewed lifecycle source required/);
 const actual=createHash('sha256').update(await readFile(path)).digest('hex');
 await assertReviewedSource({...a,sourceHashes:{[path]:actual}});
 await assert.rejects(assertReviewedSource({...a,sourceHashes:{[path]:'0'.repeat(64)}}),/Reviewed source changed/);
});
const coin=(value=1000)=>({txid:'11'.repeat(32),vout:0,value,status:{confirmed:true,block_height:1,block_time:Math.floor(Date.now()/1000)-10},tapTree:boarding.encode(),intentTapLeafScript:boarding.forfeit(),forfeitTapLeafScript:boarding.forfeit()});
test('boarding execution allowance is explicit, scope-bound and limited to five minutes',()=>{
 const a=assignment();
 assert.equal(validateLifecycleAssignment(a,'boarding').boardingExecutionMs,undefined);
 const bounded=validateLifecycleAssignment({...a,boardingExecutionMs:300000},'boarding');
 assert.equal(bounded.boardingExecutionMs,300000);assert.notEqual(lifecycleScope(a),lifecycleScope(bounded));
 for(const boardingExecutionMs of [119999,300001,NaN,Infinity,'300000',120000.1])assert.throws(()=>validateLifecycleAssignment({...a,boardingExecutionMs},'boarding'));
 assert.throws(()=>validateLifecycleAssignment({...a,workflow:'standard-lto',boardingExecutionMs:300000},'standard-lto'));
});
function fixture(value=1000){
 const quote={profileId:'c'.repeat(64),direction:'to-arkade',amountSats:value,inputSats:value,maxSats:value,feeSats:0,netSats:value,bitcoinAfterSats:0,arkadeAfterSats:value,totalAfterSats:value,expiresAt:Date.now()+60000,fingerprint:'d'.repeat(64)};
 const wallet={dustAmount:330n,boardingTapscript:boarding,getBoardingUtxos:async()=>[coin(value)],onchainProvider:{getChainTip:async()=>({height:2})},getBoardingAddress:async()=>bitcoinAddress,getAddress:async()=>gameAddress};
 return {quote,wallet,input:{wallet,info,profileId:quote.profileId,network:'signet' as const,quote}};
}
test('execution retains the actual approved quote for original reconciliation',async()=>{
 const a=assignment(),initial=await planBoardingSdk(fixture().input),actual={...initial,quote:{...initial.quote,expiresAt:initial.quote.expiresAt+1000}};
 const run={phase:'prepared',plan:initial};const approved={...a,approvedFingerprint:actual.fingerprint,approvedOutpoints:actual.outpoints};
 retainLifecycleExecutionPlan(run,actual,approved);
 assert.deepEqual(run.plan,actual);assert.deepEqual((run as any).preparedPlan,initial);assert.equal(run.phase,'execution-started');
 assert.throws(()=>retainLifecycleExecutionPlan(run,actual,approved));
 assert.throws(()=>retainLifecycleExecutionPlan({phase:'prepared',plan:initial},{...actual,fingerprint:'f'.repeat(64)},approved));
});

test('installed SDK Ramps builds the unsigned exact Bitcoin Max boarding plan',async()=>{
 const f=fixture(),plan=await planBoardingSdk(f.input);
 assert.equal(plan.amountSats,1000);assert.equal(plan.feeSats,0);assert.deepEqual(plan.outpoints,[`${'11'.repeat(32)}:0`]);assert.deepEqual(plan.outputs,[{amount:'1000',script:hex.encode(offchain.pkScript)}]);assert.equal(plan.sourceKind,'confirmed-bitcoin-only');
});

test('installed SDK partial boarding binds the whole original input and returns exact owned Bitcoin change',async()=>{
 const f=fixture(10000);Object.assign(f.quote,{amountSats:1000,netSats:1000,bitcoinAfterSats:9000,arkadeAfterSats:1000,inputOutpoints:[{txid:'11'.repeat(32),vout:0,valueSats:10000,assets:[]}]});
 const plan=await planBoardingSdk(f.input);
 assert.equal(plan.amountSats,1000);assert.equal(plan.quote.inputSats,10000);assert.deepEqual(plan.outpoints,[`${'11'.repeat(32)}:0`]);
 assert.deepEqual(plan.outputs,[{amount:'1000',script:hex.encode(offchain.pkScript)},{amount:'9000',script:hex.encode(boarding.pkScript)}]);
 for(const patch of [{inputOutpoints:undefined},{inputOutpoints:[{txid:'11'.repeat(32),vout:0,valueSats:9999,assets:[]}]},{amountSats:5001,netSats:5001}])
  await assert.rejects(planBoardingSdk({...f.input,quote:{...f.quote,...patch}}));
});

test('boarding selection permits only the production exclusion of its assigned Player',()=>{
 const a=assignment();
 assert.doesNotThrow(()=>assertLifecycleConnection({network:a.network,gameId:'stealth-and-steel',requirement:{purpose:'boarding',excludedProfiles:[a.playerProfileId]}},a));
 assert.throws(()=>assertLifecycleConnection({network:a.network,gameId:'stealth-and-steel',requirement:{purpose:'boarding',excludedProfiles:['d'.repeat(64)]}},a));
});
test('unsupported live fees, stale quote, unconfirmed/expired coins and cap excess refuse unsigned preparation',async()=>{
 const f=fixture();await assert.rejects(planBoardingSdk({...f.input,info:{...info,fees:{...info.fees,intentFee:{onchainInput:'amount * 0.01'}}}}));
 await assert.rejects(planBoardingSdk({...f.input,quote:{...f.quote,expiresAt:Date.now()-1}}));
 await assert.rejects(planBoardingSdk({...f.input,wallet:{...f.wallet,getBoardingUtxos:async()=>[{...coin(),status:{confirmed:false}}]}}));
 await assert.rejects(planBoardingSdk({...f.input,wallet:{...f.wallet,getBoardingUtxos:async()=>[{...coin(),status:{...coin().status,block_time:1}}]}}));
 await assert.rejects(planBoardingSdk(fixture(5001).input));
});
test('real SDK BIP322 intent and Game signatures bind exact inputs, value and message',async()=>{
 const plan=await planBoardingSdk(fixture().input),context={inputs:[coin() as IntentCoin],gamePublicKey,arkadeScript:offchain.pkScript,bitcoinScript:boarding.pkScript,dustAmount:330n,maximumExposureSats:1000};
 const message:Intent.RegisterMessage={type:'register',onchain_output_indexes:[],valid_at:0,expire_at:0,cosigners_public_keys:[gamePublicKey]};
 const unsigned=Intent.create(message,[...context.inputs],[{amount:1000n,script:offchain.pkScript}]),signed=await game.sign(unsigned,[0,1]);
 assert.equal(inspectBoardingIntent(signed,context,plan,Intent.encodeMessage(message),true).exposureSats,0);
 assert.throws(()=>inspectBoardingIntent(signed,context,{...plan,outputs:[{amount:'999',script:hex.encode(offchain.pkScript)}]}));
 assert.throws(()=>inspectBoardingIntent(signed,context,plan,Intent.encodeMessage({...message,expire_at:1}),true));
 const unsignedAgain=Intent.create(message,[...context.inputs],[{amount:1000n,script:offchain.pkScript}]);assert.throws(()=>inspectBoardingIntent(unsignedAgain,context,plan,Intent.encodeMessage(message),true));
});

test('SDK delete ownership proof is allowed only on the exact original signing scope, never registration',async()=>{
 const plan=await planBoardingSdk(fixture().input),context={inputs:[coin() as IntentCoin],gamePublicKey,arkadeScript:offchain.pkScript,bitcoinScript:boarding.pkScript,dustAmount:330n,maximumExposureSats:1000};
 const deletion=Intent.create({type:'delete',expire_at:0},[...context.inputs],[]),pending=Intent.create({type:'get-pending-tx',expire_at:0},[...context.inputs],[]);
 assert.throws(()=>inspectBoardingIntent(deletion,context,plan));
 assert.equal(inspectBoardingIntent(deletion,context,plan,undefined,false,true).kind,'delete');
 assert.throws(()=>inspectBoardingIntent(deletion,context,plan,undefined,true,true));
 assert.throws(()=>inspectBoardingIntent(pending,context,plan,undefined,false,true));
 assert.throws(()=>inspectBoardingIntent(deletion,context,{...plan,outpoints:['f'.repeat(64)+':0']},undefined,false,true));
});
async function receiptFixture(){
 const plan=await planBoardingSdk(fixture().input),root=new Transaction({version:3});root.addInput({txid:'11'.repeat(32),index:0});root.addOutput({script:offchain.pkScript,amount:1000n});
 const leaf=new Transaction({version:3});leaf.addInput({txid:root.id,index:0});leaf.addOutput({script:offchain.pkScript,amount:1000n});
 const record={id:'synthetic-board',version:1,profileId:plan.quote.profileId,network:'signet',status:'succeeded',phase:'registered',quote:plan.quote,inputs:[{txid:'11'.repeat(32),vout:0}],bitcoinAddress,intentId:'synthetic-intent',commitmentTxid:root.id};
 const transactions=[{txid:root.id,status:{confirmed:true},vin:[{txid:'11'.repeat(32),vout:0}],vout:[{value:1000}]}],receipts=[{txid:leaf.id,vout:0,value:1000,script:hex.encode(offchain.pkScript),commitmentTxIds:[root.id],assets:[]}];
 return {plan,record,transactions,receipts,rawCommitment:root.toBytes(false,false),virtual:async()=>({txs:[base64.encode(leaf.toPSBT())]}),leaf};
}
test('boarding proof traces actual commitment and virtual wire instead of a same-value balance',async()=>{
 const f=await receiptFixture();assert.equal((await traceBoardingReceipt(f)).ancestryVerified,true);
 await assert.rejects(traceBoardingReceipt({...f,virtual:async()=>({txs:[]})}));
 await assert.rejects(traceBoardingReceipt({...f,transactions:[{...f.transactions[0],status:{confirmed:false}}]}));
 await assert.rejects(traceBoardingReceipt({...f,receipts:[{...f.receipts[0],value:999}]}));
 await assert.rejects(traceBoardingReceipt({...f,receipts:[{...f.receipts[0],assets:[{assetId:'aa'.repeat(34),amount:1n}]}]}));
 const other=await receiptFixture();other.leaf.updateInput(0,{txid:'22'.repeat(32)});await assert.rejects(traceBoardingReceipt({...f,virtual:async()=>({txs:[base64.encode(other.leaf.toPSBT())]})}));
});
test('scope and authority guards reject unrelated commands, credentials, identity changes and missing batch grants',()=>{
 const a=assignment();assert.doesNotThrow(()=>validateLifecycleAssignment(a,'boarding'));
 assert.throws(()=>assertLifecycleAuthority(a,'run',a.runId,{BIS_SERVER_ACCEPTANCE_SLOT:a.runId,BIS_SERVER_FINANCIAL_SLOT:a.runId,BIS_ACCEPTANCE_OWNER_TOKEN:'synthetic'},'24.21.0'));
 assert.throws(()=>assertLifecycleAuthority(a,'prepare',a.runId,{},'24.21.0'));
 assert.throws(()=>assertLifecycleAuthority({...a,authorizationMode:'player-proof'},'prepare',a.runId,{BIS_SERVER_ACCEPTANCE_SLOT:a.runId,BIS_ACCEPTANCE_OWNER_TOKEN:'synthetic'},'24.21.0'));
 assert.equal(lifecycleScope(a),lifecycleScope({...a,approvedFingerprint:'b'.repeat(64),approvedOutpoints:['11'.repeat(32)+':0']}));
 assert.throws(()=>assertLifecycleConnection({gameId:'stealth-and-steel',network:a.network,profileId:'b'.repeat(64)},a));
 assert.throws(()=>assertBoardingServerPath({a,planToken:'plan',batchToken:'batch'},'owner/settlement/session/authorize',{method:'session.sign',ownerSettlementPlan:'plan',settlementBatchPlan:'wrong'}));
 assert.throws(()=>assertBoardingServerPath({a},'sign',{method:'sign'}));
 assert.throws(()=>assertBoardingServerPath({a,planToken:'plan'},'owner/settlement/session/authorize',{method:'session.sign',ownerSettlementPlan:'plan'}));
});
test('boarding CLI refuses before reading any assignment or private wallet without its exact slot',()=>{
 const result=spawnSync(process.execPath,['BIS/packages/bis-server/scripts/funded-workflow-boarding.ts','run','absent-private-assignment.json','boarding-case-01'],{encoding:'utf8',timeout:20000,env:{...process.env,BIS_SERVER_ACCEPTANCE_SLOT:'',BIS_SERVER_FINANCIAL_SLOT:''}});
 assert.equal(result.status,1);assert.equal(result.stdout.trim().split(/\r?\n/).length,1);assert.equal(JSON.parse(result.stdout).reason,'guarded-lifecycle-acceptance-incomplete');assert.ok(!result.stdout.includes('absent-private'));
});
