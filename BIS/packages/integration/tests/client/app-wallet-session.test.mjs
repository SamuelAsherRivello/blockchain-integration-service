import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppWalletSession } from '../../src/client/wallet-layer-arkade/app-wallet-session.ts';

// Public BIP39 vector, never a funded identity.
const phrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const account = (profileId = 'a', network = 'signet') => ({ phrase, profileId, network });
const signal = () => new AbortController().signal;
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };
function fixture(options = {}) {
  const wallets = [], configs = [];
  const session = createAppWalletSession({ ...options, createWallet: async config => {
    configs.push(config);
    const wallet = { disposed: 0, async dispose() { this.disposed++; } };
    wallets.push(wallet); return wallet;
  } });
  return {session,wallets,configs};
}

test('lazy app-local two-role budget, same read/sign object and memory-only safe SDK config', async () => {
  const {session,wallets,configs}=fixture();
  assert.equal(wallets.length,0);
  const first=await session.read('player',account(),signal(),async w=>w);
  assert.equal(await session.sign('player',account(),signal(),async w=>w),first);
  await session.read('game',account('game'),signal(),async()=>{});
  await session.read('player',account(),signal(),async()=>{});
  assert.equal(wallets.length,2);
  assert.ok(configs.every(config=>config.settlementConfig===false && config.storage.walletRepository && config.storage.contractRepository));
  const other=fixture();await other.session.read('player',account(),signal(),async()=>{});
  assert.notEqual(other.wallets[0],first);
  await Promise.all([session.dispose(),other.session.dispose()]);
  assert.ok(wallets.every(wallet=>wallet.disposed===1));
});

test('concurrent acquisition survives first caller cancellation without disposing shared wallet',async()=>{
  const pending=deferred();let creations=0,disposals=0;
  const session=createAppWalletSession({createWallet:()=>{creations++;return pending.promise;}});
  const abort=new AbortController();
  const a=session.read('player',account(),abort.signal,async()=>1);
  const b=session.read('player',account(),signal(),async()=>2);
  abort.abort();await assert.rejects(a);
  pending.resolve({dispose:async()=>{disposals++;}});
  assert.equal(await b,2);assert.equal(creations,1);assert.equal(disposals,0);
  await session.dispose();assert.equal(disposals,1);
});

test('failed acquisition clears rejection and allows recovery',async()=>{
  let calls=0,disposed=0;
  const session=createAppWalletSession({createWallet:async()=>{
    if(++calls===1)throw Error('offline');return {dispose:async()=>{disposed++;}};
  }});
  await assert.rejects(session.read('player',account(),signal(),async()=>{}));
  await session.read('player',account(),signal(),async()=>{});
  assert.equal(calls,2);await session.dispose();assert.equal(disposed,1);
});

test('disposal during initialization rejects borrowers and disposes late creation exactly once',async()=>{
  const pending=deferred();let disposed=0,published=0;
  const session=createAppWalletSession({createWallet:()=>pending.promise,retirementMs:5});
  const read=session.read('player',account(),signal(),async()=>{published++;});
  const rejected=assert.rejects(read);
  await tick();await session.dispose();await rejected;
  pending.resolve({dispose:async()=>{disposed++;}});await tick();
  assert.equal(disposed,1);assert.equal(published,0);
});

test('owner acquisition deadline retires late creation and prevents overlapping replacement',async()=>{
  const pending=deferred();let calls=0,disposed=0;
  const session=createAppWalletSession({acquisitionMs:5,retirementMs:5,createWallet:()=>{calls++;return pending.promise;}});
  await assert.rejects(session.read('player',account(),signal(),async()=>{}));
  await assert.rejects(session.read('player',account(),signal(),async()=>{}));assert.equal(calls,1);
  pending.resolve({dispose:async()=>{disposed++;}});await tick();assert.equal(disposed,1);await session.dispose();
});

test('A-B-A and network replacement retire before creating and reject old completion',async()=>{
  const {session,wallets}=fixture();const pending=deferred();
  const old=session.read('player',account(),signal(),async()=>pending.promise);
  const obsolete=assert.rejects(old);
  await tick();const retirement=session.retire('player');
  const replacement=session.read('player',account('b'),signal(),async()=>{});
  await tick();assert.equal(wallets.length,1);
  pending.resolve('obsolete');await obsolete;await retirement;await replacement;
  assert.equal(wallets[0].disposed,1);
  await session.read('player',account(),signal(),async()=>{});
  await session.read('player',account('a','mutinynet'),signal(),async()=>{});
  assert.equal(wallets.length,4);assert.ok(wallets.slice(0,3).every(w=>w.disposed===1));await session.dispose();
});

test('uncertain cleanup quarantines replacement but retirement is bounded',async()=>{
  let calls=0;
  const session=createAppWalletSession({retirementMs:5,createWallet:async()=>{calls++;return {dispose:()=>new Promise(()=>{})};}});
  await session.read('player',account(),signal(),async()=>{});
  await assert.rejects(session.retire('player'));
  await assert.rejects(session.sign('player',account('b'),signal(),async()=>{}));
  assert.equal(calls,1);await session.dispose();
});

test('simultaneous two-role mutations always acquire Player then Game without deadlock',async()=>{
  const {session,wallets}=fixture();let active=0,max=0;
  await Promise.all(Array.from({length:5},()=>session.signBoth({player:account(),game:account('game')},signal(),async pair=>{
    max=Math.max(max,++active);assert.notEqual(pair.player,pair.game);await tick();active--;
  })));
  assert.equal(max,1);assert.equal(wallets.length,2);await session.dispose();
});
