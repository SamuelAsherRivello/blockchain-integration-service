import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { validRecovery, wordValidity, phraseWords } from '../../src/client/state-layer-core/recovery-validation.ts';
import { identify, restoreAccount, withTemporaryWallet } from '../../src/client/wallet-layer-arkade/account.ts';
import { createContext, getControls } from '../../src/client/state-layer-core/context.ts';

const fresh=()=>generateMnemonic(wordlist);
const deferred=()=>{let resolve; const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(connect) {
  let account=null,generation=0,saves=0,calls=0;const profiles=[];
  const listeners=new Set();
  const phrase=fresh();
  const storage={
    load:async()=>({account,generation}),
    save:async(a,g,signal)=>{signal.throwIfAborted();if(g!==generation||account)throw Error('conflict');account=a;if(!profiles.includes(a.profileId))profiles.push(a.profileId);saves++;},
    listProfiles:async()=>({profiles:[...profiles]}),
    reset:async()=>{generation++;account=null;for(const l of listeners)l();},
    subscribe:l=>{listeners.add(l);return()=>listeners.delete(l);},
  };
  const context=createContext(storage,undefined,async()=> 'public-test-id',async(input,signal)=>{
    calls++; if(connect)await connect(signal); return {phrase:input,profileId:'public-test-id'};
  });
  const events=[];context.onEvent(e=>events.push(e));
  const open=async()=>{await context.readyAsync();context.openRestoreAccount();};
  return {context,storage,phrase,events,open,saves:()=>saves,calls:()=>calls,confirm:()=>getControls(context).confirmRestoration(),notify(){for(const listener of listeners)listener();},replace(){generation++;account={phrase:fresh(),profileId:'public-test-id'};if(!profiles.includes('public-test-id'))profiles.push('public-test-id');for(const l of listeners)l();}};
}
test('word membership, twelve words, normalization and full checksum',()=>{
  const phrase=fresh();
  assert.ok(validRecovery(phrase));assert.ok(validRecovery('  '+phrase.toUpperCase().split(' ').join('\n')+'  '));
  assert.equal(phraseWords(phrase).length,12);
  assert.equal(wordValidity('  '),'empty');assert.equal(wordValidity('notaword'),'invalid');assert.equal(wordValidity(wordlist[0]),'valid');
  assert.equal(validRecovery(phrase.split(' ').slice(1).join(' ')),false);
  let words=phraseWords(phrase),i=0;
  do { words[11]=wordlist[i++]; } while(validRecovery(words.join(' ')));
  assert.ok(words.every(w=>wordValidity(w)==='valid'));assert.equal(validRecovery(words.join(' ')),false);
});
test('same phrase preserves public identity; invalid phrase does not contact network',async()=>{
  const phrase=fresh();assert.ok(await identify(phrase)===await identify(phrase));
  const old=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('unexpected');};
  try{await assert.rejects(restoreAccount('invalid',new AbortController().signal));assert.equal(calls,0);}finally{globalThis.fetch=old;}
});
test('restoration rejects a non-Signet operator',async()=>{
  const old=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({network:'bitcoin'}));
  try{await assert.rejects(restoreAccount(fresh(),new AbortController().signal),/Signet/);}finally{globalThis.fetch=old;}
});
test('temporary wallet disposes on success, failure, abort and late acquisition',async()=>{
  for(const fail of [false,true]){let disposals=0;const work=withTemporaryWallet(Promise.resolve({dispose:async()=>{disposals++;}}),new AbortController().signal,async()=>{if(fail)throw Error('failure');return true;});if(fail)await assert.rejects(work);else assert.equal(await work,true);assert.equal(disposals,1);}
  let disposals=0;const late=deferred(),abort=new AbortController();const work=withTemporaryWallet(late.promise,abort.signal,async()=>true);abort.abort();await assert.rejects(work);late.resolve({dispose:async()=>{disposals++;}});await tick();assert.equal(disposals,1);
  disposals=0;const hanging=deferred(),timeout=new AbortController();const waiting=withTemporaryWallet(Promise.resolve({dispose:async()=>{disposals++;}}),timeout.signal,()=>hanging.promise);await tick();timeout.abort();await assert.rejects(waiting);await tick();assert.equal(disposals,1);hanging.resolve(true);await tick();assert.equal(disposals,1);
});
test('restore saves once, publishes only public identity and survives hydration',async()=>{
  const f=fixture();await f.open();
  await Promise.all([getControls(f.context).restore(f.phrase),getControls(f.context).restore(f.phrase)]);
  assert.equal(f.saves(),0);assert.equal(f.context.getState().phase,'restore-confirmation');
  await f.confirm();
  assert.equal(f.saves(),1);assert.equal(f.calls(),1);assert.equal(f.context.getState().phase,'active');assert.equal(f.context.getState().view,'account');
  assert.deepEqual(f.events,[{type:'accountConnected',profileId:'public-test-id'}]);assert.equal(JSON.stringify(f.context.getState()).includes(f.phrase),false);assert.equal(getControls(f.context).recovery(),undefined);
  f.context.openRestoreAccount();assert.equal(f.context.getState().phase,'active');f.context.dispose();
  const next=createContext(f.storage,undefined,async()=> 'public-test-id');await next.readyAsync();assert.equal(next.getState().profileId,'public-test-id');next.dispose();
});
test('network failure remains unsaved; Retry reuses phrase; invalid submission is ignored',async()=>{
  let fails=true;const f=fixture(async()=>{if(fails)throw Error('private error');});await f.open();
  await getControls(f.context).restore('invalid');assert.equal(f.calls(),0);
  await getControls(f.context).restore(f.phrase);assert.equal(f.saves(),0);assert.equal(f.events.length,0);assert.equal(f.context.getState().phase,'restore-error');
  assert.equal(JSON.stringify(f.context.getState()).includes('private error'),false);fails=false;await f.context.retry();await f.confirm();assert.equal(f.saves(),1);f.context.dispose();
});
test('save failure and ambiguous completion reconcile without another connection',async()=>{
  for(const committed of [false,true]){
    const f=fixture();const save=f.storage.save;let first=true;
    f.storage.save=async(...args)=>{if(first){first=false;if(committed)await save(...args);throw Error('uncertain');}await save(...args);};
    await f.open();await getControls(f.context).restore(f.phrase);await f.confirm();assert.equal(f.events.length,0);
    await f.context.retry();if(f.context.getState().phase==='restore-confirmation')await f.confirm();assert.equal(f.calls(),1);assert.equal(f.saves(),1);assert.equal(f.events.length,1);f.context.dispose();
  }
});
test('storage notification during restore save cannot restart hydration',async()=>{
  const f=fixture();
  const save=f.storage.save;
  f.storage.save=async(...args)=>{await save(...args);f.notify();};
  await f.open();
  await getControls(f.context).restore(f.phrase);await f.confirm();
  assert.equal(f.context.getState().phase,'active');
  assert.equal(f.context.getState().profileId,'public-test-id');
  f.context.dispose();
});
test('Back, disposal and concurrent account replacement invalidate delayed restoration',async()=>{
  for(const action of ['back','dispose','replace','reset']){
    const gate=deferred(),f=fixture(()=>gate.promise);await f.open();const work=getControls(f.context).restore(f.phrase);await tick();
    if(action==='back')f.context.closeAccount();else if(action==='dispose')f.context.dispose();else if(action==='replace')f.replace();else await f.storage.reset();
    gate.resolve();await work;await f.context.readyAsync();assert.equal(f.saves(),0);assert.equal(f.events.length,0);f.context.dispose();
  }
});
test('Back is guarded while saving and cancellation cannot clobber a newer attempt',async()=>{
  const f=fixture();const save=f.storage.save,gate=deferred();f.storage.save=async(...args)=>{await gate.promise;await save(...args);};
  await f.open();const work=getControls(f.context).restore(f.phrase);await tick();const confirmation=f.confirm();await tick();f.context.closeAccount();assert.equal(f.context.getState().phase,'restore-saving');gate.resolve();await confirmation;await work;assert.equal(f.events.length,1);f.context.dispose();
});
test('deadline disposes a wallet even if address acquisition never completes',async()=>{
  let disposals=0;const pending=deferred();
  const keepAlive=setTimeout(()=>{},100);
  try{await assert.rejects(withTemporaryWallet(Promise.resolve({dispose:async()=>{disposals++;}}),new AbortController().signal,()=>pending.promise,5));await tick();assert.equal(disposals,1);}
  finally{clearTimeout(keepAlive);pending.resolve(true);}
});
test('late cancelled connection cannot clear the pending identity of a newer restore',async()=>{
  const first=deferred(),second=deferred();let calls=0;
  const f=fixture(()=>++calls===1?first.promise:second.promise);await f.open();
  const old=getControls(f.context).restore(f.phrase);await tick();f.context.closeAccount();await f.context.readyAsync();f.context.openRestoreAccount();
  const current=getControls(f.context).restore(f.phrase);await tick();first.resolve();await old;second.resolve();await current;await f.confirm();
  assert.equal(f.saves(),1);assert.equal(f.events.length,1);f.context.dispose();
});
test('switching networks hydrates its storage before the first restore',async()=>{
  let network='signet',generation=0,calls=0;
  const accounts=new Map([['signet',null],['mutinynet',null]]),profiles=new Map([['signet',[]],['mutinynet',[]]]),listeners=new Set();
  const storage={
    load:async()=>({account:accounts.get(network),generation}),
    save:async(account,expected,signal)=>{signal.throwIfAborted();assert.equal(expected,generation);assert.equal(accounts.get(network),null);accounts.set(network,account);if(!profiles.get(network).includes(account.profileId))profiles.get(network).push(account.profileId);for(const listener of listeners)listener();},
    listProfiles:async()=>({profiles:[...profiles.get(network)]}),
    subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener);},
  };
  const context=createContext(storage,undefined,async()=> 'network-test-id',async(phrase,_signal)=>{calls++;return {phrase,profileId:'network-test-id',network};},undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,{getNetwork:()=>network,selectNetwork:value=>{network=value;},requireNetworkSelection:true});
  await context.readyAsync();
  context.selectNetwork('mutinynet');
  await context.readyAsync();
  assert.equal(context.getState().network,'mutinynet');
  assert.equal(context.getState().phase,'idle');
  context.openRestoreAccount();
  await getControls(context).restore(fresh());
  await getControls(context).confirmRestoration();
  assert.equal(calls,1);
  assert.equal(context.getState().phase,'active');
  assert.equal(context.getState().network,'mutinynet');
  assert.equal(accounts.get('mutinynet')?.network,'mutinynet');
  context.dispose();
});

