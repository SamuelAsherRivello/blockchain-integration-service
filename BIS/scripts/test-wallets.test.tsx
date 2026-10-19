import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { generateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { Vault, repositoryRoot, validatePrivatePath } from './test-wallets/vault.ts';
import { windowsProtector } from './test-wallets/protector.ts';
import { execute } from './test-wallets/cli.ts';
import { argumentsFor } from './test-wallets/arguments.ts';
import { register, status, assign, verifiedInventory, importSharedAccounts, recordPendingOnboarding } from './test-wallets/inventory.ts';
import { publicFailure } from './test-wallets/errors.ts';
import { Operations } from './test-wallets/operations.ts';
import { fund } from './test-wallets/funding.ts';
import { observe } from './test-wallets/observations.ts';
import { browserEnvironment, validatePayment, matchingSend, publicSends, assertPaymentReview, validateLifecycle, readLogoutCount } from './test-wallets/browser-public.ts';
import { OwnedBrowser, ownedProfileKey, configureApplications } from './test-wallets/owned-browser.ts';
import { assertFreshOnboarding, restoreOnboardingUI } from './test-wallets/onboarding-ui.ts';
import { JoinedBrowser, joinedRequest } from './test-wallets/joined-browser.ts';
import { runSwap, validateSwap, validateBitcoinFunding, assertSwapReview, matchingSwap, publicBoardings, observeSwapReceipt, observeBitcoinFundingReceipt } from './test-wallets/swap.ts';
import { ReadonlyWallet, RestArkProvider, RestIndexerProvider } from '@arkade-os/sdk';

// Isolated tests encrypt even disposable sentinel data; never use a plaintext fake vault.
test('owned network verification requires the public scope marker and rejects a conflicting footer', async () => {
 const owner=Object.create(OwnedBrowser.prototype);
 owner.registration={pair:{network:'mutinynet'},application:{origin:'http://127.0.0.1:5174',path:'/integration-marketplace/'}};
 let network='mutinynet',footer;
 owner.page={url:()=> 'http://127.0.0.1:5174/integration-marketplace/',locator:selector=>({last:()=>
  selector.includes('data-bis-network')?{getAttribute:async()=>network}:{count:async()=>footer===undefined?0:1,textContent:async()=>footer}})};
 await owner.verifyNetwork();
 footer='Network: Mutinynet';await owner.verifyNetwork();
 footer='Network: Signet';await assert.rejects(owner.verifyNetwork(),/browser-network-mismatch/);
 footer=undefined;network='signet';await assert.rejects(owner.verifyNetwork(),/browser-network-mismatch/);
});
test('swap requests and review require exact amount, net output, fingerprint and nonexpired quote', () => {
 const request={command:'run',scenario:'swap-to-bitcoin',operation:'swap-one',amountSats:10000};
 validateSwap(request);
 for(const change of [{amountSats:0},{amountSats:1.5},{recipient:'tb1-arbitrary'},{network:'mainnet'},{phrase:'private-sentinel'},{scenario:'payment'}])
  assert.throws(()=>validateSwap({...request,...change}),/invalid-swap-request/);
 assert.throws(()=>joinedRequest(request),/joined-action-denied/);
 const review={direction:'to-bitcoin',amountSats:10000,feeSats:0,netSats:10000,quoteFingerprint:'a'.repeat(64),quoteExpiresAt:2000};
 assertSwapReview(review,review,1000);
 for(const change of [{direction:'to-arkade'},{feeSats:1},{netSats:9999},{quoteFingerprint:'b'.repeat(64)},{quoteExpiresAt:1000}])
  assert.throws(()=>assertSwapReview({...review,...change},review,1000),/swap-review-mismatch/);
});

async function isolatedSwap(t, network='mutinynet',funding=false) {
 const {vault}=await fixture(t);
 await register(vault,[{label:'player',phrase:generateMnemonic(wordlist)}],'agent-created');
 if(funding)await register(vault,[{label:'recipient',phrase:generateMnemonic(wordlist)}],'agent-created');
 const player=await vault.transaction(state=>state.accounts[0]), ledger=new Operations(vault);
 const recipient='tb1p'+'q'.repeat(58),fingerprint='a'.repeat(64),expires=Date.now()+60000;
 const review={direction:'to-bitcoin',amountSats:10000,feeSats:0,netSats:10000,quoteFingerprint:fingerprint,quoteExpiresAt:expires};
 if(funding)Object.assign(review,{recipient,source:'Arkade balance',network:network==='signet'?'Signet':'Mutinynet'});
 let confirms=0,reads=0,failRead=false;
 const record={version:1,id:'11111111-1111-4111-8111-111111111111',profileId:player.profileId,network,status:'pending',phase:'registered',bitcoinAddress:recipient,
  inputs:[{txid:'c'.repeat(64),vout:0}],quote:{profileId:player.profileId,direction:'to-bitcoin',amountSats:10000,feeSats:0,netSats:10000,maxSats:20000,inputSats:20000,
   bitcoinAfterSats:10000,arkadeAfterSats:10000,totalAfterSats:20000,expiresAt:expires,fingerprint}};
 if(funding)Object.assign(record.quote,{destination:{purpose:'bitcoin-funding',bitcoinAddress:recipient,network},bitcoinAfterSats:0,totalAfterSats:10000});
 const owner={vault,registration:{player,pair:{network},application:{origin:'http://127.0.0.1:5174'}},expected:{player:{bitcoinAddress:recipient}},
  inspect:async()=>({mode:'owned'}),navigate:async screen=>assert.equal(screen,'Swap'),page:{
   getByRole:(_role,{name})=>({isVisible:async()=>true,waitFor:async()=>{},check:async()=>{},click:async()=>{
    if(name==='Confirm Transfer'){
     assert.equal((await ledger.list())[0].state,'submitting','commit must precede normal UI confirmation');confirms++;
    }
   }}),getByLabel:()=>({fill:async()=>{}}),waitForTimeout:async()=>{},
  }};
 const adapters={review:async()=>review,records:async()=>{reads++;if(failRead)throw Error('private-sentinel');return confirms?[structuredClone(record)]:[];},receipt:async()=>undefined};
 if(funding)adapters.addresses=async()=>({bitcoinAddress:recipient});
 return {owner,adapters,record,review,ledger,request:{command:'run',scenario:funding?'funding-bitcoin':'swap-to-bitcoin',operation:'swap-one',amountSats:10000,...(funding?{recipientAccount:'recipient'}:{})},
  confirms:()=>confirms,reads:()=>reads,failReads:()=>{failRead=true;}};
}

for(const network of ['signet','mutinynet'])test(`${network}: Bitcoin funding binds and reserves both registered generations before normal confirmation`,async t=>{
 const f=await isolatedSwap(t,network,true);
 validateBitcoinFunding(f.request);
 for(const change of [{recipientAccount:'../human'},{recipient:'tb1p'+'q'.repeat(58)},{amountSats:0},{scenario:'funding'}])assert.throws(()=>validateBitcoinFunding({...f.request,...change}));
 await assert.rejects(runSwap(f.owner,{...f.request,recipientAccount:'absent'},f.adapters),/recipient-not-registered/);
 await assert.rejects(runSwap(f.owner,{...f.request,recipientAccount:'player'},f.adapters),/self-funding/);
 const pending=await runSwap(f.owner,f.request,f.adapters),intent=pending.operation.intent;
 assert.equal(intent.kind,'arkade-to-bitcoin-funding');assert.equal(intent.target.account,'recipient');assert.equal(intent.target.generation,1);
 assert.equal(pending.operation.state,'pending');assert.equal(f.confirms(),1);
 const recipient=await f.owner.vault.transaction(state=>state.accounts.find(a=>a.label==='recipient'));
 await assert.rejects(f.ledger.prepare({id:'competing',account:recipient.label,profileId:recipient.profileId,generation:1,network,kind:'faucet',recipient:intent.recipient,amountSats:50000,feeSats:null}),/scope-pending/);
 await runSwap(f.owner,f.request,f.adapters);assert.equal(f.confirms(),1);
 assert.equal(matchingSwap([{...f.record,quote:{...f.record.quote,destination:undefined}}],pending.operation),undefined,'own-wallet journal cannot prove recipient funding');
 assert.equal(matchingSwap([{...f.record,quote:{...f.record.quote,destination:{...f.record.quote.destination,network:network==='signet'?'mutinynet':'signet'}}}],pending.operation),undefined);
 f.adapters.receipt=async(_account,operation)=>({id:intent.id,fingerprint:operation.fingerprint,providerId:f.record.id,outcome:'settled',verified:true});
 assert.equal((await runSwap(f.owner,f.request,f.adapters)).readiness,'bitcoin-funding-verified');assert.equal(f.confirms(),1);
});

test('Bitcoin funding rejects edited public review and retains unknown without resending',async t=>{
 const f=await isolatedSwap(t,'mutinynet',true),original=f.review.recipient;
 f.review.recipient='tb1p'+'p'.repeat(58);
 await assert.rejects(runSwap(f.owner,f.request,f.adapters),/funding-review-mismatch/);assert.equal(f.confirms(),0);
 f.review.recipient=original;f.review.network='Signet';
 await assert.rejects(runSwap(f.owner,f.request,f.adapters),/funding-review-mismatch/);assert.equal(f.confirms(),0);
 f.review.network='Mutinynet';
 const get=f.owner.page.getByRole;
 f.owner.page.getByRole=(role,options)=>{const control=get(role,options);return {...control,click:async()=>{await control.click();if(options.name==='Confirm Transfer'){f.failReads();throw Error('synthetic lost acknowledgement');}}};};
 assert.equal((await runSwap(f.owner,f.request,f.adapters)).operation.state,'unknown');
 assert.equal((await runSwap(f.owner,f.request,f.adapters)).operation.state,'unknown');assert.equal(f.confirms(),1);
});

for(const variant of ['valid','unconfirmed','wrong-bitcoin','wrong-change','wrong-consumed','recipient-not-ready','wrong-recipient'])test(`Bitcoin funding independent exact receipt: ${variant}`,async t=>{
 const f=await isolatedSwap(t,'mutinynet',true),operation=(await runSwap(f.owner,f.request,f.adapters)).operation,row=f.record,txid='d'.repeat(64);
 const recipient=await f.owner.vault.transaction(state=>state.accounts.find(a=>a.label==='recipient'));
 t.mock.method(globalThis,'fetch',async()=>{throw Error('No live requests in synthetic fixture');});
 t.mock.method(RestArkProvider.prototype,'getInfo',async()=>({network:'mutinynet'}));
 t.mock.method(RestIndexerProvider.prototype,'getVtxos',async()=>({vtxos:row.inputs.map(coin=>({...coin,isSpent:true,settledBy:variant==='wrong-consumed'?'e'.repeat(64):txid}))}));
 t.mock.method(ReadonlyWallet,'create',async options=>{await options.arkProvider.getInfo();return {dispose:async()=>{},getBoardingAddress:async()=>{throw Error('must not demand source owns recipient');},getProviderConnectionState:()=>({mode:'online',source:'live'}),
  getVtxos:async()=>[{value:variant==='wrong-change'?9999:10000,commitmentTxIds:[txid]}],onchainProvider:{getTransactions:async address=>{assert.equal(address,row.bitcoinAddress);return [{txid,status:{confirmed:variant!=='unconfirmed'},vout:[{scriptpubkey_address:row.bitcoinAddress,value:variant==='wrong-bitcoin'?9999:10000}]}];}}};});
 const adapters={addresses:async()=>({bitcoinAddress:variant==='wrong-recipient'?'tb1p'+'p'.repeat(58):row.bitcoinAddress}),balance:async()=>({availableBitcoinSats:variant==='recipient-not-ready'?9999:10000})};
 if(variant==='wrong-recipient')await assert.rejects(observeBitcoinFundingReceipt(f.owner.registration.player,operation,[row],recipient,adapters),/recipient-mismatch/);
 else assert.equal((await observeBitcoinFundingReceipt(f.owner.registration.player,operation,[row],recipient,adapters))?.outcome,variant==='valid'?'settled':undefined);
});

for(const network of ['signet','mutinynet'])test(`${network}: owned swap commits before Confirm and retries reconcile only the same operation`,async t=>{
 const f=await isolatedSwap(t,network);
 const pending=await runSwap(f.owner,f.request,f.adapters);
 assert.equal(pending.operation.state,'pending');assert.equal(f.confirms(),1);
 assert.equal(pending.operation.providerId,f.record.id);
 await runSwap(f.owner,f.request,f.adapters);assert.equal(f.confirms(),1);
 await assert.rejects(runSwap(f.owner,{...f.request,amountSats:10001},f.adapters),/operation-intent-conflict/);
 assert.equal(f.confirms(),1);
 f.adapters.receipt=async(_account,operation)=>({id:operation.intent.id,fingerprint:operation.fingerprint,providerId:f.record.id,outcome:'settled',verified:true});
 const settled=await runSwap(f.owner,f.request,f.adapters);
 assert.equal(settled.readiness,'bitcoin-swap-verified');assert.equal(f.confirms(),1);
 const reads=f.reads();await runSwap(f.owner,f.request,f.adapters);assert.equal(f.reads(),reads);
});

test('swap lost acknowledgement remains unknown and an unavailable journal never causes another Confirm',async t=>{
 const f=await isolatedSwap(t);
 const original=f.owner.page.getByRole;
 f.owner.page.getByRole=(role,options)=>{const control=original(role,options);return {...control,click:async()=>{
  await control.click();if(options.name==='Confirm Transfer'){f.failReads();throw Error('private-sentinel');}
 }};};
 const unknown=await runSwap(f.owner,f.request,f.adapters);
 assert.equal(unknown.operation.state,'unknown');assert.equal(f.confirms(),1);
 const repeated=await runSwap(f.owner,f.request,f.adapters);
 assert.equal(repeated.operation.state,'unknown');assert.equal(f.confirms(),1);
 assert.equal(JSON.stringify(repeated).includes('private-sentinel'),false);
});

test('swap matching excludes prior IDs, other networks, changed quotes and duplicate receipts',async t=>{
 const f=await isolatedSwap(t);
 const operation=(await runSwap(f.owner,f.request,f.adapters)).operation;
 const rows=[{...f.record,id:'prior'}, {...f.record,id:'other',network:'signet'}, {...f.record,id:'changed',quote:{...f.record.quote,fingerprint:'b'.repeat(64)}},f.record];
 const unknown={...operation,providerId:undefined,intent:{...operation.intent,priorOperationIds:['prior']}};
 assert.equal(matchingSwap(rows,unknown).id,f.record.id);
 assert.throws(()=>matchingSwap([...rows,{...f.record,id:'duplicate'}],unknown),/swap-journal-ambiguous/);
 assert.equal(matchingSwap([{...f.record,id:'changed-id'}],operation),undefined);
 const invalid={...operation.intent,id:'another',netSats:9999};
 await assert.rejects(f.ledger.prepare(invalid),/invalid-swap-intent/);
 await assert.rejects(f.ledger.prepare({...operation.intent,id:'another',priorOperationIds:['private sentinel']}),/invalid-swap-intent/);
 await assert.rejects(publicBoardings({evaluate:async()=>{throw Error('private-sentinel');}},f.record.profileId,'mutinynet'),/swap-journal-unavailable/);
});

test('existing product pending swaps refuse a new intent before navigation or confirmation',async t=>{
 const f=await isolatedSwap(t);f.adapters.records=async()=>[f.record];
 f.owner.navigate=async()=>{throw Error('must not navigate');};
 await assert.rejects(runSwap(f.owner,f.request,f.adapters),/swap-operation-unresolved/);
 assert.equal((await f.ledger.list()).length,0);assert.equal(f.confirms(),0);
 f.owner.loggedOut=true;
 await assert.rejects(runSwap(f.owner,f.request,f.adapters),/owned-session-logged-out/);
});

for(const variant of ['valid','wrong-bitcoin','wrong-change','unconfirmed','wrong-consumed','offline','wrong-network'])test(`swap fresh receipt verification: ${variant}`,async t=>{
 const f=await isolatedSwap(t),operation=(await runSwap(f.owner,f.request,f.adapters)).operation;
 const txid='d'.repeat(64),row=f.record;
 t.mock.method(globalThis,'fetch',async()=>{throw Error('No live requests in receipt fixture');});
 t.mock.method(RestArkProvider.prototype,'getInfo',async()=>({network:variant==='wrong-network'?'signet':'mutinynet'}));
 t.mock.method(RestIndexerProvider.prototype,'getVtxos',async()=>({vtxos:row.inputs.map(coin=>({...coin,isSpent:true,settledBy:variant==='wrong-consumed'?'e'.repeat(64):txid}))}));
 t.mock.method(ReadonlyWallet,'create',async options=>{
  await options.arkProvider.getInfo();
  assert.equal(options.settlementConfig,false);
  return {dispose:async()=>{},getBoardingAddress:async()=>row.bitcoinAddress,
   getProviderConnectionState:()=>({mode:variant==='offline'?'offline':'online',source:'live'}),
   getVtxos:async()=>[{value:variant==='wrong-change'?9999:10000,commitmentTxIds:[txid]}],
   onchainProvider:{getTransactions:async()=>[{txid,status:{confirmed:variant!=='unconfirmed'},vout:[{scriptpubkey_address:row.bitcoinAddress,value:variant==='wrong-bitcoin'?9999:10000}]}]},
  };
 });
 if(variant==='wrong-network')await assert.rejects(observeSwapReceipt(f.owner.registration.player,operation,[row]),/Operator network mismatch/);
 else {
  const evidence=await observeSwapReceipt(f.owner.registration.player,operation,[row]);
  assert.equal(evidence?.outcome,variant==='valid'?'settled':undefined);
  if(evidence)assert.equal(evidence.providerId,row.id);
 }
});
test('owned application profiles isolate apps, networks and origins without moving Marketplace recovery', () => {
  const marketplace = ownedProfileKey('pair', 'signet', 'http://127.0.0.1:5174', 'marketplace');
  assert.equal(marketplace, 'a5a28695f7577105abd73236');
  const variants = [marketplace,
    ownedProfileKey('pair', 'signet', 'http://127.0.0.1:5174', 'admin'),
    ownedProfileKey('pair', 'mutinynet', 'http://127.0.0.1:5174', 'admin'),
    ownedProfileKey('pair', 'signet', 'http://127.0.0.1:6174', 'admin'),
    ownedProfileKey('another-pair', 'signet', 'http://127.0.0.1:5174', 'admin')];
  assert.equal(new Set(variants).size, variants.length);
});

test('owned context rejects removed application registration and changed role assignment', async t => {
  const { vault } = await fixture(t);
  await register(vault, [{label:'player',phrase:generateMnemonic(wordlist)}, {label:'game',phrase:generateMnemonic(wordlist)}], 'agent-created');
  await configureApplications(vault, 'http://127.0.0.1:5174');
  await assign(vault, {pair:'pair',player:'player',game:'game',network:'mutinynet'});
  const owner = new OwnedBrowser(vault, {});
  owner.registration = await vault.transaction(state => ({application:state.applications.find(row=>row.app==='admin'),pair:state.pairs[0],player:state.accounts[0],game:state.accounts[1]}));
  await owner.validateRegistration();
  await vault.transaction(state => {state.applications=state.applications.filter(row=>row.app!=='admin');});
  await assert.rejects(owner.validateRegistration(),/session-application-invalidated/);
  await configureApplications(vault,'http://127.0.0.1:5174');
  await vault.transaction(state => {const pair=state.pairs[0];[pair.player,pair.game]=[pair.game,pair.player];});
  await assert.rejects(owner.validateRegistration(),/session-identity-invalidated/);
});

test('owned lifecycle commands are strict and logout-readiness failures are private', async () => {
  for (const scenario of ['reload', 'logout', 'restore']) {
    validateLifecycle({ command: 'run', scenario }, scenario);
    for (const request of [null, { command: 'action', scenario }, { command: 'run', scenario, secret: 'sentinel' }, { command: 'run', scenario: 'other' }])
      assert.throws(() => validateLifecycle(request, scenario), /invalid-lifecycle-request/);
  }
  for (const value of [null, -1, 0.5, '0', undefined])
    await assert.rejects(readLogoutCount({ evaluate: async () => value }, 'public-id'), /logout-readiness-unavailable/);
  await assert.rejects(readLogoutCount({ evaluate: async () => { throw Error('private-sentinel'); } }, 'public-id'), /logout-readiness-unavailable/);
  assert.equal(await readLogoutCount({ evaluate: async () => 2 }, 'public-id'), 2);
});

test('owned logged-out reload never restores and rejects payment/navigation', async () => {
  const owner = new OwnedBrowser({}, {});
  owner.loggedOut = true;
  let restored = 0, reloaded = 0;
  owner.inspectLoggedOut = async () => ({ player: { state: 'logged-out' } });
  owner.restorePair = async () => { restored++; };
  owner.page = { reload: async () => { reloaded++; } };
  assert.equal((await owner.reload()).player.state, 'logged-out');
  assert.equal((await owner.logout({ command: 'run', scenario: 'logout' })).player.state, 'logged-out');
  await assert.rejects(owner.navigate('Send'), /owned-session-logged-out/);
  await assert.rejects(owner.payment({ command: 'run', scenario: 'payment', operation: 'test-send', amountSats: 1 }), /owned-session-logged-out/);
  assert.equal(restored, 0); assert.equal(reloaded, 1);
  owner.inspect = async () => ({ player: { state: 'connected' } });
  assert.equal((await owner.restore({ command: 'run', scenario: 'restore' })).player.state, 'connected');
  assert.equal(restored, 1); assert.equal(owner.loggedOut, false);
  await owner.restore({ command: 'run', scenario: 'restore' });
  assert.equal(restored, 1);
});

function logoutFixture() {
 const owner=new OwnedBrowser({transaction:async work=>work({accounts:[]})},{});
 owner.registration={player:{label:'player',profileId:'player-id'},game:{label:'game',profileId:'game-id'},pair:{network:'mutinynet'}};
 let menus=0,clicks=0,backs=0;const hooks={checked:()=>{}};
 owner.inspect=async()=>({mode:'owned'});owner.inspectLoggedOut=async()=>({player:{state:'logged-out'}});
 owner.accountMenu=async()=>{menus++;};
 const control=name=>({waitFor:async()=>{},count:async()=>1,check:async()=>{hooks.checked();},click:async()=>{if(name==='Log Out')clicks++;if(name==='Back')backs++;}});
 owner.page={evaluate:async()=>0,getByRole:(_role,{name})=>control(name),locator:()=>({last:()=>({getByRole:(_role,{name})=>control(name)})})};
 return {owner,hooks,menus:()=>menus,clicks:()=>clicks,backs:()=>backs};
}
for(const role of ['player-id','game-id'])for(const state of ['prepared','submitting','pending','unknown'])test(`owned logout refuses incoming ${role} reservation ${state} before opening controls`,async t=>{
 const f=logoutFixture();t.mock.method(Operations.prototype,'list',async()=>[{state,intent:{network:'mutinynet',profileId:'other-id',target:{profileId:role}}}]);
 await assert.rejects(f.owner.logout({command:'run',scenario:'logout'}),/logout-operation-unresolved/);
 assert.equal(f.menus(),0);assert.equal(f.clicks(),0);assert.equal(f.owner.loggedOut,undefined);
});
for(const variant of ['settled','failed','cancelled','other-network','unrelated'])test(`owned logout allows ${variant} incoming operation without blocking unrelated cleanup`,async t=>{
 const f=logoutFixture();const row={state:['settled','failed','cancelled'].includes(variant)?variant:'pending',intent:{network:variant==='other-network'?'signet':'mutinynet',profileId:'other-id',target:{profileId:variant==='unrelated'?'unrelated-id':'player-id'}}};
 t.mock.method(Operations.prototype,'list',async()=>[row]);
 assert.equal((await f.owner.logout({command:'run',scenario:'logout'})).player.state,'logged-out');assert.equal(f.clicks(),2);assert.equal(f.backs(),0);
});
test('owned logout rechecks incoming reservations after acknowledgement before final confirmation',async t=>{
 const f=logoutFixture();let pending=false,reads=0;
 t.mock.method(Operations.prototype,'list',async()=>{reads++;return pending?[{state:'pending',intent:{network:'mutinynet',profileId:'other-id',target:{profileId:'game-id'}}}]:[];});
 f.hooks.checked=()=>{pending=true;};
 await assert.rejects(f.owner.logout({command:'run',scenario:'logout'}),/logout-operation-unresolved/);
 assert.equal(reads,2);assert.equal(f.clicks(),1,'only opens the warning; never confirms cleanup');assert.equal(f.backs(),1);assert.equal(f.owner.loggedOut,undefined);
});

test('owned explicit restore failure closes without erasing or retrying the profile', async () => {
  const owner = new OwnedBrowser({}, {});
  owner.loggedOut = true;
  let attempted = 0, closed = 0;
  owner.inspectLoggedOut = async () => ({});
  owner.restorePair = async () => { attempted++; throw Error('private-sentinel'); };
  owner.context = { close: async () => { closed++; } };
  await assert.rejects(owner.restore({ command: 'run', scenario: 'restore' }), /explicit-restore-unavailable/);
  assert.equal(attempted, 1); assert.equal(closed, 1); assert.equal(owner.closed, true);
});

function isolatedProtector() {
  const key = randomBytes(32);
  return {
    secure: async () => {}, check: async () => {},
    protect: async bytes => {
      const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
      return Buffer.concat([iv, cipher.update(bytes), cipher.final(), cipher.getAuthTag()]);
    },
    unprotect: async bytes => {
      const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
      cipher.setAuthTag(bytes.subarray(-16));
      return Buffer.concat([cipher.update(bytes.subarray(12, -16)), cipher.final()]);
    },
  };
}
async function fixture(t, protector = isolatedProtector()) {
  const parent = await mkdtemp(join(tmpdir(), 'bis-test-wallets-'));
  t.after(() => rm(parent, { recursive: true, force: true })); // exact owned disposable directory
  const vault = new Vault({ root: join(parent, 'private'), protector });
  await vault.initialize();
  return { parent, vault };
}

test('argument validation precedes private access and never echoes input', async () => {
  let accessed = false;
  for (const args of [
    ['create', '--account', 'x', '--network', 'mainnet'], ['status', '--network', 'bitcoin'],
    ['create', '--account', '../human', '--network', 'signet'], ['status', '--role', 'owner'],
    ['status', '--origin', 'https://example.org'], ['run', '--scenario', 'unknown'],
    ['create', '--account', 'x'], ['import'], ['init', '--input', 'secret-sentinel'],
  ]) {
    await assert.rejects(execute(args, { makeVault: () => { accessed = true; } }));
  }
  assert.equal(accessed, false);
  assert.equal(argumentsFor(['status', '--network', 'mutinynet']).values.network, 'mutinynet');
  assert.equal(argumentsFor(['open', '--pair', 'test', '--app', 'marketplace', '--origin', 'http://127.0.0.1:5174']).values.origin, 'http://127.0.0.1:5174');
  assert.equal(argumentsFor(['--help']).command, 'help');
  for (const args of [[], ['--help'], ['open']]) {
    const result = spawnSync(process.execPath, ['BIS/scripts/test-wallets/cli.ts', ...args], { cwd: repositoryRoot, encoding: 'utf8' });
    const output = JSON.parse(result.stdout);
    assert.equal(output.ok, args[0] !== 'open');
    assert.equal(result.stderr, '');
  }
  assert.deepEqual(publicFailure(new Error('secret-sentinel')), { ok: false, reason: 'operation-unavailable' });
});

test('commands dispatch explicitly, without default create, funding or onboarding', async () => {
  const calls = [];
  const inventory = Object.fromEntries(['status', 'create', 'importAccounts', 'assign'].map(name =>
    [name, async () => { calls.push(name); return {}; }]));
  const makeVault = () => ({ initialize: async () => { calls.push('init'); } });
  await execute(['init'], { makeVault, inventory });
  await execute(['status'], { makeVault, inventory });
  assert.deepEqual(calls, ['init', 'status']);
  await execute(['create', '--account', 'new-test', '--network', 'mutinynet'], { makeVault, inventory });
  await execute(['import', '--input', 'C:\\private\\deliberately-supplied.json'], { makeVault, inventory });
  assert.deepEqual(calls, ['init', 'status', 'create', 'importAccounts']);
});

test('private paths reject served workspace and symlink ancestors', async t => {
  await assert.rejects(validatePrivatePath(join(repositoryRoot, 'output', 'vault')), /unsafe-private-path/);
  await assert.rejects(validatePrivatePath('relative'), /unsafe-private-path/);
  const { parent } = await fixture(t);
  const link = join(parent, 'junction');
  await symlink(repositoryRoot, link, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(validatePrivatePath(join(link, 'child')), /unsafe-private-path/);
});

test('atomic vault, exclusive lock and interrupted commit preserve encrypted recovery', async t => {
  const { vault } = await fixture(t);
  const sentinel = `sentinel-${randomBytes(16).toString('hex')}`;
  await vault.transaction(state => { state.sentinel = sentinel; });
  assert.equal((await readFile(join(vault.root, 'vault.json'), 'utf8')).includes(sentinel), false);
  await vault.transaction(async state => {
    assert.equal(state.sentinel === sentinel, true);
    await assert.rejects(vault.transaction(() => {}), /vault-locked/);
  });
  vault.beforeCommit = () => { throw new Error('simulated-interruption'); };
  await assert.rejects(vault.transaction(state => { state.sentinel = 'replacement'; }), /simulated-interruption/);
  vault.beforeCommit = undefined;
  await vault.transaction(state => assert.equal(state.sentinel === sentinel, true));
  assert.deepEqual(await readdir(vault.root), ['vault.json']);
});

test('protection failures are closed, never plaintext, and do not overwrite the vault', async t => {
  const { vault } = await fixture(t);
  const old = await readFile(join(vault.root, 'vault.json'), 'utf8');
  vault.protector.protect = async () => { throw new Error('private-sentinel'); };
  await assert.rejects(vault.transaction(state => { state.privateValue = 'private-sentinel'; }));
  assert.equal(await readFile(join(vault.root, 'vault.json'), 'utf8'), old);
  assert.deepEqual(await readdir(vault.root), ['vault.json']);
  vault.protector.check = async () => { throw new Error('denied'); };
  await assert.rejects(vault.transaction(() => {}));
});

test('four supplied accounts register idempotently with distinct roles and no invented funding', async t => {
  const { vault } = await fixture(t);
  const records = Array.from({ length: 4 }, (_, i) => ({ label: `test-account-${i + 1}`, phrase: generateMnemonic(wordlist) }));
  await register(vault, records.slice(0, 2), 'supplied');
  const initial = (await status(vault)).accounts.map(x => x.profileId);
  await register(vault, records, 'supplied');
  const first = await status(vault);
  assert.equal(first.accounts.length, 4);
  assert.deepEqual(first.accounts.slice(0, 2).map(x => x.profileId), initial);
  await register(vault, records, 'supplied');
  assert.deepEqual(await status(vault), first);
  assert.equal(JSON.stringify(first).includes(records[0].phrase), false);
  assert.equal(first.accounts.every(x => x.networks.every(n => n.readiness === 'unavailable')), true);
  assert.equal((await status(vault, { network: 'mutinynet' })).accounts[0].networks.length, 1);
  await assign(vault, { pair: 'used-signet', player: records[0].label, game: records[1].label, network: 'signet' });
  await assert.rejects(assign(vault, { pair: 'same', player: records[0].label, game: records[0].label, network: 'mutinynet' }), /role-conflict/);
  await assert.rejects(assign(vault, { pair: 'used-signet', player: records[2].label, game: records[1].label, network: 'signet' }), /requires-reconciliation/);
  await assert.rejects(register(vault, [{ label: 'duplicate', phrase: records[0].phrase }], 'supplied'), /duplicate-identity/);
  await assert.rejects(register(vault, [{ label: records[0].label, phrase: records[2].phrase }], 'supplied'), /registered-identity-conflict/);
  await assert.rejects(register(vault, [{ label: 'unsupported', phrase: 'not supported material' }], 'supplied'), /unsupported-private-input/);
});

test('manifest and recovery identity mismatches prevent private use', async t => {
  const { vault } = await fixture(t);
  await register(vault, [{ label: 'registered', phrase: generateMnemonic(wordlist) }], 'agent-created');
  const path = join(vault.root, 'vault.json');
  const envelope = JSON.parse(await readFile(path, 'utf8'));
  envelope.public.accounts[0].profileId = '0'.repeat(64);
  await writeFile(path, JSON.stringify(envelope));
  await assert.rejects(status(vault), /vault-manifest-mismatch/);
  await assert.rejects(verifiedInventory({ accounts: [{ label: 'changed', phrase: generateMnemonic(wordlist), profileId: '0'.repeat(64) }], pairs: [] }), /vault-identity-mismatch/);
});

test('shared environment import remains private, tolerates empty slots and repeats without replacing identities', async t => {
  const { vault } = await fixture(t);
  const mnemonic = generateMnemonic(wordlist);
  const read = () => `BIS_TEST_ACCOUNT_1_MNEMONIC="${mnemonic}"\nBIS_TEST_ACCOUNT_2_MNEMONIC=""`;
  const first = await importSharedAccounts(vault, read);
  assert.equal(first.accounts[0].label, 'test-account-1');
  assert.equal(JSON.stringify(first).includes(mnemonic), false);
  assert.deepEqual(await importSharedAccounts(vault, read), first);
  await assert.rejects(importSharedAccounts(vault, () => ''), /shared-test-accounts-not-configured/);
  await assert.rejects(importSharedAccounts(vault, () => 'BIS_TEST_ACCOUNT_1_MNEMONIC="incompatible-sentinel"'), /unsupported-private-input/);
  assert.throws(() => argumentsFor(['import', '--shared', '--input', 'C:\\private\\input.json']), /choose-one-private-input/);
});

test('real Windows DPAPI and ACLs roundtrip and reject altered protection', { skip: process.platform !== 'win32' }, async t => {
  const protector = windowsProtector();
  const { vault, parent } = await fixture(t, protector);
  const sentinel = `private-${randomBytes(20).toString('hex')}`;
  await vault.transaction(state => { state.sentinel = sentinel; });
  await vault.transaction(state => assert.equal(state.sentinel === sentinel, true));
  const disk = await readFile(join(vault.root, 'vault.json'), 'utf8');
  assert.equal(disk.includes(sentinel), false);
  await assert.rejects(protector.unprotect(Buffer.from('not-DPAPI')));
  await assert.rejects(windowsProtector({ executable: 'missing-bis-powershell-executable' }).protect(Buffer.from(sentinel)));
  const broad = join(parent, 'broad');
  await mkdir(broad);
  await assert.rejects(protector.check(broad));
});

async function operationFixture(t) {
  const { vault } = await fixture(t);
  await register(vault, [{ label: 'ledger-player', phrase: generateMnemonic(wordlist) }], 'agent-created');
  const account = (await status(vault)).accounts[0];
  const intent = { id: 'fund-one', account: account.label, profileId: account.profileId,
    generation: account.generation, network: 'signet', kind: 'faucet',
    recipient: 'tark1publicrecipient', amountSats: 50000, feeSats: null };
  return { vault, ledger: new Operations(vault), intent };
}

test('operation intent is durable and reserves wallet scope without restricting the other network', async t => {
  const { vault, ledger, intent } = await operationFixture(t);
  const first = await ledger.prepare(intent);
  assert.deepEqual(await new Operations(vault).prepare(intent), first);
  await assert.rejects(ledger.prepare({ ...intent, amountSats: 100000 }), /intent-conflict/);
  await assert.rejects(ledger.prepare({ ...intent, id: 'competing' }), /scope-pending/);
  await ledger.prepare({ ...intent, id: 'other-network', network: 'mutinynet' });
  await assert.rejects(ledger.prepare({ ...intent, id: 'wrong-generation', generation: 2 }), /identity-changed/);
  await assert.rejects(ledger.prepare({ ...intent, network: 'mainnet' }));
  await assert.rejects(ledger.prepare({ ...intent, recipient: 'private sentinel phrase' }), /invalid-operation-intent/);
  await ledger.cancelPrepared(intent.id);
  await ledger.prepare({ ...intent, id: 'replacement' });
  assert.equal((await ledger.list()).length, 3);
});

test('submission commits before side effects, competing calls cannot resend, and acknowledgement stays pending', async t => {
  const { vault, ledger, intent } = await operationFixture(t);
  await ledger.prepare(intent);
  let calls = 0;
  const send = async record => {
    calls++;
    assert.equal(record.state, 'submitting');
    assert.equal((await new Operations(vault).list())[0].state, 'submitting');
    const other = await new Operations(vault).submit(intent.id, () => { throw new Error('must not submit'); });
    assert.equal(other.state, 'submitting');
    return { providerId: 'provider-operation-123' };
  };
  const pending = await ledger.submit(intent.id, send);
  assert.equal(calls, 1);
  assert.equal(pending.state, 'pending');
  assert.deepEqual(await ledger.submit(intent.id, send), pending);
  assert.equal(calls, 1);
  await assert.rejects(ledger.cancelPrepared(intent.id), /cannot-cancel/);
  await assert.rejects(ledger.prepare({ ...intent, id: 'another-payment' }), /scope-pending/);
});

test('registered funding captures recipient generation and reserves both identities until reconciliation', async t => {
  const { vault, ledger, intent } = await operationFixture(t);
  await register(vault, [{label:'funding-target',phrase:generateMnemonic(wordlist)}], 'agent-created');
  const recipient = await vault.transaction(state => state.accounts.find(row=>row.label==='funding-target'));
  const target = {account:recipient.label,profileId:recipient.profileId,generation:recipient.generation};
  const funding = {...intent,kind:'arkade-send',target};
  const prepared = await ledger.prepare(funding);
  assert.deepEqual(prepared.intent.target,target);
  await assert.rejects(ledger.prepare({...funding,target:{...target,generation:2}}),/operation-target-changed/);
  await assert.rejects(ledger.prepare({...funding,target:{...target,secret:'sentinel'}}),/invalid-operation-target/);
  const recipientSend = {...intent,id:'target-spending',account:recipient.label,profileId:recipient.profileId,generation:recipient.generation};
  await assert.rejects(ledger.prepare(recipientSend),/operation-scope-pending/);
  await ledger.prepare({...recipientSend,id:'other-network',network:'mutinynet'});
  let submitted=0;
  await vault.transaction(state=>{state.accounts.find(row=>row.label===recipient.label).generation=2;});
  await assert.rejects(ledger.submit(intent.id,()=>{submitted++;}),/operation-target-changed/);
  await vault.transaction(state=>{state.accounts.find(row=>row.label===recipient.label).generation=1;});
  await vault.transaction(state=>{state.accounts.find(row=>row.label===recipient.label).grant.active=false;});
  await assert.rejects(ledger.submit(intent.id,()=>{submitted++;}),/test-target-grant-unavailable/);
  await vault.transaction(state=>{state.accounts.find(row=>row.label===recipient.label).grant.active=true;});
  const pending=await ledger.submit(intent.id,async()=>{submitted++;return{providerId:'funding-receipt'};});
  assert.equal(submitted,1);assert.equal(pending.state,'pending');
  await vault.transaction(state=>{state.accounts.find(row=>row.label===recipient.label).grant.active=false;});
  const settled=await ledger.reconcile(intent.id,async()=>({id:intent.id,fingerprint:pending.fingerprint,providerId:'funding-receipt',outcome:'settled',verified:true}));
  assert.equal(settled.state,'settled');
  await vault.transaction(state=>{state.accounts.find(row=>row.label===recipient.label).grant.active=true;});
  await ledger.prepare(recipientSend);
});

test('funding request rejects arbitrary recipients and joined mode before any wallet mutation', async t => {
  const request={command:'run',scenario:'funding',operation:'funding-one',amountSats:20000,recipientAccount:'registered-target'};
  validatePayment(request);
  for(const changed of [{...request,recipient:'tark1arbitrary'},{...request,network:'mainnet'},{...request,recipientAccount:'../personal'},
    {...request,amountSats:0},{...request,scenario:'payment'},{...request,phrase:'private-sentinel'}])
    assert.throws(()=>validatePayment(changed),/invalid-payment-request/);
  assert.throws(()=>joinedRequest(request),/joined-action-denied/);
  const {vault, intent}=await operationFixture(t);
  const owner=new OwnedBrowser(vault,{});
  owner.inspect=async()=>({});
  const player=await vault.transaction(state=>state.accounts[0]);
  owner.registration={player,game:player,pair:{network:intent.network},application:{origin:'http://127.0.0.1:5174'}};
  owner.expected={game:{arkadeAddress:'tark1public'}};
  await assert.rejects(owner.payment(request),/recipient-not-registered/);
  await assert.rejects(owner.payment({...request,recipientAccount:player.label}),/self-funding-not-supported/);
  assert.equal((await new Operations(vault).list()).length,0);
});

test('lost submission response retains an unknown reservation across restart until scoped evidence resolves it', async t => {
  const { vault, ledger, intent } = await operationFixture(t);
  await ledger.prepare(intent);
  const secret = 'exception-private-sentinel';
  const unknown = await ledger.submit(intent.id, async () => { throw new Error(secret); });
  assert.equal(unknown.state, 'unknown');
  assert.equal(JSON.stringify(await ledger.list()).includes(secret), false);
  const restarted = new Operations(vault);
  assert.deepEqual(await restarted.submit(intent.id, () => assert.fail('retry must not submit')), unknown);
  assert.deepEqual(await restarted.reconcile(intent.id, () => { throw new Error(secret); }), unknown);
  const evidence = { id: intent.id, fingerprint: unknown.fingerprint, providerId: 'remote-123', outcome: 'settled', verified: true, feeSats: 17 };
  await assert.rejects(restarted.reconcile(intent.id, () => ({ ...evidence, fingerprint: 'mismatch' })), /evidence-mismatch/);
  await assert.rejects(restarted.reconcile(intent.id, () => ({ ...evidence, verified: false })), /evidence-mismatch/);
  const settled = await restarted.reconcile(intent.id, () => evidence);
  assert.equal(settled.state, 'settled');
  assert.equal(settled.observedFeeSats, 17);
  await restarted.prepare({ ...intent, id: 'next-payment' });
  assert.equal((await restarted.list())[0].intent.id, intent.id);
});

test('revocation blocks new submissions but never prevents reconciliation of already pending work', async t => {
  const { vault, ledger, intent } = await operationFixture(t);
  await ledger.prepare(intent);
  await vault.transaction(state => { state.accounts[0].grant.active = false; });
  await assert.rejects(ledger.submit(intent.id, () => assert.fail('revoked')), /grant-unavailable/);
  await vault.transaction(state => { state.accounts[0].grant.active = true; });
  const pending = await ledger.submit(intent.id, async () => ({ providerId: 'remote-id' }));
  await vault.transaction(state => { state.accounts[0].grant.active = false; });
  assert.equal((await ledger.reconcile(intent.id, () => ({ id: intent.id, fingerprint: pending.fingerprint,
    providerId: 'remote-id', outcome: 'failed', verified: true }))).state, 'failed');
});

test('faucet funding binds destination, network, source and amount and reconciles without submitting again', async t => {
  const { vault, intent } = await operationFixture(t);
  let submissions = 0, delivered = false;
  const txid = 'a'.repeat(64);
  const options = { account: intent.account, network: 'mutinynet', source: 'faucet', amount: '50000', operation: 'fund-integration' };
  const adapters = { api: 'http://127.0.0.1:5190', addresses: async account => {
    assert.equal(account.network, 'mutinynet'); return { arkadeAddress: intent.recipient };
  }, ensure: async () => {}, request: async request => {
    submissions++;
    assert.equal(request.address, intent.recipient);
    assert.equal(request.network, options.network);
    assert.equal(request.amount, 50000);
    assert.equal(request.idempotencyKey, options.operation);
    return { operationId: txid, network: request.network, address: request.address, amountSats: request.amount };
  }, receipt: async (_, record) => delivered ? { id: record.intent.id, fingerprint: record.fingerprint,
    providerId: txid, outcome: 'settled', verified: true } : undefined };
  const pending = await fund(vault, options, adapters);
  assert.equal(pending.operation.state, 'pending');
  assert.equal(pending.readiness, 'pending');
  delivered = true;
  const settled = await fund(vault, options, adapters);
  assert.equal(settled.operation.state, 'settled');
  assert.equal(settled.readiness, 'funding-verified');
  assert.equal(submissions, 1);
  await assert.rejects(fund(vault, { ...options, amount: '100000' }, adapters), /intent-conflict/);
  await assert.rejects(fund(vault, options, { ...adapters, api: 'http://127.0.0.1:5191' }), /intent-conflict/);
});

test('faucet malformed acknowledgement and unknown response are retained, never re-requested', async t => {
  const { vault, intent } = await operationFixture(t);
  let submissions = 0;
  const options = { account: intent.account, network: 'signet', source: 'faucet', amount: '50000', operation: 'uncertain-fund' };
  const adapters = { api: 'http://127.0.0.1:5190', addresses: async () => ({ arkadeAddress: intent.recipient }),
    ensure: async () => {}, request: async () => { submissions++; return { operationId: 'b'.repeat(64), network: 'mutinynet' }; },
    receipt: async () => undefined };
  assert.equal((await fund(vault, options, adapters)).operation.state, 'unknown');
  assert.equal((await fund(vault, options, adapters)).operation.state, 'unknown');
  assert.equal(submissions, 1);
  for (const changes of [{ network: 'mainnet' }, { amount: '1' }, { api: 'https://example.com' }, { source: 'personal' }])
    await assert.rejects(fund({ transaction: () => assert.fail('must validate first') }, { ...options, ...changes }, adapters));
});

test('failed ledger commit prevents financial submission entirely', async t => {
  const { vault, ledger, intent } = await operationFixture(t);
  await ledger.prepare(intent);
  vault.beforeCommit = () => { throw new Error('commit-interrupted'); };
  await assert.rejects(ledger.submit(intent.id, () => assert.fail('must commit first')), /commit-interrupted/);
  vault.beforeCommit = undefined;
  assert.equal((await ledger.list())[0].state, 'prepared');
});

test('interrupted acknowledgement commit leaves submitting durable and restart does not resend', async t => {
  const { vault, ledger, intent } = await operationFixture(t);
  await ledger.prepare(intent);
  let calls = 0;
  await assert.rejects(ledger.submit(intent.id, async () => {
    calls++;
    vault.beforeCommit = () => { throw new Error('acknowledgement-commit-interrupted'); };
    return { providerId: 'acknowledged-remotely' };
  }), /acknowledgement-commit-interrupted/);
  vault.beforeCommit = undefined;
  const restart = new Operations(vault);
  assert.equal((await restart.submit(intent.id, () => assert.fail('must not resubmit'))).state, 'submitting');
  assert.equal(calls, 1);
  await assert.rejects(restart.prepare({ ...intent, id: 'competing-after-crash' }), /scope-pending/);
});

test('live observations keep networks separate, failures unavailable and zero holdings unproven without app journals', async t => {
  const { vault, ledger, intent } = await operationFixture(t);
  const zero = { availableSats: 0, availableBitcoinSats: 0, availableArkadeSats: 0, totalSats: 0, bitcoinSats: 0, arkadeSats: 0 };
  const adapters = { balance: async account => {
    if (account.network === 'mutinynet') throw new Error('private-error-sentinel');
    return { ...zero, availableSats: 50, availableArkadeSats: 50, totalSats: 50, arkadeSats: 50 };
  }, assets: async () => [] };
  const result = await observe(vault, { account: intent.account }, adapters);
  assert.equal(result.accounts[0].networks[0].balances.arkadeSats, 50);
  assert.equal(result.accounts[0].networks[1].readiness, 'unavailable');
  assert.equal(result.accounts[0].networks[1].balances, undefined);
  assert.equal(JSON.stringify(result).includes('private-error-sentinel'), false);
  const empty = await observe(vault, { network: 'signet' }, { balance: async () => zero, assets: async () => [] });
  assert.equal(empty.accounts[0].networks[0].readiness, 'incomplete');
  await ledger.prepare(intent);
  const pending = await observe(vault, { network: 'signet' }, adapters);
  assert.equal(pending.accounts[0].networks[0].readiness, 'pending');
  assert.deepEqual(pending.accounts[0].networks[0].operationIds, [intent.id]);
});

test('browser launch receives only OS settings and public payment input excludes secret or arbitrary payloads', () => {
  assert.deepEqual(browserEnvironment({ SystemRoot: 'C:/Windows', TEMP: 'C:/Temp', PATH: 'C:/bin',
    BIS_TEST_ACCOUNT_1_MNEMONIC: 'private-sentinel', FAUCET_SIGNET_MNEMONIC: 'private-sentinel',
    DEBUG: '*', PWDEBUG: '1', AWS_SECRET_ACCESS_KEY: 'private-sentinel' }),
  { SystemRoot: 'C:/Windows', TEMP: 'C:/Temp', PATH: 'C:/bin' });
  const request = { command: 'run', scenario: 'payment', operation: 'test-payment', amountSats: 1000 };
  assert.deepEqual(validatePayment(request), request);
  for (const changes of [{ amountSats: 0 }, { amountSats: 1.5 }, { operation: '../user' },
    { recipient: 'unexpected' }, { phrase: 'private-sentinel' }, { scenario: 'arbitrary-eval' }])
    assert.throws(() => validatePayment({ ...request, ...changes }), /invalid-payment-request/);
});

test('public send evidence matches exact scope and excludes prior transactions and ambiguous new sends', () => {
  const old = { transactionId: 'a'.repeat(64), profileId: 'p', network: 'mutinynet', recipient: 'recipient', amountSats: 1000, feeSats: 10 };
  const sent = { ...old, transactionId: 'b'.repeat(64) };
  const operation = { intent: { ...old, priorProviderIds: [old.transactionId] } };
  assert.deepEqual(matchingSend([old, sent], operation), sent);
  for (const changes of [{ profileId: 'other' }, { network: 'signet' }, { recipient: 'other' }, { amountSats: 1001 }, { feeSats: 11 }])
    assert.equal(matchingSend([{ ...sent, ...changes }], operation), undefined);
  assert.throws(() => matchingSend([sent, { ...sent, transactionId: 'c'.repeat(64) }], operation), /ambiguous/);
});

test('public browser journal reader rejects unavailable projections without forwarding raw storage', async () => {
  await assert.rejects(publicSends({ evaluate: async () => null }, 'profile', 'signet'), /journal-unavailable/);
  assert.deepEqual(await publicSends({ evaluate: async () => [] }, 'profile', 'signet'), []);
});

test('payment confirmation requires the same exact visible reviewed intent', () => {
  const intent = { amountSats: 1000, recipient: 'public-recipient', network: 'mutinynet', feeSats: 12 };
  const quote = { ...intent, network: 'Mutinynet', totalSats: 1012 };
  assert.doesNotThrow(() => assertPaymentReview(quote, intent));
  for (const change of [{ recipient: 'other' }, { amountSats: 1001 }, { network: 'Signet' }, { feeSats: 13 }, { totalSats: 1013 }, { feeSats: null }])
    assert.throws(() => assertPaymentReview({ ...quote, ...change }, intent), /review-mismatch/);
});

function onboardingFixturePage(intent, changes = {}) {
  const events = [], controls = {
    url: `${intent.sourceOrigin}/onboarding/?network=${intent.network}&window=owned-window`,
    network: intent.network, percent: '50', percentDisabled: false,
    address: 'No account created yet', idle: true, secretHidden: true, ...changes,
  };
  let handler;
  const prompt = 'Enter your seed phrase (12, 15, 18, 21, or 24 English words). It is stored encrypted in this browser.';
  const confirm = 'Are you sure you want to restart using the entered seed phrase? The steps will reset. The previous account and transfer will be archived locally. This does not move funds or cancel a submitted transfer.';
  const page = {
    url: () => controls.url,
    on: (event, callback) => { assert.equal(event, 'dialog'); handler = callback; },
    off: (event, callback) => { assert.equal(handler, callback); handler = undefined; events.push('detached'); },
    locator: selector => ({
      inputValue: async () => controls[{ '#network': 'network', '#transfer-percent': 'percent', '#address': 'address' }[selector]],
      isDisabled: async () => controls.percentDisabled,
      getAttribute: async name => name === 'type' ? (controls.secretHidden ? 'password' : 'text') : (controls.secretHidden ? 'false' : 'true'),
      textContent: async () => selector === '#intent' ? (controls.providerId ?? '—') :
        controls.idle ? 'No Bitcoin → Arkade transfer submitted. Step 4 starts automatically when funding is ready.' : 'not-idle',
      selectOption: async option => { assert.equal(option, 'manual'); events.push('manual'); },
      click: async () => {
        events.push('restart');
        for (const [type, message] of [['prompt', changes.prompt ?? prompt], ['confirm', confirm]]) {
          let accepted = false;
          await handler({ type: () => type, message: () => message,
            accept: async value => {
              if (type === 'prompt') assert.equal(value, 'private-sentinel-not-output');
              else assert.equal(value, undefined);
              events.push(type); accepted = true;
            }, dismiss: async () => { events.push('dismiss'); } });
          if (!accepted) throw new Error('private-sentinel-not-output');
        }
        controls.address = intent.recipient;
      },
    }),
    waitForFunction: async (_fn, expected) => { assert.equal(controls.address, expected); },
  };
  return { page, controls, events };
}

const onboardingIntent = base => ({ ...base, id: 'onboard-half', kind: 'onboard', percent: 50,
  recipient: 'tb1publicboarding', sourceOrigin: 'http://127.0.0.1:5174', amountSats: 50000,
  capturedInputs: [{ txid: 'a'.repeat(64), vout: 0, value: 100001 }] });

test('onboarding intent captures exact original inputs and half target before automatic eligibility', async t => {
  const { ledger, intent } = await operationFixture(t);
  const onboard = onboardingIntent(intent);
  for (const changes of [{ percent: 100 }, { amountSats: 100001 }, { capturedInputs: [] },
    { capturedInputs: [onboard.capturedInputs[0], onboard.capturedInputs[0]] },
    { capturedInputs: [{ ...onboard.capturedInputs[0], vout: -1 }] },
    { capturedInputs: [{ ...onboard.capturedInputs[0], value: Number.MAX_SAFE_INTEGER + 1 }] }])
    await assert.rejects(ledger.prepare({ ...onboard, ...changes }), /invalid-onboarding-intent/);
  const prepared = await ledger.prepare(onboard);
  assert.deepEqual(prepared.intent.capturedInputs, onboard.capturedInputs);
  assert.equal(prepared.intent.percent, 50);
  await assert.rejects(ledger.prepare({ ...onboard, capturedInputs: [{ ...onboard.capturedInputs[0], txid: 'b'.repeat(64) }] }), /intent-conflict/);
});

test('onboarding rejects wrong network, changed percentage, existing wallets and pending windows before private entry', async () => {
  const intent = onboardingIntent({ network: 'signet' });
  for (const change of [{ network: 'mutinynet' }, { percent: '100' }, { percentDisabled: true },
    { address: intent.recipient }, { idle: false }, { secretHidden: false },
    { url: 'http://127.0.0.1:5175/onboarding/?network=signet' },
    { url: 'http://127.0.0.1:5174/onboarding/' }]) {
    const { page, events } = onboardingFixturePage(intent, change);
    await assert.rejects(restoreOnboardingUI(page, { submit: () => assert.fail('must not enter submission') },
      { intent }, 'private-sentinel-not-output'), /onboarding-/);
    assert.deepEqual(events, []);
  }
  const controls = onboardingFixturePage(intent).controls;
  assert.doesNotThrow(() => assertFreshOnboarding(controls, intent));
});

test('private onboarding restore commits first, remains unknown without acknowledgement, and never repeats restoration', async t => {
  const { ledger, intent } = await operationFixture(t);
  const operation = await ledger.prepare(onboardingIntent(intent));
  const { page, events } = onboardingFixturePage(operation.intent);
  const originalSubmit = ledger.submit.bind(ledger);
  const committing = { submit: (id, effect) => originalSubmit(id, async claimed => {
    assert.equal((await ledger.list())[0].state, 'submitting');
    events.push('committed'); return effect(claimed);
  }) };
  const result = await restoreOnboardingUI(page, committing, operation, 'private-sentinel-not-output');
  assert.equal(result.state, 'unknown');
  assert.deepEqual(events, ['committed', 'manual', 'restart', 'prompt', 'confirm', 'detached']);
  assert.equal(JSON.stringify(result).includes('private-sentinel'), false);
  // On restart even a fresh page must not repeat the restore side effect.
  const fresh = onboardingFixturePage(operation.intent);
  assert.equal((await restoreOnboardingUI(fresh.page, ledger, operation, 'private-sentinel-not-output')).state, 'unknown');
  assert.deepEqual(fresh.events, []);
});

test('onboarding registration is pending rather than settled and unexpected prompts are dismissed without secrets', async t => {
  const { ledger, intent } = await operationFixture(t);
  const operation = await ledger.prepare(onboardingIntent(intent));
  const good = onboardingFixturePage(operation.intent, { providerId: 'registration-id' });
  assert.equal((await restoreOnboardingUI(good.page, ledger, operation, 'private-sentinel-not-output')).state, 'pending');
  const other = await operationFixture(t);
  const second = await other.ledger.prepare(onboardingIntent(other.intent));
  const bad = onboardingFixturePage(second.intent, { prompt: 'unexpected-private-sentinel' });
  const result = await restoreOnboardingUI(bad.page, other.ledger, second, 'private-sentinel-not-output');
  assert.equal(result.state, 'unknown');
  assert.deepEqual(bad.events, ['manual', 'restart', 'dismiss', 'detached']);
  assert.equal(JSON.stringify(result).includes('private-sentinel'), false);
});

test('isolated Chromium exercises native private prompts on both network URLs without captures or provider traffic', { timeout: 60000 }, async t => {
  const debug = Object.fromEntries(['DEBUG', 'PWDEBUG', 'DEBUG_FILE'].map(key => [key, process.env[key]]));
  for (const key of Object.keys(debug)) delete process.env[key];
  t.after(() => { for (const [key, value] of Object.entries(debug)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  } });
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true, env: browserEnvironment() });
  t.after(() => browser.close());
  for (const network of ['signet', 'mutinynet']) {
    const { ledger, intent } = await operationFixture(t);
    const operation = await ledger.prepare(onboardingIntent({ ...intent, network }));
    const context = await browser.newContext({ acceptDownloads: false });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      // Entirely synthetic page and non-wallet sentinel: this verifies native
      // modal handling, not Arkade registration, funding or network settlement.
      await context.route('**/*', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html>
        <select id="network"><option value="${network}">${network}</option></select>
        <input id="transfer-percent" type="range" min="1" max="100" value="50">
        <input id="address" value="No account created yet">
        <input id="recovery-value" type="password">
        <button id="reveal-recovery" aria-pressed="false">Reveal</button>
        <p id="status">No Bitcoin → Arkade transfer submitted. Step 4 starts automatically when funding is ready.</p>
        <span id="intent">—</span>
        <select id="seed-mode"><option value="auto">Auto</option><option value="manual">Manual</option></select>
        <button id="create">Restart</button>
        <script>document.querySelector('#create').onclick=()=>{
          const phrase=prompt('Enter your seed phrase (12, 15, 18, 21, or 24 English words). It is stored encrypted in this browser.');
          if(phrase!=='private-sentinel-not-output')return;
          if(!confirm('Are you sure you want to restart using the entered seed phrase? The steps will reset. The previous account and transfer will be archived locally. This does not move funds or cancel a submitted transfer.'))return;
          document.querySelector('#address').value='tb1publicboarding';
          document.querySelector('#intent').textContent='isolated-registration';
        };</script>` }));
      await page.goto(`${operation.intent.sourceOrigin}/onboarding/?network=${network}`);
      const result = await restoreOnboardingUI(page, ledger, operation, 'private-sentinel-not-output');
      assert.equal(result.state, 'pending');
      assert.equal(result.providerId, 'isolated-registration');
      assert.equal(JSON.stringify(result).includes('private-sentinel'), false);
      assert.equal(page.listenerCount('dialog'), 0);
    } finally { await context.close(); }
  }
});

test('joined commands cannot reach financial, recovery, account, network or arbitrary browser actions', async () => {
  for (const request of [
    { command: 'run', scenario: 'payment' }, { command: 'run', scenario: 'onboard-half' },
    { command: 'close' }, { command: 'logout' }, { command: 'create' }, { command: 'import' },
    { command: 'inspect', selector: 'input' }, { command: 'action', type: 'evaluate', script: 'private-sentinel' },
    ...['Send', 'Swap', 'Contracts', 'Developer', 'Game Wallet', 'Get Recovery Phrase', 'Onboarding', 'Restore Account'].map(screen =>
      ({ command: 'action', type: 'navigate', screen })),
    { command: 'action', type: 'navigate', screen: 'Account', phrase: 'private-sentinel' },
  ]) assert.throws(() => joinedRequest(request), /joined-action-denied/);
  assert.equal(joinedRequest({ command: 'inspect' }), 'inspect');
  assert.equal(joinedRequest({ command: 'detach' }), 'detach');
  assert.equal(joinedRequest({ command: 'action', type: 'navigate', screen: 'Assets' }), 'navigate');
  const options = ['join', '--origin', 'http://127.0.0.1:5174', '--app', 'marketplace', '--api', 'http://127.0.0.1:9222', '--page', 'A'.repeat(32)];
  assert.equal(argumentsFor(options).values.page, 'A'.repeat(32));
  await assert.rejects(execute(options, { makeVault: () => assert.fail('joined mode must not open the vault') }), /session-transport/);
  assert.throws(() => argumentsFor([...options, '--pair', 'registered-test-pair']), /invalid-arguments/);
  assert.throws(() => argumentsFor(options.map(value => value === 'http://127.0.0.1:9222' ? 'https://example.org' : value)), /invalid-origin/);
});

test('joined attachment failures are sanitized and target identity is checked before public inspection', async () => {
  const options = { app: 'marketplace', origin: 'http://127.0.0.1:5174', api: 'http://127.0.0.1:9222', page: 'A'.repeat(32) };
  let detached = 0, inspected = 0;
  const owner = new JoinedBrowser(options, { connect: async (_endpoint, settings) => {
    assert.equal(settings.noDefaults, true);
    return { newBrowserCDPSession: async () => ({ send: async (_method, args) => {
      assert.equal(args.targetId, options.page);
      return { targetInfo: { type: 'page', url: `${options.origin}/onboarding/` } };
    }, detach: async () => {} }), close: async () => { detached++; } };
  } });
  owner.readPublic = async () => { inspected++; };
  await assert.rejects(owner.start(), /joined-attachment-unavailable/);
  assert.equal(detached, 1); assert.equal(inspected, 0);
  const missing = new JoinedBrowser(options, { connect: async () => { throw new Error('private-sentinel'); } });
  try { await missing.start(); assert.fail('must reject'); }
  catch (error) { assert.deepEqual(publicFailure(error), { ok: false, reason: 'joined-attachment-unavailable' }); }
});

test('joined identity changes invalidate authority permanently, even when the old fixture identity returns', async () => {
  const owner = new JoinedBrowser({});
  owner.binding = { network: 'signet', playerId: 'a'.repeat(64), gameAddress: null };
  let observed = { ...owner.binding, screen: 'Account' };
  owner.readPublic = async () => observed;
  assert.equal((await owner.inspect()).mode, 'joined');
  observed = { ...observed, playerId: 'b'.repeat(64) };
  await assert.rejects(owner.inspect(), /context-invalidated/);
  observed = { ...observed, ...owner.binding };
  await assert.rejects(owner.inspect(), /context-invalidated/);
  await assert.rejects(owner.request({ command: 'run', scenario: 'payment' }), /joined-action-denied/);
});

test('joined failed public reads revoke authority and failed detach retains only a disconnect retry', async () => {
  const owner = new JoinedBrowser({});
  owner.binding = { network: 'signet', playerId: 'a'.repeat(64), gameAddress: null };
  owner.readPublic = async () => { throw new Error('unavailable-public-context'); };
  await assert.rejects(owner.inspect(), /unavailable-public-context/);
  owner.readPublic = async () => ({ ...owner.binding, screen: 'Account' });
  await assert.rejects(owner.inspect(), /context-invalidated/);
  let attempts = 0;
  owner.browser = { close: async () => { if (++attempts === 1) throw new Error('private-sentinel'); }, isConnected: () => true };
  await assert.rejects(owner.detach(), /detach-unavailable/);
  await assert.rejects(owner.inspect(), /session-unavailable/);
  await owner.detach();
  assert.equal(attempts, 2); assert.equal(owner.browser, undefined);
});

test('reported external onboarding survives re-import, blocks new work only on its network and never becomes balance evidence', async t => {
  const { vault } = await fixture(t);
  const records = [{ label: 'supplied-history', phrase: generateMnemonic(wordlist) }];
  await register(vault, records, 'supplied');
  const account = (await status(vault)).accounts[0];
  const ledger = new Operations(vault);
  const intent = { id: 'before-history', account: account.label, profileId: account.profileId,
    generation: 1, network: 'signet', kind: 'arkade-send', recipient: 'public-recipient', amountSats: 1000, feeSats: 0 };
  await ledger.prepare(intent);
  const submitted = await ledger.submit(intent.id, async () => ({ providerId: 'original-operation' }));
  await recordPendingOnboarding(vault, [account.label], 'signet');
  await recordPendingOnboarding(vault, [account.label], 'signet');
  await register(vault, records, 'supplied');
  const snapshot = await status(vault);
  assert.equal(snapshot.accounts[0].networks[0].readiness, 'pending');
  assert.equal(snapshot.accounts[0].networks[1].readiness, 'unavailable');
  assert.equal(snapshot.accounts[0].networks[0].balances, undefined);
  await assert.rejects(ledger.prepare({ ...intent, id: 'new-signet' }), /external-onboarding-unreconciled/);
  // Previously submitted work remains reconcilable despite the external hold.
  assert.equal((await ledger.reconcile(intent.id, async () => ({ id: intent.id, fingerprint: submitted.fingerprint,
    providerId: submitted.providerId, outcome: 'settled', verified: true }))).state, 'settled');
  const mutiny = await ledger.prepare({ ...intent, id: 'new-mutiny', network: 'mutinynet' });
  assert.equal(mutiny.state, 'prepared');
  const zero = { availableSats: 0, availableBitcoinSats: 0, availableArkadeSats: 0, totalSats: 0, bitcoinSats: 0, arkadeSats: 0 };
  const observed = await observe(vault, { account: account.label, network: 'signet' }, { balance: async () => zero, assets: async () => [] });
  assert.equal(observed.accounts[0].networks[0].readiness, 'pending');
  assert.equal(observed.accounts[0].networks[0].reason, 'user-reported-onboarding-unreconciled');
  await assert.rejects(recordPendingOnboarding(vault, ['unregistered'], 'signet'), /account-unavailable/);
});

test('isolated live CDP join navigates only public UI and detach preserves browser, tab and storage', { timeout: 60000 }, async t => {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true, env: browserEnvironment(),
    args: ['--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', '--enable-automation'] });
  t.after(() => browser.close());
  const context = await browser.newContext();
  const page = await context.newPage();
  const playerId = 'a'.repeat(64), gameAddress = `tark1${'a'.repeat(30)}`;
  await context.route('**/*', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html>
    <section aria-label="Marketplace wallets and instructions"><code title="${playerId}">Player</code><code title="${gameAddress}">Game</code></section>
    <p class="bis-network-text">Network: Signet</p><div class="bis-card"><h2>Account</h2>
    <input aria-label="Total balance" value="1,000 sats"><input aria-label="Bitcoin balance" value="0 sats"><input aria-label="Arkade balance" value="1,000 sats">
    <button onclick="screen('Accounts Details')">Accounts Details</button><button onclick="screen('Receive')">⚡ Receive</button>
    <button onclick="screen('Assets')">Assets</button><button onclick="screen('Transactions')">Transactions</button>
    <button onclick="screen(document.querySelector('h2').textContent==='Accounts Details'?'Account':'Accounts Details')">Back</button>
    <button onclick="window.mutations++">Send</button><button onclick="window.mutations++">Get Recovery Phrase</button></div>
    <script>window.mutations=0;localStorage.setItem('isolated-user-state','unchanged');function screen(name){document.querySelector('h2').textContent=name;}</script>` }));
  await page.goto('http://127.0.0.1:59999/integration-marketplace/');
  const root = await browser.newBrowserCDPSession();
  const { arguments: commandLine } = await root.send('Browser.getBrowserCommandLine');
  const profile = commandLine.find(value => value.startsWith('--user-data-dir='))?.slice('--user-data-dir='.length);
  assert.ok(profile);
  const port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0];
  assert.match(port, /^\d+$/);
  const target = await context.newCDPSession(page);
  const { targetInfo } = await target.send('Target.getTargetInfo');
  await target.detach(); await root.detach();
  const owner = new JoinedBrowser({ app: 'marketplace', origin: 'http://127.0.0.1:59999',
    api: `http://127.0.0.1:${port}`, page: targetInfo.targetId });
  t.after(() => owner.detach());
  const initial = await owner.start();
  assert.equal(initial.mode, 'joined'); assert.equal(initial.playerId, playerId);
  assert.equal(initial.balances.totalSats, 1000);
  assert.equal((await owner.navigate('Assets')).screen, 'Assets');
  for (const screen of ['Send', 'Swap', 'Contracts', 'Onboarding', 'Get Recovery Phrase'])
    await assert.rejects(owner.navigate(screen), /joined-action-denied/);
  assert.equal((await owner.navigate('Receive')).screen, 'Receive');
  const before = await page.evaluate(() => ({ storage: localStorage.getItem('isolated-user-state'), mutations: window.mutations }));
  assert.deepEqual(before, { storage: 'unchanged', mutations: 0 });
  // Simulate a human identity change after attachment. Old authority does not
  // return merely because the human then switches back to the original account.
  await page.evaluate(() => document.querySelector('code').setAttribute('title', 'b'.repeat(64)));
  await assert.rejects(owner.navigate('Transactions'), /context-invalidated/);
  await page.evaluate(() => document.querySelector('code').setAttribute('title', 'a'.repeat(64)));
  await assert.rejects(owner.inspect(), /context-invalidated/);
  assert.deepEqual(await owner.request({ command: 'detach' }), { mode: 'joined', detached: true });
  assert.equal(browser.isConnected(), true); assert.equal(page.isClosed(), false);
  assert.deepEqual(await page.evaluate(() => ({ storage: localStorage.getItem('isolated-user-state'), mutations: window.mutations })), before);
  await assert.rejects(owner.inspect(), /session-unavailable/);
  const cli = spawn(process.execPath, ['BIS/scripts/test-wallets/cli.ts', 'join', '--origin', 'http://127.0.0.1:59999',
    '--app', 'marketplace', '--api', `http://127.0.0.1:${port}`, '--page', targetInfo.targetId],
  { cwd: repositoryRoot, env: browserEnvironment(), stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  let stdout = '', stderr = '';
  cli.stdout.on('data', bytes => { stdout += bytes.toString(); });
  cli.stderr.on('data', bytes => { stderr += bytes.toString(); });
  const completion = new Promise((resolve, reject) => { cli.once('error', reject); cli.once('close', resolve); });
  const deadline = setTimeout(() => cli.kill(), 15000);
  try {
    cli.stdin.end([
      { command: 'inspect' }, { command: 'run', scenario: 'payment', amountSats: 1000 },
      { command: 'action', type: 'navigate', screen: 'Accounts Details' }, { command: 'detach' },
    ].map(request => JSON.stringify(request)).join('\n') + '\n');
    assert.equal(await completion, 0);
  } finally { clearTimeout(deadline); if (cli.exitCode === null) cli.kill(); }
  assert.equal(stderr, '');
  const responses = stdout.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(responses.length, 5);
  assert.equal(responses[0].mode, 'joined'); assert.equal(responses[1].mode, 'joined');
  assert.deepEqual(responses[2], { ok: false, reason: 'joined-action-denied' });
  assert.equal(responses[3].screen, 'Accounts Details'); assert.equal(responses[4].detached, true);
  assert.equal(browser.isConnected(), true); assert.equal(page.isClosed(), false);
  assert.deepEqual(await page.evaluate(() => ({ storage: localStorage.getItem('isolated-user-state'), mutations: window.mutations })), before);
  await page.evaluate(() => {
    document.querySelector('h2').textContent = 'Get Recovery Phrase';
    const privateInput = document.createElement('input');
    privateInput.value = 'private-sentinel-not-output';
    privateInput.setAttribute('aria-label', 'Private recovery phrase');
    document.body.append(privateInput);
  });
  const privateView = new JoinedBrowser({ app: 'marketplace', origin: 'http://127.0.0.1:59999',
    api: `http://127.0.0.1:${port}`, page: targetInfo.targetId });
  try { await privateView.start(); assert.fail('private view must reject attachment'); }
  catch (error) { assert.deepEqual(publicFailure(error), { ok: false, reason: 'joined-attachment-unavailable' }); }
  assert.equal(browser.isConnected(), true); assert.equal(page.isClosed(), false);
  assert.equal(await page.evaluate(() => window.mutations), 0);
});


