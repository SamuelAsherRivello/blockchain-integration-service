import test from 'node:test';
import assert from 'node:assert/strict';
import {CSVMultisigTapscript,DefaultVtxo,SingleKey,Transaction,asset} from '@arkade-os/sdk';
import {base64,hex} from '@scure/base';
import {prepareAssetSdkPlan,validateAssetPlan,decodeAssetTransaction,inspectAssetSubmission,inspectAssetFinalization,observeAssetReceipt,assetBudgetSats,assetHash,assetMetadata,type AssetIntent,type AssetPlan} from '../scripts/funded-workflow-asset-plan.ts';
import type {TrustedAssetContext} from '../src/server/asset-policy.ts';

// All keys, prevouts and receipts in this file are synthetic and unfunded.
// Installed SDK planners and cryptography run; no network operation is provided.
const game=SingleKey.fromHex('1'.padStart(64,'0')),player=SingleKey.fromHex('2'.padStart(64,'0')),operator=SingleKey.fromHex('3'.padStart(64,'0'));
const operatorKey=await operator.xOnlyPublicKey(),gameKey=hex.encode(await game.xOnlyPublicKey());
const own=new DefaultVtxo.Script({pubKey:await game.xOnlyPublicKey(),serverPubKey:operatorKey,csvTimelock:{type:'seconds',value:1024n}});
const destination=new DefaultVtxo.Script({pubKey:await player.xOnlyPublicKey(),serverPubKey:operatorKey,csvTimelock:{type:'seconds',value:1024n}});
const lineage=asset.AssetId.create('aa'.repeat(32),0).toString(),unrelated=asset.AssetId.create('bb'.repeat(32),0).toString();
function context(quantity?:bigint):TrustedAssetContext{
  return {inputs:[{txid:'11'.repeat(32),vout:0,value:3000,tapTree:own.encode(),tapLeafScript:own.forfeit(),
    assets:[...(quantity?[{assetId:lineage,amount:quantity}]:[]),{assetId:unrelated,amount:5n}]}],
    changeScript:own.pkScript,recipientScript:destination.pkScript,maximumExposureSats:1000,
    serverUnrollScript:CSVMultisigTapscript.encode({pubkeys:[operatorKey],timelock:{type:'seconds',value:86016n}})};
}
function intent(step:AssetIntent['step'],authorizationMode:AssetIntent['authorizationMode']='owner'):AssetIntent{
  return {step,authorizationMode,operationId:`offline-asset-${step}`,carrierSats:330,gamePublicKey:gameKey,...(step==='mint'?{}:{assetId:lineage})};
}
async function prepared(step:AssetIntent['step'],mode:AssetIntent['authorizationMode']='owner'){
  const c=context(step==='delivery'?(mode==='owner'?2n:1n):step==='burn'?1n:undefined),i=intent(step,mode);
  return {plan:await prepareAssetSdkPlan(c,i,operatorKey,330n),context:c,intent:i};
}
function indexer(plan:AssetPlan){
  const checkpoints=plan.unsignedCheckpoints.map(decodeAssetTransaction);
  const rows:any[]=[...plan.source.map(coin=>({...coin,assets:coin.assets.map(a=>({...a,amount:BigInt(a.amount)})),isSpent:true,
    spentBy:checkpoints.find(tx=>hex.encode(tx.getInput(0).txid!)===coin.txid&&tx.getInput(0).index===coin.vout)!.id})),
    ...plan.outputs.map(coin=>({...coin,assets:coin.assets.map(a=>({...a,amount:BigInt(a.amount)}))}))];
  return {rows,getVtxos:async()=>({vtxos:rows}),getVirtualTxs:async()=>({txs:[plan.unsignedArkTx,...plan.unsignedCheckpoints]})};
}

