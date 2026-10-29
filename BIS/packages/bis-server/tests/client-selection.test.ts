import test from 'node:test';
import assert from 'node:assert/strict';
import { createHostedHandler } from '../src/server/hosted.ts';
import { createWalletPool } from '../src/server/wallet-pool.ts';
import type { SigningStore } from '../src/server/signing-store.ts';
import { configureBisServer, probeGameSigner } from '../../integration/src/client/wallet-layer-arkade/server-wallet.ts';
import { createServerFirstStorage, createServerProfileMemory } from '../../integration/src/client/state-layer-core/server-first-game-wallet.ts';
import { createLocalGameWallet } from '../../integration/src/client/state-layer-core/game-wallet.ts';
import { writeAssetRecord } from '../../integration/src/client/state-layer-core/assets.ts';
import { testLocks } from '../../integration/tests/client/locks-fixture.ts';
import { writeAssetDeliveryRecord } from '../../integration/src/client/state-layer-core/asset-delivery.ts';
import { beginLocalMarketplaceCheckout, advanceLocalMarketplaceCheckout } from '../../integration/src/client/state-layer-core/marketplace-checkout.ts';

// Real connection protocol/controller, deterministic provider balances. No funds
// are sent, and the injected payment callback is not financial acceptance.
const phrases = [
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  'legal winner thank year wave sausage worth useful legal winner thank yellow',
  'letter advice cage absurd amount doctor acoustic avoid letter advice cage above',
];
const mutinynetPhrases = [
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon carbon',
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon dune',
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon grocery',
];
function installStorage(t) {
  const storageDescriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage'), navigatorDescriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  const rows=new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{get length(){return rows.size;},key:index=>[...rows.keys()][index]??null,getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,String(value)),removeItem:key=>rows.delete(key)}});
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:testLocks()}});
  t.after(()=>{
    if(storageDescriptor)Object.defineProperty(globalThis,'localStorage',storageDescriptor);else delete (globalThis as any).localStorage;
    if(navigatorDescriptor)Object.defineProperty(globalThis,'navigator',navigatorDescriptor);else delete (globalThis as any).navigator;
  });
}
async function fixture(t, playerSlot?: number) {
  installStorage(t);
  configureBisServer({}); t.after(() => configureBisServer({}));
  const values = Object.fromEntries([
    ...phrases.map((phrase, i) => [`BIS_GAME_WALLET_SIGNET_0${i + 1}_MNEMONIC`, phrase]),
    ...mutinynetPhrases.map((phrase, i) => [`BIS_GAME_WALLET_MUTINYNET_0${i + 1}_MNEMONIC`, phrase]),
  ]);
  const amounts = { signet: [0, 2000, 3000], mutinynet: [4000, 0, 0] };
  const bitcoin = [20000,20000,20000], quoted: any[] = [], minted: any[] = [], delivered: any[] = [], burned: any[] = [];
  const assets:Record<string,string>[]=[{},{},{}];
  const balanceReads: string[] = [], requests: any[] = [], payments: any[] = [];
  const pool = createWalletPool(values, async wallet => {
    balanceReads.push(`${wallet.network}:${wallet.slot}`);
    return { availableArkadeSats: amounts[wallet.network][Number(wallet.slot) - 1], availableBitcoinSats: bitcoin[Number(wallet.slot)-1], mintMinimumSats:546,boardingMinimumSats:1000,assets:assets[Number(wallet.slot)-1] };
  });
  const profiles = new Map((await pool.publicWallets('signet')).map(wallet => [wallet.profileId, Number(wallet.slot) - 1]));
  const mutinynetProfiles = new Map((await pool.publicWallets('mutinynet')).map(wallet => [wallet.profileId, Number(wallet.slot) - 1]));
  const playerProfile=playerSlot===undefined?'player':[...profiles].find(([,slot])=>slot===playerSlot)![0];
  const store: SigningStore = { ping: async () => {}, consumePublicRequest: async () => {}, assetAllowed: async () => false,
    claim: async () => { throw Error('No financial signing in this fixture.'); }, complete: async () => { throw Error('No financial signing in this fixture.'); }, session: async () => { throw Error('No financial signing in this fixture.'); } };
  const handler = createHostedHandler({ pool, store, env: { ...values, BIS_OWNER_TOKEN: 'selection-test-owner-secret-'.repeat(3), BIS_PUBLIC_PAYMENT_SIGNING: 'true', BIS_PUBLIC_SIGNING_NETWORKS: 'signet,mutinynet' } });
  let network: 'signet' | 'mutinynet' = 'signet', blocked = false, offlineSelection = false;
  let delayed: (() => void) | undefined;
  const fetcher: typeof fetch = async (url, init) => {
    const request = new Request(String(url), init), body = await request.clone().json(); requests.push(body);
    if (body.requirement && offlineSelection) throw Error('Balance endpoint interrupted.');
    if (body.requirement && delayed) { const wait = delayed; delayed = undefined; await new Promise<void>(resolve => { wait(); release = resolve; }); }
    return handler(request);
  };
  let release = () => {};
  const rows = new Map<string, string>();
  const memory = createServerProfileMemory({ getItem: key => rows.get(key) ?? null, setItem: (key, value) => { rows.set(key, value); } }, () => 'https://selection.test/api/bis/');
  const backend = createServerFirstStorage({ load: async () => null, select: async () => {}, logout: async () => {}, reset: async () => {}, subscribe: () => () => {}, dispose() {} }, () => network,
    (network, options) => probeGameSigner(network, { ...options, endpoint: 'https://selection.test/api/bis/', fetcher }), memory);
  const wallet = createLocalGameWallet({ playerProfileId: () => playerProfile, playerNetwork: () => network }, {
    storage: backend.storage, source: backend.source, probe: backend.refresh,
    selectForOperation: (account, requirement, signal, current) => backend.selectForOperation(account, {...requirement,...(/^[a-f0-9]{64}$/.test(playerProfile)?{excludedProfiles:[playerProfile]}:{})}, signal, candidate => current() && !blocked && (!candidate||candidate.profileId!==playerProfile)),
    restore: async () => { throw Error('No manual import in selection fixture.'); },
    deliver:async account=>{delivered.push(account);throw Error('Deterministic delivery boundary reached.');},
    addresses: async account => ({ arkadeAddress: 'tark1' + account.profileId, bitcoinAddress: 'tb1-' + account.profileId }),
    balance: async account => { const availableSats = amounts[account.network!][profiles.get(account.profileId)!]; return { availableSats, totalSats: availableSats + 20000, availableArkadeSats: availableSats, arkadeSats: availableSats, bitcoinSats: 20000, availableBitcoinSats: 20000 }; }, watch: undefined,
  }, {quote:async account=>{quoted.push(account);throw Error('Deterministic boarding quote boundary reached.');},submit:async()=>{throw Error('No boarding submission in this fixture.');},check:async()=>{throw Error('No boarding receipts in this fixture.');}}, { pay: async (account, recipient, amountSats, signal, current) => {
    signal.throwIfAborted(); assert.equal(current(), true); payments.push({ account, recipient, amountSats }); return { status: 'idle' };
  }, check: async () => { throw Error('No network receipts in this fixture.'); } }, () => {}, {availability:async account=>({canMint:true,minimumSats:546,availableSats:amounts[account.network!][profiles.get(account.profileId)!]}),mint:async account=>{minted.push(account);return {status:'error',code:'unavailable',message:'No financial mint in this fixture.'};},burn:async account=>{burned.push(account);throw Error('Deterministic burn boundary reached.');}});
  t.after(() => wallet.dispose());
  await wallet.refresh(false);
  return { wallet, backend, amounts, bitcoin, assets, quoted, minted, delivered, burned, balanceReads, requests, payments, profiles, mutinynetProfiles, block: (value: boolean) => { blocked = value; }, network: (value: typeof network) => { network = value; }, offline: () => { offlineSelection = true; }, delay: (started: () => void) => { delayed = started; }, release: () => release() };
}

