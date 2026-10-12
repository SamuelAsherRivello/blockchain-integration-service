import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { register } from './test-wallets/inventory.ts';
import { Operations } from './test-wallets/operations.ts';
import { reconcileFaucet } from './test-wallets/reconcile.ts';
import { argumentsFor } from './test-wallets/arguments.ts';

async function fixture() {
  const state = { accounts: [], pairs: [] }, vault = { transaction: async read => read(state) };
  await register(vault, [{ label: 'recipient', phrase: generateMnemonic(wordlist) }], 'agent-created');
  const account = state.accounts[0], ledger = new Operations(vault);
  const intent = { id: 'original-request', account: account.label, profileId: account.profileId, generation: 1,
    network: 'signet', kind: 'faucet', recipient: `tark1${'a'.repeat(30)}`, amountSats: 50000, feeSats: null,
    sourceOrigin: 'http://127.0.0.1:5190' };
  await ledger.prepare(intent);
  let submissions = 0;
  await ledger.submit(intent.id, async () => { submissions++; throw Error('lost-ack-private-sentinel'); });
  return { vault, state, ledger, intent, submissions: () => submissions };
}

test('faucet reconciliation accepts only the original operation, with no alternative source or network', () => {
  assert.equal(argumentsFor(['reconcile', '--operation', 'original-request']).values.operation, 'original-request');
  assert.throws(() => argumentsFor(['reconcile']), /invalid-account-label/);
  assert.throws(() => argumentsFor(['reconcile', '--operation', 'original-request', '--api', 'http://127.0.0.1:5191']), /invalid-arguments/);
});

test('lost faucet acknowledgement uses GET by original request and requires a separately verified exact receipt', async () => {
  const f = await fixture();
  const transactionId = 'a'.repeat(64);
  let gets = 0, receipts = 0;
  const adapters = { fetch: async (url, options) => {
    gets++; assert.equal(url, 'http://127.0.0.1:5190/api/faucet/status/original-request?by=request');
    assert.equal(options.method, 'GET'); assert.equal(options.body, undefined); assert.equal(options.redirect, 'error');
    return new Response(JSON.stringify({ network: 'signet', address: f.intent.recipient, amountSats: 50000,
      operationId: transactionId, transactionId, status: 'success' }));
  }, receipt: async (_account, operation) => {
    receipts++;
    assert.equal(operation.state, 'pending');
    return undefined;
  } };
  const acknowledged = await reconcileFaucet(f.vault, f.intent.id, adapters);
  assert.equal(acknowledged.operation.state, 'pending'); assert.equal(acknowledged.reason, 'recipient-evidence-unavailable');
  // Revocation must not prevent read-only recovery of an existing submission.
  f.state.accounts[0].grant.active = false;
  adapters.receipt = async (_account, operation) => ({ id: operation.intent.id, fingerprint: operation.fingerprint,
    providerId: transactionId, outcome: 'settled', verified: true });
  const settled = await reconcileFaucet(f.vault, f.intent.id, adapters);
  assert.equal(settled.operation.state, 'settled'); assert.equal(settled.readiness, 'funding-verified');
  assert.equal(gets, 1); assert.equal(receipts, 1); assert.equal(f.submissions(), 1);
  assert.equal((await reconcileFaucet(f.vault, f.intent.id, { fetch: () => assert.fail('settled work must not retry') })).operation.state, 'settled');
});

test('missing, mismatched or unreadable faucet evidence retains unknown reservation and never retries funding', async () => {
  for (const changed of [{}, { network: 'mutinynet' }, { address: 'other-recipient' }, { amountSats: 100000 },
    { operationId: 'invalid' }, { transactionId: 'b'.repeat(64) }, 'throw']) {
    const f = await fixture();
    const ack = { network: 'signet', address: f.intent.recipient, amountSats: 50000, operationId: 'a'.repeat(64) };
    const result = await reconcileFaucet(f.vault, f.intent.id, { fetch: async (_url, options) => {
      assert.equal(options.method, 'GET');
      if (changed === 'throw') throw Error('private-sentinel');
      return new Response(JSON.stringify(Object.keys(changed).length ? { ...ack, ...changed } : { status: 'unavailable' }));
    }, receipt: () => assert.fail('unmatched response cannot establish receipt') });
    assert.equal(result.operation.state, 'unknown');
    assert.equal(result.reason, 'original-faucet-acknowledgement-unavailable');
    assert.equal(f.submissions(), 1); assert.equal(JSON.stringify(result).includes('private-sentinel'), false);
    await assert.rejects(f.ledger.prepare({ ...f.intent, id: 'replacement-request' }), /scope-pending/);
  }
});

