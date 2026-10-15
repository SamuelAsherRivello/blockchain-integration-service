import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { ReadonlyWallet, RestArkProvider, CSVMultisigTapscript } from '@arkade-os/sdk';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { register } from './test-wallets/inventory.ts';
import { Operations } from './test-wallets/operations.ts';
import { runOnboard, validateOnboard, verifyOnboardingSettlement, assertOnboardingWindow,
  publicOnboardingSettlement, captureOnboardingInputs, observeOnboardingReceipt } from './test-wallets/onboarding.ts';
import { onboardingPage, closeOnboardingPages, onboardingProfileKey } from './test-wallets/onboarding-browser.ts';

const board = 'a'.repeat(64), returned = 'b'.repeat(64), original = 'c'.repeat(64);
const recipient = 'tb1p' + 'q'.repeat(58);
const request = { command: 'run', scenario: 'onboard-half', operation: 'half-one' };
async function fixture(network = 'signet') {
  let state = { accounts: [], pairs: [], applications: [{ app: 'onboarding', origin: 'http://127.0.0.1:5174', path: '/onboarding/' }] };
  let queue = Promise.resolve();
  // Disposable in-memory inventory; no plaintext files,
  // browser storage or actual supplied recovery material is used by these tests.
  const vault = { transaction(work) {
    const result = queue.then(async () => { const next = structuredClone(state); const value = await work(next); state = next; return value; });
    queue = result.catch(() => {}); return result;
  } };
  await register(vault, [{ label: 'player', phrase: generateMnemonic(wordlist) }], 'agent-created');
  const player = await vault.transaction(value => structuredClone(value.accounts[0]));
  const owner = { vault, expected: { player: { bitcoinAddress: recipient } },
    registration: { player, pair: { network }, application: { origin: 'http://127.0.0.1:5174' } },
    inspect: async () => ({ mode: 'owned' }), validateRegistration: async () => {} };
  let restored = 0, captured = 0, readbacks = 0, pageCalls = 0;
  const controls = { network, percent: '50', percentDisabled: false, address: 'No account created yet', idle: true, secretHidden: true };
  const page = { url: () => `http://127.0.0.1:5174/onboarding/?network=${network}&window=half-one`,
    locator: selector => ({ inputValue: async () => controls[{ '#network': 'network', '#transfer-percent': 'percent', '#address': 'address' }[selector]],
      isDisabled: async () => controls.percentDisabled,
      getAttribute: async name => name === 'type' ? 'password' : 'false',
      textContent: async () => controls.idle ? 'No Bitcoin → Arkade transfer submitted. Step 4 starts automatically when funding is ready.' : 'pending',
    }) };
  const presentation = { network, profileId: player.profileId, recipient, target: 50000, fee: 0, change: 50001,
    providerId: 'return-intent', boardingCommitment: board, commitment: returned };
  const evidence = { network, profileId: player.profileId, recipient, live: true,
    transactions: [{ txid: board, status: { confirmed: true }, vin: [{ txid: original, vout: 0 }], vout: [] },
      { txid: returned, status: { confirmed: true }, vin: [], vout: [{ scriptpubkey_address: recipient, value: 50001 }] }],
    receipts: [{ value: 50000, commitmentTxIds: [returned] }] };
  const ledger = new Operations(vault);
  const adapters = {
    capture: async () => { captured++; return { network, profileId: player.profileId, recipient, inputs: [{ txid: original, vout: 0, value: 100001 }] }; },
    page: async operation => { pageCalls++; assert.equal((await ledger.list())[0].state, operation.state); return page; },
    restore: async (_page, operations, operation, phrase) => operations.submit(operation.intent.id, async () => {
      assert.equal((await ledger.list())[0].state, 'submitting', 'durable marker precedes private restoration/automatic eligibility');
      assert.equal(phrase, player.phrase); restored++; controls.address = recipient; controls.idle = false;
      return { providerId: 'board-intent' };
    }),
    presentation: async () => structuredClone(presentation), receipt: async () => structuredClone(evidence),
    balance: async () => { readbacks++; return { availableArkadeSats: 50000, bitcoinSats: 50001 }; },
  };
  return { owner, adapters, ledger, page, controls, presentation, evidence,
    counts: () => ({ restored, captured, readbacks, pageCalls }) };
}