test('client mint availability uses SDK dust and boarding quote independently selects confirmed Bitcoin', async t => {
  const f=await fixture(t);
  f.amounts.signet[0]=600;
  assert.equal((await f.wallet.getMintAvailability()).canMint,true);
  assert.equal(f.profiles.get(f.wallet.getState().profileId!),0);
  assert.equal(f.requests.at(-1).requirement.purpose,'mint');
  f.bitcoin[0]=900;
  await assert.rejects(f.wallet.quoteBoarding(),/Deterministic boarding quote boundary/);
  assert.equal(f.profiles.get(f.quoted[0].profileId),1);
  assert.equal(f.requests.at(-1).requirement.purpose,'boarding');
  f.block(true); const before=f.quoted.length;
  await assert.rejects(f.wallet.quoteBoarding(),/active or unresolved/);
  assert.equal(f.quoted.length,before);
});

test('Marketplace sell payment stays on the journaled Game Wallet even when an earlier slot becomes funded', async t => {
  const f=await fixture(t),original=f.wallet.getState().profileId!,playerAddress='tark1'+'a'.repeat(30);
  const record=beginLocalMarketplaceCheckout({id:crypto.randomUUID(),direction:'sell',assetId:'ab'.repeat(34),quantity:'1',priceSats:1000,player:{profileId:'player',address:playerAddress},game:{profileId:original,address:f.wallet.getState().addresses!.arkadeAddress}});
  f.amounts.signet[0]=10000; const before=f.requests.length;
  // Synthetic leg evidence drives only this deterministic journal test.
  await advanceLocalMarketplaceCheckout(record,{deliver:async()=>({status:'delivered',transactionId:'11'.repeat(32)}),pay:async input=>{
    await f.wallet.payPlayer({profileId:'player',address:input.recipient},input.amountSats,()=>true,record.request.id);
    return {status:'pending'};
  }});
  assert.equal(f.payments[0].account.profileId,original);
  assert.equal(f.requests.length,before,'checkout payment must not request a new wallet');
  await assert.rejects(f.wallet.payPlayer({profileId:'player',address:playerAddress},999,()=>true,record.request.id),/Marketplace payment scope changed/);
  assert.equal(f.payments.length,1);
  assert.equal((await f.wallet.getMintAvailability()).canMint,false,'unrelated work cannot change the checkout signer');
});

