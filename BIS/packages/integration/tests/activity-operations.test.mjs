import test from 'node:test';
import assert from 'node:assert/strict';
import {withWalletOperationActivity, operationMatches, formatOperationRecovery} from '../src/core/activity-operations.ts';
const operation = (id, extra = {}) => ({id, inputsKnown:true, canDiscard:false, ...extra});
const row = (id, identifier=id) => ({id,identifier,amountSats:1000,direction:'Outgoing',status:'Settled offchain'});

test('pending sends and continuations attach to existing network history without duplicating amounts', () => {
  const rows=[row('sdk','ark:abc')];
  const operations=[operation('send:one',{transactionId:'abc'}),operation('continue:two',{transactionId:'abc'})];
  assert.deepEqual(withWalletOperationActivity(rows,operations),rows);
  for(const op of operations) assert.equal(operationMatches(rows[0],op),true);
  assert.equal(operationMatches(rows[0],operation('send:other',{transactionId:'ab'})),false);
});
test('transfer and mint operation references join existing history; only unsent drafts are relabeled', () => {
  const rows=[row('transfer-sdk','operation:draft commitment:abc'),row('mint-sdk','mint-operation:mint ark:def')];
  const merged=withWalletOperationActivity(rows,[operation('transfer:draft',{canDiscard:true}),operation('mint:mint')]);
  assert.equal(merged.length,2);assert.equal(merged[0].status,'Not submitted');
  assert.equal(merged[1].status,'Settled offchain');assert.equal(rows[0].status,'Settled offchain');
});
test('missing operation records stay inspectable with honest amount, status and timestamps', () => {
  const merged=withWalletOperationActivity([row('history')],[operation('burn:one'),operation('continue:two',{amountSats:1000})]);
  assert.equal(merged.length,3);assert.equal(merged[0].satsUnknown,true);
  assert.equal(merged[0].status,'Pending — outcome unknown');assert.equal(merged[0].createdAt,undefined);
  assert.equal(merged[1].kind,'Continue payment');assert.equal(merged[1].amountSats,1000);
  assert.equal(withWalletOperationActivity([row('history')],[]).length,1);
});
test('recovery details contain only selected operation and truthful discard semantics', () => {
  const text=formatOperationRecovery(operation('transfer:one',{canDiscard:true,reservedInputSats:2000}));
  assert.match(text,/2000 sats/);assert.match(text,/does not cancel a submitted transaction/);
  assert.doesNotMatch(text,/transfer:two/);
});