test('first local restore requires confirmation and Cancel saves nothing',async()=>{
  const f=fixture();await f.open();
  await getControls(f.context).restore(f.phrase);
  assert.equal(f.context.getState().phase,'restore-confirmation');assert.equal(f.saves(),0);assert.equal(f.events.length,0);
  getControls(f.context).cancelRestoration();
  assert.equal(f.context.getState().phase,'idle');assert.equal(f.saves(),0);assert.equal(f.events.length,0);assert.equal(getControls(f.context).recovery(),undefined);
  f.context.dispose();
});

test('same-network restore after logout reactivates the retained profile without confirmation',async()=>{
  const f=fixture();await f.open();
  await getControls(f.context).restore(f.phrase);await f.confirm();
  f.context.openAccountDialog();f.context.openLogoutConfirmation();await f.context.confirmLogout();
  assert.equal(f.context.getState().phase,'idle');assert.deepEqual((await f.storage.listProfiles()).profiles,['public-test-id']);
  f.context.openRestoreAccount();await getControls(f.context).restore(f.phrase);
  assert.equal(f.context.getState().phase,'active');assert.equal(f.saves(),2);assert.equal(f.events.filter(event=>event.type==='accountConnected').length,2);
  f.context.dispose();
});

test('same phrase remains a first local profile on another network after logout',async()=>{
  let network='signet',generation=0;
  const accounts=new Map([['signet',null],['mutinynet',null]]),profiles=new Map([['signet',[]],['mutinynet',[]]]),listeners=new Set();
  const storage={
    load:async()=>({account:accounts.get(network),generation}),
    save:async(account,expected,signal)=>{signal.throwIfAborted();assert.equal(expected,generation);accounts.set(network,account);if(!profiles.get(network).includes(account.profileId))profiles.get(network).push(account.profileId);},
    reset:async()=>{accounts.set(network,null);generation++;for(const listener of listeners)listener();},
    listProfiles:async()=>({profiles:[...profiles.get(network)]}),
    subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener);},
  };
  const phrase=fresh(),context=createContext(storage,undefined,async()=> 'network-test-id',async(input,_signal)=>({phrase:input,profileId:'network-test-id',network}),undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,{getNetwork:()=>network,selectNetwork:value=>{network=value;},requireNetworkSelection:true});
  await context.readyAsync();context.openRestoreAccount();await getControls(context).restore(phrase);await getControls(context).confirmRestoration();
  context.openAccountDialog();context.openLogoutConfirmation();await context.confirmLogout();
  network='mutinynet';await context.readyAsync();context.openRestoreAccount();await getControls(context).restore(phrase);
  assert.equal(context.getState().phase,'restore-confirmation');assert.deepEqual(profiles.get('signet'),['network-test-id']);assert.deepEqual(profiles.get('mutinynet'),[]);
  context.dispose();
});