test('installed SDK issue, exact selected send and burn planners preserve one owner asset lineage and unrelated assets',async()=>{
  const mint=await prepared('mint'),delivery=await prepared('delivery'),burn=await prepared('burn');
  assert.equal(mint.plan.outputs[0].assets.find(a=>a.assetId===mint.plan.assetId)?.amount,'2');
  assert.equal(delivery.plan.outputs[0].assets.find(a=>a.assetId===lineage)?.amount,'1');
  assert.equal(delivery.plan.outputs[1].assets.find(a=>a.assetId===lineage)?.amount,'1');
  assert.equal(burn.plan.outputs[0].assets.some(a=>a.assetId===lineage),false);
  for(const {plan} of [mint,delivery,burn]){
    assert.equal(plan.outputs.flatMap(o=>o.assets).filter(a=>a.assetId===unrelated).reduce((sum,a)=>sum+BigInt(a.amount),0n),5n);
    assert.equal(plan.feeSats,0);assert.equal(plan.authorizationMode,'owner');
  }
  assert.equal(delivery.plan.exposureSats,330);assert.equal(mint.plan.exposureSats,0);assert.equal(burn.plan.exposureSats,0);
});

test('public one-NFT issue and delivery do not claim a remaining Game asset or burn coverage',async()=>{
  const mint=await prepared('mint','player-proof'),delivery=await prepared('delivery','player-proof');
  assert.equal(mint.plan.outputs[0].assets.find(a=>a.assetId===mint.plan.assetId)?.amount,'1');
  assert.equal(delivery.plan.outputs[0].assets.find(a=>a.assetId===lineage)?.amount,'1');
  assert.equal(delivery.plan.outputs[1].assets.some(a=>a.assetId===lineage),false);
  assert.equal(mint.plan.authorizationMode,'player-proof');
  await assert.rejects(prepareAssetSdkPlan(context(1n),intent('burn','player-proof'),operatorKey,330n));
});

test('exact budget is zero only for proved zero-fee retained principal and equals the delivery carrier debit',async()=>{
  for(const step of ['mint','delivery','burn'] as const){
    const {plan}=await prepared(step);assert.equal(assetBudgetSats(plan),step==='delivery'?330:0);
    assert.equal(plan.budgetSats,plan.exposureSats);
  }
});

test('missing or unsafe costs, altered original inputs and over-cap plans cannot be treated as zero',async()=>{
  const {plan}=await prepared('mint');
  for(const patch of [{feeSats:undefined},{feeSats:1},{exposureSats:undefined},{exposureSats:NaN},{exposureSats:-1},{exposureSats:1001,budgetSats:1001},
    {budgetSats:undefined},{outpoints:[]},{outpoints:[...plan.outpoints,...plan.outpoints]},{source:plan.source.map(coin=>({...coin,value:NaN}))}])
    assert.throws(()=>assetBudgetSats({...plan,...patch} as AssetPlan));
  assert.throws(()=>assetBudgetSats(undefined));
  const altered={...plan,source:plan.source.map(coin=>({...coin,txid:'ff'.repeat(32)})),outpoints:[`${'ff'.repeat(32)}:0`]};
  const {fingerprint:_old,...bound}=altered;altered.fingerprint=assetHash(bound);
  assert.throws(()=>assetBudgetSats(altered));
});

test('unsigned preparation has no signing or network capability and a changed public quantity fails',async()=>{
  const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('No network in unsigned fixture.');};
  try{
    const {plan,context:c,intent:i}=await prepared('mint');
    assert.equal(calls,0);assert.equal(decodeAssetTransaction(plan.unsignedArkTx).getInput(0).tapScriptSig,undefined);
    assert.throws(()=>validateAssetPlan(decodeAssetTransaction(plan.unsignedArkTx),c,{...i,authorizationMode:'player-proof'}));
  }finally{globalThis.fetch=original;}
});

test('actual SDK issuance selection retains fresh expiry metadata instead of substituting value-only ordering',async()=>{
  const c=context(),second={...c.inputs[0],txid:'22'.repeat(32),value:5000};
  c.inputs=[...c.inputs,second];
  const plan=await prepareAssetSdkPlan(c,intent('mint'),operatorKey,330n,[
    {txid:c.inputs[0].txid,vout:0,expiresAt:new Date('2030-01-01')},{txid:second.txid,vout:0,expiresAt:new Date('2031-01-01')},
  ]);
  assert.deepEqual(plan.outpoints,[`${c.inputs[0].txid}:0`]);
});