test('onboard-half validates before private access and exact window identity cannot change', () => {
  validateOnboard(request);
  for (const changes of [{ operation: '../human' }, { scenario: 'payment' }, { network: 'mainnet' }, { phrase: 'sentinel' }, { percent: 100 }])
    assert.throws(() => validateOnboard({ ...request, ...changes }), /invalid-onboarding-request/);
  const operation = { intent: { id: 'half-one', network: 'signet', sourceOrigin: 'http://127.0.0.1:5174', recipient } };
  assertOnboardingWindow(`http://127.0.0.1:5174/onboarding/?network=signet&window=half-one&btcAddress=${recipient}`, operation);
  for (const value of ['http://127.0.0.1:5174/onboarding/?network=signet&window=other',
    'http://127.0.0.1:5174/onboarding/?network=mutinynet&window=half-one',
    'http://127.0.0.1:5175/onboarding/?network=signet&window=half-one',
    'http://127.0.0.1:5174/onboarding/?network=signet&window=half-one&reset=true'])
    assert.throws(() => assertOnboardingWindow(value, operation), /window-mismatch/);
});

for (const network of ['signet', 'mutinynet']) test(`${network}: capture before private restore and verify both legs plus independent BIS read`, async () => {
  const f = await fixture(network);
  const result = await runOnboard(f.owner, request, f.adapters);
  assert.equal(result.readiness, 'onboarding-verified');
  assert.equal(result.operation.state, 'settled');
  assert.equal(result.operation.providerId, 'board-intent', 'return leg intent never replaces original registration identity');
  assert.deepEqual(result.operation.intent.capturedInputs, [{ txid: original, vout: 0, value: 100001 }]);
  assert.deepEqual(f.counts(), { captured: 2, restored: 1, readbacks: 1, pageCalls: 1 });
  assert.equal(JSON.stringify(result).includes(f.owner.registration.player.phrase), false);
  await runOnboard(f.owner, request, f.adapters);
  assert.deepEqual(f.counts(), { captured: 2, restored: 1, readbacks: 1, pageCalls: 1 }, 'settled retry performs no restoration or new browser navigation');
});

test('onboarding preserves original unknown operation and window while reconciling a lost acknowledgement', async () => {
  const f = await fixture();
  f.adapters.restore = async (_page, ledger, operation) => ledger.submit(operation.intent.id, async () => {
    f.controls.address = recipient; f.controls.idle = false; throw Error('private-sentinel');
  });
  f.adapters.receipt = async () => undefined;
  const first = await runOnboard(f.owner, request, f.adapters);
  assert.equal(first.operation.state, 'unknown');
  assert.equal(first.readiness, 'pending');
  f.adapters.restore = () => assert.fail('must not repeat private entry');
  f.adapters.capture = () => assert.fail('must not replace original input intent');
  f.adapters.receipt = async () => f.evidence;
  const recovered = await runOnboard(f.owner, request, f.adapters);
  assert.equal(recovered.operation.state, 'settled');
  assert.equal(recovered.operation.providerId, 'return-intent');
  assert.equal(JSON.stringify(recovered).includes('private-sentinel'), false);
});

test('onboarding cannot restore over pending windows or changed inputs', async () => {
  const pending = await fixture();
  pending.controls.address = recipient; pending.controls.idle = false;
  pending.adapters.restore = () => assert.fail('must not reset an existing window');
  await assert.rejects(runOnboard(pending.owner, request, pending.adapters), /window-not-empty/);
  const changed = await fixture();
  const capture = changed.adapters.capture;
  let calls = 0;
  changed.adapters.capture = async () => { const value = await capture(); if (++calls > 1) value.inputs[0].value++; return value; };
  changed.adapters.restore = () => assert.fail('changed intent cannot submit');
  await assert.rejects(runOnboard(changed.owner, request, changed.adapters), /inputs-changed/);
  assert.equal((await changed.ledger.list())[0].state, 'prepared');
});

