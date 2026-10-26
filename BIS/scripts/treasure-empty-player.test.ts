import test from 'node:test';
import assert from 'node:assert/strict';
import {Transaction} from '@arkade-os/sdk';
import {base64,hex} from '@scure/base';
import {authorizedAdapterFixture} from '../packages/integration/tests/client/treasure-authorized-adapter-fixture.ts';

test('a full treasure claim needs only the funded contract input and no Player balance or additional input',async t=>{
  // Public test scalars and actual SDK transaction construction only. No wallet
  // is created and any attempted provider request fails this fixture.
  t.mock.method(globalThis,'fetch',async()=>{throw Error('Network forbidden in empty-player fixture');});
  const {binding}=await authorizedAdapterFixture('claim');
  assert.equal(binding.original.checkpoints.length,1);
  const checkpoint=Transaction.fromPSBT(base64.decode(binding.original.checkpoints[0]));
  const payout=Transaction.fromPSBT(base64.decode(binding.original.arkTx));
  assert.equal(checkpoint.inputsLength,1);
  assert.equal(hex.encode(checkpoint.getInput(0).txid!),binding.funding.txid);
  assert.equal(checkpoint.getInput(0).index,binding.funding.vout);
  assert.equal(checkpoint.getInput(0).witnessUtxo?.amount,1000n);
  assert.equal(payout.inputsLength,1);
  assert.equal(hex.encode(payout.getInput(0).txid!),checkpoint.id);
  assert.equal(payout.getInput(0).index,0);
  assert.equal(payout.getOutput(0).amount,1000n);
  assert.equal(hex.encode(payout.getOutput(0).script!),'5120'+binding.terms.playerDestination);
  const amounts=Array.from({length:payout.outputsLength},(_,i)=>{
    const amount=payout.getOutput(i).amount;
    assert.ok(typeof amount==='bigint','every payout output must retain its exact amount');
    return amount;
  });
  assert.equal(amounts.reduce((sum,value)=>sum+value,0n),1000n);
});
