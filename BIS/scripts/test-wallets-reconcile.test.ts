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

test('settled operations gain exact read-only fee evidence without changing intent or outcome', async () => {
  const f = await fixture();
  const unknown = await f.ledger.list().then(rows => rows[0]);
  const settled = await f.ledger.reconcile(f.intent.id, async record => ({ id: f.intent.id, fingerprint: record.fingerprint,
    providerId: 'a'.repeat(64), outcome: 'settled', verified: true }));
  assert.equal(settled.state, 'settled');
  const intent = structuredClone(settled.intent);
  const evidence = { id: f.intent.id, fingerprint: unknown.fingerprint, providerId: 'a'.repeat(64),
    outcome: 'settled', verified: true, inputSats: 470, outputSats: 470, feeSats: 0 };
  for (const change of [{ providerId: 'b'.repeat(64) }, { fingerprint: 'other' }, { verified: false }, { feeSats: 1 }, { outputSats: 471 }])
    await assert.rejects(f.ledger.reconcileObservedFee(f.intent.id, async () => ({ ...evidence, ...change })), /evidence-mismatch/);
  const enriched = await f.ledger.reconcileObservedFee(f.intent.id, async record => {
    assert.equal(record.state, 'settled'); return evidence;
  });
  assert.equal(enriched.observedFeeSats, 0);
  assert.equal(enriched.feeEvidence.kind, 'verified-transaction-fee');
  assert.equal(enriched.feeEvidence.transactionId, 'a'.repeat(64));
  assert.deepEqual(enriched.intent, intent);
  assert.equal(enriched.state, 'settled');
});

test('explicit prototype funding loss disposition retains unknown network outcome and original identity',async()=>{
  const f=await fixture();
  await assert.rejects(f.ledger.abandonLostPrototypeFunding(f.intent.id,'implicit'),/authorization-required/);
  const record=await f.ledger.abandonLostPrototypeFunding(f.intent.id,'user-prototype-loss-policy-2026-10-21');
  assert.equal(record.state,'cancelled');
  assert.equal(record.resolution.networkOutcome,'unknown');
  assert.equal(record.resolution.kind,'user-authorized-abandonment');
  assert.deepEqual(record.intent,f.intent);assert.equal(record.providerId,undefined);
  assert.equal(f.submissions(),1);
  assert.equal((await f.ledger.submit(f.intent.id,()=>assert.fail('abandonment must not replay the original request'))).state,'cancelled');
  await f.ledger.prepare({...f.intent,id:'fresh-user-approved-request'});
});

test('prototype loss disposition cannot retire a contract claim or an acknowledged faucet payment',async()=>{
  const f=await fixture();
  await f.ledger.abandonLostPrototypeFunding(f.intent.id,'user-prototype-loss-policy-2026-10-21');
  await f.ledger.prepare({...f.intent,id:'original-claim',kind:'claim',recipient:'original-contract',amountSats:1000});
  await f.ledger.submit('original-claim',async()=>{throw Error('lost claim acknowledgement');});
  await assert.rejects(f.ledger.abandonLostPrototypeFunding('original-claim','user-prototype-loss-policy-2026-10-21'),/funding-not-lost/);
  const g=await fixture();g.state.operations[0].providerId='a'.repeat(64);
  await assert.rejects(g.ledger.abandonLostPrototypeFunding(g.intent.id,'user-prototype-loss-policy-2026-10-21'),/funding-not-lost/);
});

test('prototype loss policy accepts only bound unacknowledged Admin funding, never a funded contract or ordinary send',async()=>{
  const f=await fixture();
  await f.ledger.abandonLostPrototypeFunding(f.intent.id,'user-prototype-loss-policy-2026-10-21');
  const id='admin-expiry-fund', runId='admin-expiry';
  await f.ledger.prepare({...f.intent,id,kind:'arkade-send',recipient:'treasure:'+runId,amountSats:1000});
  await f.ledger.submit(id,async()=>{throw Error('interrupted test');});
  await assert.rejects(f.ledger.abandonLostPrototypeFunding(id,'user-prototype-loss-policy-2026-10-21'),/funding-not-lost/);
  f.state.treasureAdminRuns={[runId]:{network:f.intent.network,game:f.intent.profileId,origin:f.intent.sourceOrigin}};
  f.state.treasureAdminRuns[runId].contractId='original-contract';
  await assert.rejects(f.ledger.abandonLostPrototypeFunding(id,'user-prototype-loss-policy-2026-10-21'),/funding-not-lost/);
  delete f.state.treasureAdminRuns[runId].contractId;
  const result=await f.ledger.abandonLostPrototypeFunding(id,'user-prototype-loss-policy-2026-10-21');
  assert.equal(result.state,'cancelled');assert.equal(result.resolution.networkOutcome,'unknown');
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

