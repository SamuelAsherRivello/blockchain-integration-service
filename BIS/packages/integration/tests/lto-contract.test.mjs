import test from 'node:test';
import assert from 'node:assert/strict';
import { selectLtoInputs, verifyLtoReceipt } from '../src/arkade/lto-contract.ts';

const txid = n => String(n).repeat(64);
const coin = (n, value, extra = {}) => ({ txid: txid(n), vout: 0, value, script: '5120aa', ...extra });
test('funding prefers asset-free inputs and excludes spent or reserved funds', () => {
  const coins = [coin(1, 1000, { assets: [{ assetId: 'asset', amount: 1n }] }), coin(2, 1000), coin(3, 2000), coin(4, 1000, { isSpent: true })];
  const selected = selectLtoInputs(coins, 1000, 330, [{ id: 'other', inputs: [{ txid: txid(2), vout: 0 }] }]);
  assert.deepEqual(selected.map(c => c.txid), [txid(3)]);
  assert.equal(selected.reduce((sum,c) => sum+c.value,0) - 1000, 1000);
  assert.throws(() => selectLtoInputs([coin(1, 1100)], 1000, 330, []));
  assert.throws(() => selectLtoInputs(coins, 1000, 330, [{ id: 'unknown' }]));
});
test('independent small inputs can fund an exact reward without drawing on reserved funds', () => {
  const selected = selectLtoInputs([coin(1, 600), coin(2, 400)], 1000, 330, []);
  assert.equal(selected.reduce((sum,c) => sum+c.value,0), 1000);
});

test('funding can use an asset carrier only with enough game change to retain every asset',()=>{
  const carrier=coin(6,53000,{assets:[{assetId:'ab'.repeat(34),amount:1n}]});
  assert.deepEqual(selectLtoInputs([carrier],1000,330,[]),[carrier]);
  assert.throws(()=>selectLtoInputs([{...carrier,value:1000}],1000,330,[]));
  assert.throws(()=>selectLtoInputs([{...carrier,value:1200}],1000,330,[]));
  assert.deepEqual(selectLtoInputs([carrier,coin(7,2000)],1000,330,[]),[coin(7,2000)]);
});

test('asset-bearing funding confirms only when every source asset returns in exact game change',()=>{
  const assets=[{assetId:'ab'.repeat(34),amount:3n}];
  const preserved={...spend,change:{...spend.change,assets:[{assetId:assets[0].assetId,amount:'3'}]}};
  const inputs=[{...sources[0],assets}],outputs=[receipts[0],{...receipts[1],assets}];
  assert.equal(verifyLtoReceipt(preserved,outputs,inputs),true);
  assert.equal(verifyLtoReceipt(preserved,receipts,inputs),false);
  assert.equal(verifyLtoReceipt(preserved,[outputs[0],{...outputs[1],assets:[{...assets[0],amount:2n}]}],inputs),false);
  assert.equal(verifyLtoReceipt(preserved,[{...outputs[0],assets},outputs[1]],inputs),false);
});
const spend = { operationId: 'fund', transactionId: txid(8), inputs: [coin(1, 2000)], destinationScript: '5120bb', amountSats: 1000, change: { script: '5120aa', value: 1000 } };
const receipts = [coin(8,1000,{ script:'5120bb' }), coin(8,1000,{ vout:1 })];
const sources = [coin(1,2000,{ spentBy: txid(7), arkTxId:txid(8) })];
test('receipt verification requires exact source spend, recipient, amount and change', () => {
  assert.equal(verifyLtoReceipt(spend, receipts, sources), true);
  assert.equal(verifyLtoReceipt(spend, receipts.slice(0,1), sources), false);
  assert.equal(verifyLtoReceipt(spend, receipts, [coin(1,2000)]), false);
  assert.equal(verifyLtoReceipt(spend, receipts, [coin(1,2000,{spentBy:txid(7),arkTxId:txid(9)})]), false);
  assert.equal(verifyLtoReceipt(spend, [coin(8,1000,{script:'5120cc'}),receipts[1]], sources), false);
  assert.equal(verifyLtoReceipt(spend, [coin(8,999,{script:'5120bb'}),receipts[1]], sources), false);
  assert.equal(verifyLtoReceipt(spend, [coin(8,1000,{script:'5120bb',assets:[{}]}),receipts[1]], sources), false);
});
test('a later-spent receipt still proves the original spend, while a competing refund cannot confirm a claim', () => {
  assert.equal(verifyLtoReceipt(spend, [{...receipts[0],isSpent:true},receipts[1]], sources), true);
  assert.equal(verifyLtoReceipt({ ...spend, transactionId:txid(9) }, receipts, sources), false);
});
