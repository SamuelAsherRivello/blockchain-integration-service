import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyContractLedger, startLto, endContract, beginContractOperation,
  markContractSubmission, finishContractOperation, presentContract, checkContracts,
} from '../src/core/contracts.ts';

const scope = { network: 'signet', operator: 'https://signet.arkade.sh', playerId: 'player', gameId: 'game', exclusivityKey: 'treasure' };
const request = { scope, id: 'contract-1', sessionId: 'session-1', operationId: 'fund-1', purpose: 'treasureLTO', hostReference: 'chest-1', amountSats: 1000, startedAt: 1000, expiresAt: 91000 };
const start = () => startLto(emptyContractLedger(), request, 1000);
const funded = () => finishContractOperation(start().contract, { operationId: 'fund-1', kind: 'fund', outcome: 'confirmed' });

test('deadline is immutable and funding does not extend the eligibility window', () => {
  const contract = funded();
  assert.equal(presentContract(contract, 90999).canClaim, true);
  assert.equal(presentContract(contract, 91000).canClaim, false);
  assert.equal(presentContract(contract, 91000).eligibility, 'expired');
  assert.equal(presentContract(contract, 91000).financial, 'funded');
  assert.equal(contract.expiresAt, request.expiresAt);
});

test('duplicates reuse their original attempt, even after terminal settlement', () => {
  const first = start();
  assert.equal(startLto(first.ledger, { ...request, id: 'ignored', operationId: 'ignored' }, 2000).contract.id, request.id);
  const refunded = finishContractOperation(beginContractOperation(funded(), 'refund', 'refund-1', 2000), { operationId: 'refund-1', kind: 'refund', outcome: 'confirmed' });
  const ledger = { ...first.ledger, contracts: [refunded] };
  assert.equal(startLto(ledger, request, 3000).contract.financial, 'refunded');
  assert.equal(startLto(ledger, request, 3000).ledger.contracts.length, 1);
});

test('unresolved offers occupy the slot and a blocked session never receives a late replacement', () => {
  const first = start();
  const next = { ...request, id: 'contract-2', sessionId: 'session-2', operationId: 'fund-2' };
  const blocked = startLto(first.ledger, next, 2000);
  assert.equal(blocked.status, 'occupied');
  const failed = finishContractOperation(first.contract, { operationId: 'fund-1', kind: 'fund', outcome: 'not-submitted' });
  const ledger = { ...blocked.ledger, contracts: [failed] };
  assert.equal(startLto(ledger, next, 3000).status, 'occupied');
  assert.equal(startLto(ledger, { ...next, sessionId: 'session-3' }, 3000).status, 'created');
});

test('player, game, network, operator and host key isolate queries and exclusivity', () => {
  const first = start();
  for (const key of Object.keys(scope)) {
    const otherScope = { ...scope, [key]: 'other' };
    assert.deepEqual(checkContracts(first.ledger, otherScope, 1000), []);
    assert.equal(startLto(first.ledger, { ...request, scope: otherScope, id: `other-${key}` }, 1000).status, 'created');
  }
  assert.equal(checkContracts(first.ledger, scope, 1000).length, 1);
});

test('end during funding persists forfeiture and late funding can only be refunded', () => {
  const ended = endContract(start().contract, 'session-ended');
  const late = finishContractOperation(ended, { operationId: 'fund-1', kind: 'fund', outcome: 'confirmed' });
  assert.equal(presentContract(late, 2000).eligibility, 'ended');
  assert.equal(presentContract(late, 2000).canRefund, true);
  assert.throws(() => beginContractOperation(late, 'claim', 'claim-1', 2000));
});

test('claim is checked at request and again immediately before submission', () => {
  assert.throws(() => beginContractOperation(funded(), 'claim', 'claim-1', 91000));
  const prepared = beginContractOperation(funded(), 'claim', 'claim-1', 90000);
  assert.throws(() => markContractSubmission(prepared, 'claim-1', 91000));
  const released = finishContractOperation(prepared, { operationId: 'claim-1', kind: 'claim', outcome: 'not-submitted' });
  assert.equal(presentContract(released, 91000).canRefund, true);
});

test('possibly submitted claim blocks refund and can confirm successfully after expiry', () => {
  const submitted = markContractSubmission(beginContractOperation(funded(), 'claim', 'claim-1', 90000), 'claim-1', 90001);
  const unknown = markContractSubmission(submitted, 'claim-1', 92000, true);
  assert.equal(presentContract(unknown, 92000).canRefund, false);
  assert.throws(() => beginContractOperation(unknown, 'refund', 'refund-1', 92000));
  assert.throws(() => finishContractOperation(unknown, { operationId: 'claim-1', kind: 'claim', outcome: 'not-submitted' }));
  const claimed = finishContractOperation(unknown, { operationId: 'claim-1', kind: 'claim', outcome: 'confirmed' });
  assert.equal(claimed.financial, 'claimed');
  assert.equal(claimed.expiresAt, 91000);
});

test('wrong operation outcomes do not resolve funds, and verified completion is idempotent', () => {
  const prepared = beginContractOperation(funded(), 'refund', 'refund-1', 2000);
  assert.throws(() => finishContractOperation(prepared, { operationId: 'claim-1', kind: 'claim', outcome: 'confirmed' }));
  const result = { operationId: 'refund-1', kind: 'refund', outcome: 'confirmed' };
  const refunded = finishContractOperation(prepared, result);
  assert.equal(finishContractOperation(refunded, result), refunded);
  assert.deepEqual(checkContracts({ contracts: [refunded], attempts: [] }, scope, 2000), []);
});

test('public queries project known fields, detach nested data, and never invoke signing', () => {
  const contract = { ...funded(), secret: 'private-placeholder', signer: { sign() { throw Error('must not sign'); } } };
  const result = checkContracts({ contracts: [contract], attempts: [] }, scope, 2000)[0];
  assert.equal('secret' in result, false);
  assert.equal('signer' in result, false);
  result.scope.playerId = 'changed';
  assert.equal(contract.scope.playerId, 'player');
});

test('invalid requests fail before allocating and already expired sessions remain skipped', () => {
  for (const patch of [{ amountSats: 0 }, { amountSats: 1.1 }, { expiresAt: 1000 }, { startedAt: NaN }, { scope: { ...scope, gameId: 'player' } }, { sessionId: '' }]) {
    assert.throws(() => startLto(emptyContractLedger(), { ...request, ...patch }, 1000));
  }
  const expired = startLto(emptyContractLedger(), request, 91000);
  assert.equal(expired.status, 'expired');
  assert.equal(startLto(expired.ledger, { ...request, expiresAt: 200000 }, 92000).status, 'expired');
});
