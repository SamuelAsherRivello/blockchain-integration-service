import test from 'node:test';
import assert from 'node:assert/strict';
import {Transaction,Extension,createAssetPacket} from '@arkade-os/sdk';
import {hex,base64} from '@scure/base';
import {assetManifest,verifyTreasureAssetFunding} from './test-wallets/treasure-asset-evidence.ts';
function fixture(){
  const gameScript='5120'+'1'.repeat(64),contractScript='5120'+'2'.repeat(64),assetId='a'.repeat(68);
  const inputs=[{txid:'b'.repeat(64),vout:2,value:5000,assets:[{assetId,amount:'9007199254740993'}]}];
  const checkpoint=new Transaction();checkpoint.addInput({txid:inputs[0].txid,index:2});
  checkpoint.addOutput({amount:5000n,script:hex.decode(gameScript)});checkpoint.addOutput({amount:0n,script:hex.decode('51024e73')});
  const extension=Extension.create([createAssetPacket(new Map([[0,[{assetId,amount:9007199254740993n}]]]),[{address:'',amount:1000}],{address:'',amount:4000,assets:[{assetId,amount:9007199254740993n}]})]).txOut();
  const funding=new Transaction();funding.addInput({txid:checkpoint.id,index:0});funding.addOutput({amount:1000n,script:hex.decode(contractScript)});
  funding.addOutput({amount:4000n,script:hex.decode(gameScript)});funding.addOutput(extension);funding.addOutput({amount:0n,script:hex.decode('51024e73')});
  const vtxos=[{...inputs[0],script:gameScript,isSpent:true,arkTxId:funding.id,spentBy:checkpoint.id},
    {txid:funding.id,vout:0,value:1000,script:contractScript,assets:[]},
    {txid:funding.id,vout:1,value:4000,script:gameScript,assets:inputs[0].assets}];
  const txs=[funding,checkpoint].map(tx=>base64.encode(tx.toPSBT()));
  return {vtxos,txs,input:{fundingTxid:funding.id,contractScript,gameScript,inputs},indexer:{getVtxos:async()=>({vtxos}),getVirtualTxs:async()=>({txs})}};
}
test('asset funding evidence preserves exact bigint quantities through original inputs, checkpoints, wire and change',async()=>{
  const f=fixture(),proof=await verifyTreasureAssetFunding(f.indexer,f.input);
  assert.equal(proof.retainedAssets[0].amount,'9007199254740993');assert.equal(proof.changeSats,4000);
});
test('asset funding evidence refuses unrelated, missing, altered or unspent source/change receipts',async()=>{
  for(const alter of [f=>f.vtxos[0].isSpent=false,f=>f.vtxos[0].arkTxId='c'.repeat(64),f=>f.vtxos[2].value=3999,
    f=>f.vtxos[2].assets=[{assetId:'a'.repeat(68),amount:'9007199254740992'}],f=>f.txs.pop(),f=>f.vtxos[1].assets=f.input.inputs[0].assets]){
    const f=fixture();alter(f);await assert.rejects(verifyTreasureAssetFunding(f.indexer,f.input));
  }
});
test('asset preconditions cannot silently turn a plain-sats case into an asset proof',async()=>{
  const f=fixture();f.input.inputs[0].assets=[];await assert.rejects(verifyTreasureAssetFunding(f.indexer,f.input),/precondition/);
  assert.throws(()=>assetManifest([{assets:[{assetId:'a'.repeat(68),amount:'0'}]}]));
});
