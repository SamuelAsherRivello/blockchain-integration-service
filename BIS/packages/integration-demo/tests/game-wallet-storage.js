
import {createGameWalletStorage} from '../../integration/src/core/game-wallet-storage.ts';
import {clearBrowserPreferences} from '../../integration/src/core/logout-cleanup.ts';
const assert=(value,message)=>{if(!value)throw Error(message);};
const a=createGameWalletStorage(),b=createGameWalletStorage();
try {
  let notifications=0; const unsubscribe=b.subscribe(()=>notifications++);
  const one={profileId:'synthetic-a',phrase:'synthetic-storage-only-a'};
  const two={profileId:'synthetic-b',phrase:'synthetic-storage-only-b'};
  await a.select(one);await a.select(two);await a.select(one);
  assert((await b.load()).profileId===one.profileId,'Selected wallet missing');
  clearBrowserPreferences({length:0,key:()=>null,getItem:()=>null,removeItem:()=>{throw Error('unexpected removal');}});
  assert((await b.load()).profileId===one.profileId,'Cleanup crossed wallet boundary');
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('bis-game-wallet-signet-v1');r.onsuccess=()=>resolve(r.result);r.onerror=reject;});
  const records=await new Promise((resolve,reject)=>{const r=db.transaction('wallets').objectStore('wallets').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=reject;});db.close();
  assert(records.length===3,'Duplicate identities or missing selection');
  const envelopes=records.filter(r=>r?.encrypted);
  assert(envelopes.length===2 && envelopes.every(e=>!e.key.extractable && !('phrase' in e)),'Encryption envelope invalid');
  await new Promise(resolve=>setTimeout(resolve,100));
  assert(notifications>0,'Cross-tab channel failed');unsubscribe();
  a.dispose();b.dispose();
  const reloaded=createGameWalletStorage();assert((await reloaded.load()).profileId===one.profileId,'Reload failed');reloaded.dispose();
  document.querySelector('#result').textContent='PASS: encrypted separate storage; retained identities; last selection; cleanup isolation; broadcast; reload.';
}catch{a.dispose();b.dispose();document.querySelector('#result').textContent='FAIL: game wallet storage checks';}

