import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizedAdapterFixture} from './treasure-authorized-adapter-fixture.ts';
import {prepareAuthorizedTreasureTransaction,attachAuthorizedTreasurePlayerProof,authorizedTreasureGameProofRequest,
  completeAuthorizedTreasureTransaction,validateAuthorizedTreasureActorTemplate} from '../../src/client/wallet-layer-arkade/treasure-authorized-transaction.ts';
import {validateStagedTreasureBinding} from '../../src/client/wallet-layer-arkade/treasure-staged-state.ts';

test('actual SDK construction completes every V4 branch with a distinct exact checkpoint forfeit authority',async()=>{
  for(const branch of ['claim','reject','cancel','refund'] as const){
    const f=await authorizedAdapterFixture(branch);validateStagedTreasureBinding(f.binding);
    assert.notEqual(f.forfeit,f.binding.terms.operator);
    assert.equal(f.binding.checkpointTapscript,f.input.checkpointTapscript);
    assert.equal(f.template.digest,f.zero.digest);assert.equal(f.template.actorTemplate.checkpoints[0],f.binding.original.checkpoints[0]);
    assert.ok(Object.isFrozen(f.binding.original));validateAuthorizedTreasureActorTemplate(JSON.parse(JSON.stringify(f.template)));
    if(branch==='claim')assert.throws(()=>authorizedTreasureGameProofRequest(f.template));
    else {
      if(branch!=='refund')assert.throws(()=>authorizedTreasureGameProofRequest(f.zero));
      const request=authorizedTreasureGameProofRequest(f.template);
      assert.equal(request.arkTx,f.template.actorTemplate.arkTx);assert.equal(request.operationId,f.input.operationId);
      assert.notEqual(request.arkTx,f.binding.original.arkTx);
    }
  }
});
test('actor proofs, roles and immutable original template cannot be replaced or forged',async()=>{
  const f=await authorizedAdapterFixture('reject');
  assert.throws(()=>attachAuthorizedTreasurePlayerProof(f.zero,f.proof('game')));
  assert.throws(()=>completeAuthorizedTreasureTransaction(f.zero,f.proof('game')));
  assert.throws(()=>completeAuthorizedTreasureTransaction(f.template,f.proof('player')));
  assert.throws(()=>completeAuthorizedTreasureTransaction(f.template,'00'.repeat(64)));
  assert.throws(()=>validateAuthorizedTreasureActorTemplate({...f.template,digest:'00'.repeat(32)}));
  assert.throws(()=>validateAuthorizedTreasureActorTemplate({...f.template,input:{...f.input,terms:{...f.input.terms,hostReference:'replacement'}}}));
  const refund=await authorizedAdapterFixture('refund');assert.throws(()=>attachAuthorizedTreasurePlayerProof(refund.zero,refund.proof('player')));
  const claim=await authorizedAdapterFixture();assert.throws(()=>completeAuthorizedTreasureTransaction(claim.template,claim.proof('game')));
});
test('construction rejects altered funding linkage, amount, network, branch and raw transaction',async()=>{
  const f=await authorizedAdapterFixture();
  for(const input of [{...f.input,funding:{...f.input.funding,value:999}}, {...f.input,funding:{...f.input.funding,vout:1}},
    {...f.input,funding:{...f.input.funding,txid:'11'.repeat(32)}},{...f.input,previousTransaction:'00'},
    {...f.input,terms:{...f.input.terms,network:'signet'}},{...f.input,branch:'arbitrary'}]){
    assert.throws(()=>prepareAuthorizedTreasureTransaction(input as typeof f.input));
  }
});
