import test from 'node:test';
import assert from 'node:assert/strict';
import {Transaction} from '@arkade-os/sdk';
import {hex,base64} from '@scure/base';
import {verifyTreasureSpendReceipt} from './test-wallets/treasure-receipt.ts';

function fixture(unrelated=false){
  const fundingTxid='a'.repeat(64),contractScript='5120'+'1'.repeat(64),destinationScript='5120'+'2'.repeat(64),checkpointScript='5120'+'3'.repeat(64);
  const tx=(input,source,destination)=>{
    const t=new Transaction();
    t.addInput({txid:input,index:0,witnessUtxo:{amount:1000n,script:hex.decode(source)}});
    t.addOutput({amount:1000n,script:hex.decode(destination)});return t;
  };
  const checkpoint=tx(unrelated?'b'.repeat(64):fundingTxid,contractScript,checkpointScript);
  const spend=tx(checkpoint.id,checkpointScript,destinationScript);
  const vtxos=[{txid:fundingTxid,vout:0,value:1000,script:contractScript,isSpent:true,spentBy:checkpoint.id,assets:[]},
    {txid:spend.id,vout:0,value:1000,script:destinationScript,assets:[]}];
  return {vtxos,indexer:{getVtxos:async()=>({vtxos}),getVirtualTxs:async()=>({txs:[checkpoint,spend].map(t=>base64.encode(t.toPSBT()))})},
    expected:{fundingTxid,contractScript,spendTxid:spend.id,destinationScript}};
}

test('treasure receipt binds the contract outpoint through its actual checkpoint to payout',async()=>{
  const f=fixture();const receipt=await verifyTreasureSpendReceipt(f.indexer,f.expected);
  assert.equal(receipt.fundingTxid,f.expected.fundingTxid);assert.equal(receipt.spendTxid,f.expected.spendTxid);assert.equal(receipt.amountSats,1000);
});

test('same-value payment from another source cannot prove a treasure contract spend',async()=>{
  const f=fixture(true);await assert.rejects(verifyTreasureSpendReceipt(f.indexer,f.expected),/chain-mismatch/);
});

test('treasure evidence rejects wrong amount, destination, assets and an unspent contract',async()=>{
  for(const change of [f=>f.vtxos[1].value=999,f=>f.vtxos[1].script='5120'+'4'.repeat(64),f=>f.vtxos[1].assets=[{amount:'1'}],f=>f.vtxos[0].isSpent=false]){
    const f=fixture();change(f);await assert.rejects(verifyTreasureSpendReceipt(f.indexer,f.expected),/index-mismatch/);
  }
});