test('Marketplace buy delivery remains bound to its checkout before an asset journal exists', async t => {
  const f=await fixture(t),original=f.wallet.getState().profileId!,playerAddress='tark1'+'a'.repeat(30),assetId='ab'.repeat(34);
  const record=beginLocalMarketplaceCheckout({id:crypto.randomUUID(),direction:'buy',assetId,quantity:'1',priceSats:1000,player:{profileId:'player',address:playerAddress},game:{profileId:original,address:f.wallet.getState().addresses!.arkadeAddress}});
  f.amounts.signet[0]=10000; f.assets[0][assetId]='1'; f.assets[1][assetId]='1';
  const before=f.requests.length;
  await advanceLocalMarketplaceCheckout(record,{pay:async()=>({status:'succeeded',transactionId:'22'.repeat(32)}),deliver:async input=>{
    await f.wallet.deliverAsset({operationId:record.request.id,...input});return {status:'pending'};
  }});
  assert.equal(f.delivered[0].profileId,original);
  assert.equal(f.requests.length,before);
  assert.equal(f.wallet.getState().profileId,original);
});

test('a checkout starting during pool selection prevents promotion of a replacement signer', async t => {
  const f=await fixture(t),original=f.wallet.getState().profileId!;
  let started!:()=>void;const waiting=new Promise<void>(resolve=>{started=resolve;});f.delay(started);
  const pending=f.wallet.payPlayer({profileId:'player',address:'tark1'+'a'.repeat(30)});
  const refused=assert.rejects(pending,/active or unresolved/);
  await waiting;
  beginLocalMarketplaceCheckout({id:crypto.randomUUID(),direction:'buy',assetId:'ab'.repeat(34),quantity:'1',priceSats:1000,player:{profileId:'player',address:'tark1'+'a'.repeat(30)},game:{profileId:original,address:f.wallet.getState().addresses!.arkadeAddress}});
  f.release();await refused;
  assert.equal((await f.backend.storage.load())?.profileId,original);
  assert.equal(f.payments.length,0);
});

test('existing mint retry reaches only the original adapter without a new pool selection', async t => {
  const f=await fixture(t),original=f.wallet.getState().profileId!;
  const request={operationId:'pending-mint',name:'Pending trophy',ticker:'PND',amount:'1',decimals:0};
  writeAssetRecord(original,{request,status:'pending',network:'signet'});
  f.block(true); const before=f.requests.length;
  await f.wallet.mintAsset(request);
  assert.equal(f.requests.length,before);
  assert.equal(f.minted.length,1);
  assert.equal(f.minted[0].profileId,original);
  await f.wallet.mintAsset({...request,operationId:'different-mint'});
  assert.equal(f.minted.length,1,'a different operation cannot bypass pending-work selection checks');
  assert.equal(f.wallet.getState().profileId,original);
});

test('client excludes a conflicting Player profile before selecting its initial Game Wallet', async t => {
  const f=await fixture(t,0);
  assert.equal(f.wallet.getState().status,'ready');
  assert.equal(f.profiles.get(f.wallet.getState().profileId!),1);
  assert.equal(f.requests.find(body=>body.requirement)?.requirement.excludedProfiles.length,1);
});