test('whole-input Arkade receipts, unrelated inputs, wrong remainder and unavailable BIS reads never complete onboarding', async () => {
  for (const change of [
    f => { f.evidence.receipts[0].value = 100001; },
    f => { f.evidence.transactions[0].vin[0].txid = 'd'.repeat(64); },
    f => { f.evidence.transactions[1].vout[0].value--; },
    f => { f.evidence.transactions[1].status.confirmed = false; },
    f => { f.evidence.network = 'mutinynet'; },
    f => { f.evidence.live = false; },
    f => { f.presentation.target++; },
    f => { f.adapters.balance = async () => { throw Error('private-sentinel'); }; },
    f => { f.adapters.balance = async () => ({ availableArkadeSats: 50000, bitcoinSats: 0 }); },
  ]) {
    const f = await fixture(); change(f);
    const result = await runOnboard(f.owner, request, f.adapters);
    assert.equal(result.readiness, 'pending');
    assert.equal(result.operation.state, 'pending');
    assert.equal(JSON.stringify(result).includes('private-sentinel'), false);
  }
});

test('unavailable capture and missing route preserve honest readiness without restoration', async () => {
  const f = await fixture();
  f.adapters.capture = async () => { throw Error('private-sentinel'); };
  assert.deepEqual(await runOnboard(f.owner, request, f.adapters), { readiness: 'unavailable', reason: 'onboarding-funding-unavailable' });
  assert.deepEqual(await f.ledger.list(), []);
  const other = await fixture();
  other.adapters.page = async () => { throw Error('private-sentinel'); };
  const result = await runOnboard(other.owner, request, other.adapters);
  assert.equal(result.readiness, 'unavailable'); assert.equal(result.operation.state, 'prepared');
});

test('public onboarding observation exports only rendered identity, amounts and transaction IDs', async () => {
  const f = await fixture();
  const prepared = await f.ledger.prepare({ id: 'half-one', kind: 'onboard', account: 'player', profileId: f.owner.registration.player.profileId,
    generation: 1, network: 'signet', percent: 50, sourceOrigin: 'http://127.0.0.1:5174', recipient,
    amountSats: 50000, feeSats: 0, capturedInputs: [{ txid: original, vout: 0, value: 100001 }] });
  const locator = f.page.locator;
  f.controls.address = recipient;
  f.page.locator = selector => ['#target', '#fee', '#change', '#intent'].includes(selector)
    ? { textContent: async () => ({ '#target': '50,000 sats', '#fee': '0 sats', '#change': '50,001 sats', '#intent': 'return-intent' }[selector]) }
    : selector.includes('.transaction-card') ? { evaluateAll: async () => [
      { label: '1 · Bitcoin to Arkade', txid: board }, { label: '2 · Bitcoin remainder returned', txid: returned }] } : locator(selector);
  const observed = await publicOnboardingSettlement(f.page, prepared);
  assert.deepEqual(observed, f.presentation);
  assert.equal(verifyOnboardingSettlement(prepared, observed, f.evidence), returned);
});

