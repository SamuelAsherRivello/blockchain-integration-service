import test from 'node:test';
import assert from 'node:assert/strict';
import {withContractActivity,transactionRowPresentation} from '../src/core/activity.ts';
test('funding and claims correlate by exact IDs without implying a pending player payout is complete',()=>{
  const funding='a'.repeat(64),claim='b'.repeat(64);
  const contract={id:'offer',amountSats:1000,operationKind:'claim',operationId:'claim-op',financial:'claiming',fundingTransactionId:funding,transactionId:claim,evidence:'local record'};
  const sdk=[{id:'sdk',identifier:`ark:${claim}`,amountSats:1000,direction:'Incoming',status:'Pending offchain'}];
  const rows=withContractActivity(sdk,[contract]);assert.equal(rows.length,2);
  assert.equal(rows[0].kind,'Contract claim');assert.equal(rows[0].status,'Pending offchain');
  assert.equal(rows[1].direction,'Game → Contract');assert.equal(rows[1].status,'Settled offchain');
  assert.match(transactionRowPresentation(rows[0]).heading,/Contract claim/);
  const confirmed=withContractActivity([],[{...contract,financial:'claimed',evidence:'verified receipt'}]);
  assert.equal(confirmed[1].status,'Settled offchain');
  const unrelated=withContractActivity([{...sdk[0],identifier:`ark:${'c'.repeat(64)}`}],[contract]);assert.equal(unrelated.length,3);
});