test('delivery and burn select asset-owning profiles, and a pending delivery never reselects', async t => {
  const f=await fixture(t),assetId='ab'.repeat(34);
  f.amounts.signet[0]=10000;
  f.assets[2][assetId]='2';
  const request={operationId:'asset-delivery',assetId,quantity:'2',recipient:'tark1'+'a'.repeat(30)};
  await f.wallet.deliverAsset(request);
  assert.equal(f.profiles.get(f.delivered[0].profileId),2);
  assert.equal(f.requests.at(-1).requirement.asset.assetId,assetId);
  f.assets[0][assetId]='3'; f.assets[1][assetId]='3';
  await f.wallet.burnAsset({operationId:'asset-burn',assetId,quantity:'2'});
  assert.equal(f.profiles.get(f.burned[0].profileId),2);
  assert.equal(f.requests.at(-1).requirement.asset.exact,true);
  const original=f.wallet.getState().profileId!;
  writeAssetDeliveryRecord({version:1,id:request.operationId,profileId:original,request,status:'pending',inputs:[{txid:'11'.repeat(32),vout:0}],inputAssets:[{assetId,quantity:'2'}],senderScript:'5120'+'c'.repeat(64),recipientScript:'5120'+'d'.repeat(64),sourceQuantity:'2',network:'signet'});
  f.block(true); const before=f.requests.length;
  await f.wallet.deliverAsset(request);
  assert.equal(f.requests.length,before);
  assert.equal(f.delivered.length,2);
  assert.equal(f.delivered[1].profileId,original);
});

test('client initialization skips Bitcoin-funded but Arkade-empty slot 01 and new payment rechecks priority', async t => {
  const f = await fixture(t);
  assert.equal(f.profiles.get(f.wallet.getState().profileId!), 1);
  assert.equal(f.wallet.getState().balance?.availableSats, 2000);
  assert.deepEqual(f.balanceReads, ['signet:01', 'signet:02']);
  assert.deepEqual(f.requests.find(body => body.requirement).requirement, { arkadeSats: 1000 });
  f.amounts.signet[0] = 1500;
  await f.wallet.payPlayer({ profileId: 'player', address: 'tark1-player' });
  assert.equal(f.profiles.get(f.payments[0].account.profileId), 0);
  assert.equal(f.wallet.getState().profileId, f.payments[0].account.profileId);
  assert.equal(f.payments[0].amountSats, 1000);
  assert.equal(f.balanceReads.at(-1), 'signet:01');
});

test('client leaves an empty original wallet selected while its work is unresolved', async t => {
  const f = await fixture(t), original = f.wallet.getState().profileId;
  f.amounts.signet[1] = 0; f.block(true);
  const before = f.requests.filter(body => body.requirement).length;
  await f.wallet.refresh();
  assert.equal(f.wallet.getState().profileId, original);
  assert.equal(f.wallet.getState().source, 'server');
  assert.equal(f.requests.filter(body => body.requirement).length, before);
  await assert.rejects(f.wallet.payPlayer({ profileId: 'player', address: 'tark1-player' }), /active or unresolved/);
  assert.equal(f.payments.length, 0);
  f.block(false); await f.wallet.refresh();
  assert.equal(f.profiles.get(f.wallet.getState().profileId!), 2);
});

test('failed balance selection keeps the connected server and original identity, not manual fallback', async t => {
  const f = await fixture(t), original = f.wallet.getState().profileId;
  f.amounts.signet[1] = 0; f.offline(); await f.wallet.refresh();
  assert.equal(f.wallet.getState().profileId, original);
  assert.equal(f.wallet.getState().serverStatus, 'connected');
  assert.equal(f.wallet.getState().source, 'server');
  assert.match(f.wallet.getState().message!, /verified spendable balance/);
  assert.equal(f.wallet.getState().balance?.availableSats, 0);
});

test('new unresolved work appearing during selection prevents promotion of the replacement', async t => {
  const f = await fixture(t), original = f.wallet.getState().profileId;
  let started!: () => void;
  const waiting = new Promise<void>(resolve => { started = resolve; });
  f.delay(started);
  const pending = f.wallet.payPlayer({ profileId: 'player', address: 'tark1-player' });
  await waiting; f.block(true); f.release();
  await assert.rejects(pending, /active or unresolved/);
  assert.equal(f.wallet.getState().profileId, original);
  assert.equal((await f.backend.storage.load())?.profileId, original);
  assert.equal(f.payments.length, 0);
});

test('network replacement during balance selection cannot activate a stale signer or submit a payment', async t => {
  const f = await fixture(t);
  let started!: () => void;
  const waiting = new Promise<void>(resolve => { started = resolve; });
  f.delay(started);
  const pending = f.wallet.payPlayer({ profileId: 'player', address: 'tark1-player' });
  const refused = assert.rejects(pending);
  await waiting; f.network('mutinynet'); await f.wallet.refresh();
  const active = f.wallet.getState().profileId;
  f.release(); await refused;
  assert.equal(f.wallet.getState().network, 'mutinynet');
  assert.equal(f.wallet.getState().profileId, active);
  assert.equal(active,undefined);assert.equal(f.wallet.getState().workflowMode,'local');
  assert.equal(f.requests.some(row=>row.network==='mutinynet'),false);
  assert.equal(f.payments.length, 0);
});