test('onboarding browser profile is generation/network/origin/operation scoped and reuses the same pending window', async t => {
  const f = await fixture();
  const parent = await mkdtemp(join(tmpdir(), 'bis-onboarding-private-'));
  t.after(() => rm(parent, { recursive: true, force: true })); // Exact disposable test-owned path.
  f.owner.vault.root = parent;
  f.owner.vault.protector = { check: async () => {} };
  const intent = { id: 'half-one', kind: 'onboard', percent: 50, account: 'player', profileId: f.owner.registration.player.profileId,
    generation: 1, network: 'signet', sourceOrigin: 'http://127.0.0.1:5174', recipient };
  const key = onboardingProfileKey(intent);
  for (const changes of [{ generation: 2 }, { network: 'mutinynet' }, { sourceOrigin: 'http://127.0.0.1:6000' }, { id: 'half-two' }])
    assert.notEqual(onboardingProfileKey({ ...intent, ...changes }), key);
  let launches = 0, navigations = 0, closes = 0, url, guard, profile;
  const page = { isClosed: () => false, url: () => url, mainFrame: () => 'frame',
    goto: async value => { navigations++; url = value; }, locator: () => ({ waitFor: async () => {} }) };
  const context = { setDefaultTimeout() {}, pages: () => [page], on() {},
    route: async (_pattern, callback) => { guard = callback; }, close: async () => { closes++; } };
  const chromium = { launchPersistentContext: async (path, options) => {
    launches++; profile = path; assert.equal(options.headless, true); assert.equal(options.acceptDownloads, false);
    assert.equal('recordVideo' in options, false); return context;
  } };
  const operation = { intent };
  assert.equal(await onboardingPage(f.owner, operation, { chromium }), page);
  assert.equal(await onboardingPage(f.owner, operation, { chromium }), page);
  assert.equal(launches, 1); assert.equal(navigations, 1);
  const competitor = { ...f.owner };
  await assert.rejects(onboardingPage(competitor, operation, { chromium }), /profile-already-owned/);
  assert.equal(launches, 1, 'exclusive lock prevents a second restoration/signer context');
  let aborted = false;
  await guard({ request: () => ({ isNavigationRequest: () => true, frame: () => 'frame',
    url: () => 'http://127.0.0.1:5174/onboarding/?network=mutinynet&window=half-one' }),
    abort: async () => { aborted = true; }, continue: () => assert.fail('cannot switch pending network') });
  assert.equal(aborted, true);
  await closeOnboardingPages(f.owner);
  assert.equal(closes, 1); await access(profile); // Close keeps recoverable persistent files.
  await assert.rejects(access(join(parent, `onboarding-${key}.lock`)), /ENOENT/);
  assert.equal(await onboardingPage(f.owner, operation, { chromium }), page);
  assert.equal(launches, 2); assert.equal(navigations, 2);
  assert.equal(profile, join(parent, 'profiles', `onboarding-${key}`), 'explicit reopen retains original persistent profile and window ID');
  await closeOnboardingPages(f.owner);
});

for (const variant of ['valid', 'expired', 'missing-confirmation-evidence', 'offline', 'wrong-network', 'nonzero-fees'])
  test(`read-only production onboarding adapter uses bounded disposable SDK lifetime: ${variant}`, async t => {
    const f = await fixture();
    const account = { ...f.owner.registration.player, network: 'signet' };
    let disposals = 0, constructions = 0;
    t.mock.method(globalThis, 'fetch', async () => assert.fail('isolated adapter cannot request live data'));
    t.mock.method(RestArkProvider.prototype, 'getInfo', async () => ({ network: variant === 'wrong-network' ? 'mutinynet' : 'signet',
      fees: { txFeeRate: variant === 'nonzero-fees' ? '1' : '0', intentFee: { onchain: '0' } } }));
    t.mock.method(CSVMultisigTapscript, 'decode', () => ({ params: { timelock: { type: 'blocks', value: 100n } } }));
    t.mock.method(ReadonlyWallet, 'create', async options => {
      constructions++;
      assert.equal(options.settlementConfig, false);
      return { dispose: async () => { disposals++; }, arkProvider: options.arkProvider,
        boardingTapscript: { exitScript: 'aa' }, getBoardingAddress: async () => recipient,
        getBoardingUtxos: async () => [{ txid: original, vout: 0, value: 100001,
          status: { confirmed: true, block_time: 1000, ...(variant === 'missing-confirmation-evidence' ? {} : { block_height: variant === 'expired' ? 1 : 999 }) } }],
        onchainProvider: { getChainTip: async () => ({ height: 1000 }), getTransactions: async () => f.evidence.transactions },
        getSpendableVtxos: async filter => { assert.deepEqual(filter, { withRecoverable: false, withUnrolled: false }); return f.evidence.receipts; },
        getProviderConnectionState: () => ({ mode: variant === 'offline' ? 'offline' : 'online', source: 'live' }) };
    });
    if (variant === 'valid') {
      const captured = await captureOnboardingInputs(account, AbortSignal.timeout(2000));
      assert.deepEqual(captured.inputs, [{ txid: original, vout: 0, value: 100001 }]);
      const observed = await observeOnboardingReceipt(account, { intent: { recipient } }, f.presentation, AbortSignal.timeout(2000));
      assert.deepEqual(observed, f.evidence);
    } else await assert.rejects(captureOnboardingInputs(account, AbortSignal.timeout(2000)),
      variant === 'wrong-network' ? /network mismatch/ : /onboarding-/);
    assert.equal(disposals, constructions, 'success and failure dispose every independent read-only SDK resource');
  });

