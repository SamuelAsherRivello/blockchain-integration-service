import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { generateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { Vault } from './test-wallets/vault.ts';
import { register } from './test-wallets/inventory.ts';
import { Operations } from './test-wallets/operations.ts';
import { runGuardedScenario, validateGuardedScenario, parseContractReport, guardedObservationBudget } from './test-wallets/guarded-scenarios.ts';

test('scenario observation limits are explicit, bounded and preserve the ordinary default',()=>{
  assert.deepEqual(guardedObservationBudget(),{milliseconds:5000,maximumAttempts:20});
  assert.deepEqual(guardedObservationBudget(115000),{milliseconds:115000,maximumAttempts:460});
  for(const value of [0,249,120001,Infinity,250.5])assert.throws(()=>guardedObservationBudget(value));
});

async function fixture(t, network = 'signet', scenario = 'mint-delivery') {
  const parent = await mkdtemp(join(tmpdir(), 'bis-scenarios-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const key = randomBytes(32), protector = { check: async () => {}, secure: async () => {},
    protect: async bytes => { const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
      return Buffer.concat([iv, cipher.update(bytes), cipher.final(), cipher.getAuthTag()]); },
    unprotect: async bytes => { const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
      cipher.setAuthTag(bytes.subarray(-16)); return Buffer.concat([cipher.update(bytes.subarray(12, -16)), cipher.final()]); } };
  const vault = new Vault({ root: join(parent, 'private'), protector });
  await vault.initialize();
  await register(vault, ['player', 'game'].map(label => ({ label, phrase: generateMnemonic(wordlist) })), 'agent-created');
  const [player, game] = await vault.transaction(state => state.accounts), ledger = new Operations(vault);
  let rows = [], confirms = 0;
  const owner = { vault, registration: { player, game, pair: { network }, application: { app: 'admin', origin: 'http://127.0.0.1:5174', path: '/admin/' } },
    expected: { player: { arkadeAddress: 'tark1' + 'a'.repeat(30) } }, inspect: async () => ({ mode: 'owned' }) };
  const request = { command: 'run', scenario, operation: 'sample-one', ...(scenario === 'mint-delivery' ? { destination: 'player' } :
    scenario === 'burn' ? { assetId: 'a'.repeat(68), quantity: '1' } : { contractId: 'contract-one' }) };
  const product = scenario === 'mint-delivery' ? { id: 'product-one', name: 'BIS test sample-one', ticker: 'BISTEST', amount: '1', decimals: 0,
    status: 'pending', assetId: 'a'.repeat(68), quantity: '1', delivery: { assetId: 'a'.repeat(68), quantity: '1',
      recipient: owner.expected.player.arkadeAddress, status: 'pending', transactionId: 'b'.repeat(64) } } : scenario === 'burn' ?
    { id: 'product-one', assetId: request.assetId, quantity: '1', status: 'pending', transactionId: 'b'.repeat(64) } :
    { id: 'contract-one', network: network === 'signet' ? 'Signet' : 'Mutinynet', role: scenario === 'contract-claim' ? 'player' : 'game',
      amountSats: 100, financial: 'funded', operationId: 'fund-original', evidence: 'local record', transactionId: 'b'.repeat(64) };
  if (scenario.startsWith('contract-')) rows = [product];
  const adapters = { stage: async () => {}, records: async () => structuredClone(rows), contracts: async () => structuredClone(rows), pause: async () => {},
    confirm: async () => { assert.equal((await ledger.list())[0].state, 'submitting'); confirms++;
      if (scenario.startsWith('contract-')) { product.financial = scenario === 'contract-claim' ? 'claiming' : 'refunding'; product.operationId = 'product-one'; }
      rows = [product]; } };
  return { owner, request, product, adapters, ledger, confirms: () => confirms, rows: value => { rows = value; } };
}

test('named scenarios reject arbitrary/private payloads before opening an owned context', async () => {
  for (const request of [null, {}, { command: 'run', scenario: 'mint-delivery', operation: 'x', destination: 'human' },
    { command: 'run', scenario: 'burn', operation: 'x', assetId: 'a'.repeat(68), quantity: '0' },
    { command: 'run', scenario: 'contract-claim', operation: 'x', contractId: 'c', phrase: 'sentinel' }]) {
    assert.throws(() => validateGuardedScenario(request), /invalid-guarded-scenario/);
    await assert.rejects(runGuardedScenario({ inspect: () => assert.fail('must validate first') }, request), /invalid-guarded-scenario/);
  }
  await assert.rejects(runGuardedScenario({ inspect: async () => ({ mode: 'joined' }) },
    { command: 'run', scenario: 'mint-delivery', operation: 'x', destination: 'game' }), /scenario-owned-session-required/);
});

test('long original observation adopts a delayed acknowledgement without another confirmation',async t=>{
  const f=await fixture(t);let reads=0;
  const original=f.adapters.confirm;
  f.adapters.confirm=async()=>{await original();reads=0;};
  f.adapters.records=async()=>++reads>=26?[structuredClone(f.product)]:[];
  const result=await runGuardedScenario(f.owner,f.request,{...f.adapters,observationTimeoutMs:115000});
  assert.equal(result.operation.providerId,'product-one');
  assert.equal(result.operation.state,'pending');
  assert.equal(f.confirms(),1);assert.ok(reads>=26);
});

for (const network of ['signet', 'mutinynet']) for (const scenario of ['mint-delivery', 'burn', 'contract-claim', 'contract-refund'])
  test(`${network}: ${scenario} reserves before confirmation and retries original identity`, async t => {
    const f = await fixture(t, network, scenario);
    assert.equal((await runGuardedScenario(f.owner, f.request, f.adapters)).readiness, 'pending');
    assert.equal(f.confirms(), 1);
    await runGuardedScenario(f.owner, f.request, f.adapters);
    assert.equal(f.confirms(), 1);
    if (scenario === 'mint-delivery') { f.product.status = 'succeeded';
      assert.equal((await runGuardedScenario(f.owner, f.request, f.adapters)).readiness, 'pending', 'mint alone does not prove delivery');
      f.product.delivery.status = 'succeeded'; }
    else if (scenario === 'burn') f.product.status = 'succeeded';
    else { f.product.financial = scenario === 'contract-claim' ? 'claimed' : 'refunded';
      assert.equal((await runGuardedScenario(f.owner, f.request, f.adapters)).readiness, 'pending', 'local resolution is not verified receipt');
      f.product.evidence = 'verified receipt'; }
    const result = await runGuardedScenario(f.owner, f.request, f.adapters);
    assert.equal(result.readiness, 'scenario-verified'); assert.equal(result.operation.providerId, 'product-one'); assert.equal(f.confirms(), 1);
    await runGuardedScenario(f.owner, f.request, { ...f.adapters, records: () => assert.fail('terminal record requires no repeat') });
    assert.equal(f.confirms(), 1);
  });

test('lost acknowledgement, unavailable reads and ambiguous journals never cause another signing action', async t => {
  const f = await fixture(t);
  f.adapters.confirm = async () => { throw Error('private-sentinel'); };
  assert.equal((await runGuardedScenario(f.owner, f.request, f.adapters)).operation.state, 'unknown');
  f.adapters.confirm = () => assert.fail('must not resend');
  f.adapters.records = async () => { throw Error('private-sentinel'); };
  assert.equal((await runGuardedScenario(f.owner, f.request, f.adapters)).reason, 'scenario-evidence-unavailable');
  f.adapters.records = async () => [f.product, { ...f.product, id: 'second-product' }];
  assert.equal((await runGuardedScenario(f.owner, f.request, f.adapters)).readiness, 'pending');
  f.adapters.records = async () => [f.product];
  f.product.status = 'succeeded'; f.product.delivery.status = 'succeeded';
  assert.equal((await runGuardedScenario(f.owner, f.request, f.adapters)).readiness, 'scenario-verified');
});

test('mint delivery reserves recipient identity and refuses changed destination or generation', async t => {
  const f = await fixture(t); await runGuardedScenario(f.owner, f.request, f.adapters);
  const { player, pair } = f.owner.registration;
  await assert.rejects(f.ledger.prepare({ id: 'competing-burn', account: player.label, profileId: player.profileId, generation: player.generation,
    network: pair.network, kind: 'burn', recipient: 'a'.repeat(68), amountSats: 0, feeSats: null }), /operation-scope-pending/);
  await assert.rejects(runGuardedScenario(f.owner, { ...f.request, destination: 'game' }, f.adapters), /operation-intent-conflict/);
  f.owner.registration.player = { ...player, generation: player.generation + 1 };
  await assert.rejects(runGuardedScenario(f.owner, f.request, f.adapters), /operation-intent-conflict/);
  assert.equal(f.confirms(), 1);
});

test('contract report projection ignores arbitrary prose and rejects missing identity/network', () => {
  const text = 'Contract ID: c\nNetwork: Signet\nRole: player\nAmount: 10 sats\nFunds: funded\nEvidence: local record\nOperation: op\nCurrent transaction: Not submitted\nPurpose: public-sentinel';
  const rows = parseContractReport(text);
  assert.equal(rows[0].id, 'c'); assert.equal(JSON.stringify(rows).includes('public-sentinel'), false);
  assert.throws(() => parseContractReport(text.replace('Network: Signet', 'Network: Mainnet')), /scenario-contract-unavailable/);
});

for (const enabled of [true, false]) test(`mint uses the normal draft and honors the production button guard (${enabled})`, async t => {
  const f = await fixture(t);
  const values = new Map(), clicks = [];
  f.owner.accountMenu = async () => {};
  f.owner.validateRegistration = async () => {};
  f.owner.verifyNetwork = () => assert.fail('Admin mint dialog uses its captured production target, not an absent BIS dialog');
  const control = name => ({ waitFor: async () => {}, count: async () => 1, isEnabled: async () => enabled,
    click: async () => { clicks.push(name); if (name === 'Mint') f.rows([f.product]); } });
  f.owner.page = { url: () => 'http://127.0.0.1:5174/admin/',
    waitForFunction: async () => {},
    locator: () => ({ last: () => ({ getByRole: (_role, { name }) => control(name) }) }),
    getByRole: (_role, { name }) => control(name),
    getByLabel: name => ({ fill: async value => values.set(name, value), selectOption: async value => values.set(name, value),
      inputValue: async () => values.get(name) }) };
  const { stage, confirm, ...adapters } = f.adapters;
  const result = await runGuardedScenario(f.owner, f.request, adapters);
  assert.equal(clicks.includes('Mint'), enabled);
  assert.equal(result.operation.state, enabled ? 'pending' : 'unknown');
  assert.equal(values.get('Name *'), 'BIS test sample-one');
  assert.equal(values.get('Destination'), 'player');
  await runGuardedScenario(f.owner, f.request, adapters);
  assert.equal(clicks.filter(name => name === 'Mint').length, enabled ? 1 : 0);
});

test('a stale mint draft cannot be confirmed or repaired by resubmitting', async t => {
  const f = await fixture(t);
  f.owner.validateRegistration = async () => {};
  f.owner.page = { url: () => 'http://127.0.0.1:5174/admin/',
    getByLabel: () => ({ inputValue: async () => 'different-request' }),
    getByRole: () => ({ click: () => assert.fail('stale draft must not sign') }) };
  const { confirm, ...adapters } = f.adapters;
  assert.equal((await runGuardedScenario(f.owner, f.request, adapters)).operation.state, 'unknown');
  assert.equal((await runGuardedScenario(f.owner, f.request, adapters)).readiness, 'pending');
});

test('busy mint dialog recovery revalidates origin and only reconciles an existing submitted action', async t => {
  const f = await fixture(t);
  await runGuardedScenario(f.owner, f.request, f.adapters);
  f.owner.inspect = async () => { throw Error('account-layer-absent'); };
  f.owner.validateRegistration = async () => {};
  let url = 'http://127.0.0.1:5174/admin/';
  f.owner.page = { url: () => url, getByRole: () => ({ isVisible: async () => true }) };
  f.adapters.confirm = () => assert.fail('busy dialog recovery must not sign');
  assert.equal((await runGuardedScenario(f.owner, f.request, f.adapters)).readiness, 'pending');
  url = 'http://127.0.0.1:5175/admin/';
  await assert.rejects(runGuardedScenario(f.owner, f.request, f.adapters), /scenario-context-mismatch/);
  url = 'http://127.0.0.1:5174/admin/';
  await assert.rejects(runGuardedScenario(f.owner, { ...f.request, operation: 'brand-new' }, f.adapters), /scenario-context-unavailable/);
  assert.equal(f.confirms(), 1);
});

for(const network of ['signet','mutinynet'])test(`${network}: completed mint delivery restart recovers the original IDs without another mint confirmation`,async t=>{
 const f=await fixture(t,network);await runGuardedScenario(f.owner,f.request,f.adapters);
 f.product.status='succeeded';f.product.delivery.id=`${f.product.id}-delivery`;
 let checks=0;
 f.adapters.recover=async(_owner,_request,row,verify)=>{
  checks++;assert.equal(row.id,'product-one');assert.equal(row.delivery.id,'product-one-delivery');
  assert.equal((await verify()).delivery.id,row.delivery.id);
  assert.equal((await f.ledger.list())[0].providerId,row.id);
  if(checks>1)f.product.delivery.status='succeeded';
 };
 assert.equal((await runGuardedScenario(f.owner,f.request,f.adapters)).readiness,'pending');
 assert.equal((await runGuardedScenario(f.owner,f.request,f.adapters)).readiness,'scenario-verified');
 assert.equal(checks,2);assert.equal(f.confirms(),1);
 await runGuardedScenario(f.owner,f.request,f.adapters);assert.equal(checks,2);assert.equal(f.confirms(),1);
});

test('unknown mint acknowledgement binds the journal before recovering pending delivery and never remints',async t=>{
 const f=await fixture(t);
 f.adapters.confirm=async()=>{f.rows([f.product]);throw Error('synthetic lost acknowledgement');};
 await runGuardedScenario(f.owner,f.request,f.adapters);
 f.product.status='succeeded';f.product.delivery.id=`${f.product.id}-delivery`;delete f.product.delivery.transactionId;
 let checks=0;
 f.adapters.confirm=()=>assert.fail('no replacement mint');
 f.adapters.recover=async(_owner,_request,row)=>{checks++;assert.equal(row.delivery.id,'product-one-delivery');};
 const before=(await f.ledger.list())[0];
 const pending=await runGuardedScenario(f.owner,f.request,f.adapters);
 assert.equal(pending.readiness,'pending');assert.equal(checks,1);assert.equal(pending.operation.fingerprint,before.fingerprint);
 assert.equal((await runGuardedScenario(f.owner,f.request,f.adapters)).readiness,'pending');assert.equal(checks,2);
});

test('unrelated or unavailable delivery evidence cannot activate recovery controls',async t=>{
 for(const variant of ['missing','id','recipient','asset','read-error']) {
  const f=await fixture(t);await runGuardedScenario(f.owner,f.request,f.adapters);
  f.product.status='succeeded';f.product.delivery.id=`${f.product.id}-delivery`;
  if(variant==='missing')delete f.product.delivery;
  if(variant==='id')f.product.delivery.id='replacement-delivery';
  if(variant==='recipient')f.product.delivery.recipient='tark1other';
  if(variant==='asset')f.product.delivery.assetId='b'.repeat(68);
  if(variant==='read-error')f.adapters.records=async()=>{throw Error('synthetic unreadable journal');};
  f.adapters.recover=()=>assert.fail('must not activate recovery');
  assert.equal((await runGuardedScenario(f.owner,f.request,f.adapters)).readiness,'pending');assert.equal(f.confirms(),1);
 }
});

test('normal Admin recovery selects the saved draft and Check mint status, never Mint or editable draft fields',async t=>{
 const f=await fixture(t);await runGuardedScenario(f.owner,f.request,f.adapters);
 f.product.status='succeeded';f.product.delivery.id=`${f.product.id}-delivery`;
 let opened=false,checks=0,resumes=0;
 const values=new Map([['Destination','player']]);
 f.owner.accountMenu=async()=>{};f.owner.validateRegistration=async()=>{};
 const control=name=>({isVisible:async()=>name==='Mint Asset'?opened:name==='Resume pending mint',waitFor:async()=>{opened=true;},count:async()=>0,isEnabled:async()=>true,
  click:async()=>{
   if(name==='Mint')assert.fail('must not mint again');
   if(name==='Resume pending mint'){
    resumes++;for(const [label,value] of [['Name *','BIS test sample-one'],['Ticker *','BISTEST'],['Amount *','1'],['Decimals','0'],['Icon URL','']])values.set(label,value);
   }
   if(name==='Check mint status'){checks++;f.product.delivery.status='succeeded';}
  }});
 f.owner.page={url:()=> 'http://127.0.0.1:5174/admin/',waitForFunction:async()=>{},
  locator:()=>({last:()=>({getByRole:(_role,{name})=>control(name)})}),getByRole:(_role,{name})=>control(name),
  getByLabel:name=>({selectOption:async value=>values.set(name,value),inputValue:async()=>values.get(name),fill:()=>assert.fail('recovery may not edit a draft')})};
 const result=await runGuardedScenario(f.owner,f.request,f.adapters);
 assert.equal(result.readiness,'scenario-verified');assert.equal(checks,1);assert.equal(resumes,1);assert.equal(f.confirms(),1);
});