test('mint metadata and every original asset allocation must match actual SDK packet bytes',async()=>{
  const f=await prepared('mint'),tx=decodeAssetTransaction(f.plan.unsignedArkTx);
  assert.throws(()=>validateAssetPlan(tx,f.context,{...f.intent,operationId:'changed-operation'}));
  assert.throws(()=>validateAssetPlan(tx,{...f.context,inputs:f.context.inputs.map(coin=>({...coin,assets:coin.assets.map(a=>({...a,amount:4n}))}))},f.intent));
  assert.equal(assetMetadata(f.intent.operationId).bisOperationId,f.intent.operationId);
});

test('delivery refuses extra quantity, lost unrelated holdings, redirected sats, or a nonzero fee',async()=>{
  const f=await prepared('delivery'),tx=decodeAssetTransaction(f.plan.unsignedArkTx);
  const fee=tx.clone();fee.updateOutput(1,{amount:2669n});assert.throws(()=>validateAssetPlan(fee,f.context,f.intent));
  const redirected=tx.clone();redirected.updateOutput(0,{script:own.pkScript});assert.throws(()=>validateAssetPlan(redirected,f.context,f.intent));
  assert.throws(()=>validateAssetPlan(tx,{...f.context,inputs:f.context.inputs.map(coin=>({...coin,assets:coin.assets.map(a=>({...a,amount:a.assetId===lineage?3n:a.amount}))}))},f.intent));
});

test('provider submission requires real Game signatures on the exact original root and every checkpoint',async()=>{
  const {plan}=await prepared('mint');
  const body={signedArkTx:plan.unsignedArkTx,checkpointTxs:plan.unsignedCheckpoints};
  assert.throws(()=>inspectAssetSubmission(body,plan));
  const signedRoot=await game.sign(decodeAssetTransaction(plan.unsignedArkTx));
  const signedCheckpoints=await Promise.all(plan.unsignedCheckpoints.map(async encoded=>base64.encode((await game.sign(decodeAssetTransaction(encoded))).toPSBT())));
  const signed={signedArkTx:base64.encode(signedRoot.toPSBT()),checkpointTxs:signedCheckpoints};
  assert.equal(inspectAssetSubmission(signed,plan).transactionId,plan.transactionId);
  assert.doesNotThrow(()=>inspectAssetFinalization({arkTxid:plan.transactionId,finalCheckpointTxs:signedCheckpoints},plan));
  assert.throws(()=>inspectAssetFinalization({arkTxid:plan.transactionId,finalCheckpointTxs:plan.unsignedCheckpoints},plan));
  assert.throws(()=>inspectAssetFinalization({arkTxid:'ff'.repeat(32),finalCheckpointTxs:signedCheckpoints},plan));
  const altered=decodeAssetTransaction(plan.unsignedArkTx),input=altered.getInput(0);
  altered.updateInput(0,{witnessUtxo:{...input.witnessUtxo!,amount:2999n}});
  const signedAltered=await game.sign(altered);
  assert.throws(()=>inspectAssetSubmission({...signed,signedArkTx:base64.encode(signedAltered.toPSBT())},plan));
  assert.throws(()=>inspectAssetSubmission({...signed,checkpointTxs:[]},plan));
});

test('fresh exact indexed sources, checkpoint ancestry, wire, quantities and carrier outputs prove each synthetic receipt',async()=>{
  for(const step of ['mint','delivery','burn'] as const){const {plan}=await prepared(step),fixture=indexer(plan),receipt=await observeAssetReceipt(fixture,plan);
    assert.equal(receipt.verified,true);assert.equal(receipt.transactionId,plan.transactionId);assert.equal(receipt.authorizationMode,'owner');}
});

test('a disappeared balance, missing wire, unrelated spend, wrong quantity or paginated index answer cannot prove burn',async()=>{
  const {plan}=await prepared('burn'),fixture=indexer(plan);
  await assert.rejects(observeAssetReceipt({...fixture,getVirtualTxs:async()=>({txs:[]})},plan));
  await assert.rejects(observeAssetReceipt({...fixture,getVtxos:async()=>({vtxos:[],page:'more'})},plan));
  fixture.rows[0].spentBy='ff'.repeat(32);await assert.rejects(observeAssetReceipt(fixture,plan));
  fixture.rows[0].spentBy=decodeAssetTransaction(plan.unsignedCheckpoints[0]).id;
  fixture.rows[1].assets.push({assetId:lineage,amount:1n});await assert.rejects(observeAssetReceipt(fixture,plan));
});
