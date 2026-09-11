import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';

test('encrypted player profiles migrate, deduplicate, select explicitly, and notify other contexts', {timeout:120000}, async t => {
  const server=await createServer({configFile:false,root:process.cwd(),cacheDir:`output/tests/account-profiles-${process.pid}`,optimizeDeps:{noDiscovery:true,include:[]},server:{host:'127.0.0.1',port:0}});
  await server.listen();
  const browser=await chromium.launch({headless:true,...(process.env.BIS_PLAYWRIGHT_CHANNEL?{channel:process.env.BIS_PLAYWRIGHT_CHANNEL}:{})});
  t.after(async()=>{await browser.close();await server.close();});
  const page=await browser.newPage();
  await page.goto(new URL('/BIS/packages/integration/src/core/account-storage.ts',server.resolvedUrls.local[0]).href,{waitUntil:'domcontentloaded',timeout:10000});
  const result=await page.evaluate(async()=>{
    const dbName='bis-account-signet-v1';
    const deleteDb=()=>new Promise((resolve,reject)=>{const r=indexedDB.deleteDatabase(dbName);r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('database deletion blocked'));});
    const putLegacy=async account=>{
      const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
      const iv=crypto.getRandomValues(new Uint8Array(12));
      const aad=new TextEncoder().encode('bis:signet:account:v1');
      const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},key,new TextEncoder().encode(JSON.stringify(account)));
      await new Promise((resolve,reject)=>{const open=indexedDB.open(dbName,1);open.onupgradeneeded=()=>open.result.createObjectStore('account');open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('account','readwrite'),store=tx.objectStore('account');store.put(0,'generation');store.put({version:1,network:'signet',key,iv,encrypted},'identity');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});
    };
    const readKey=key=>new Promise((resolve,reject)=>{const open=indexedDB.open(dbName,2);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('account'),request=tx.objectStore('account').get(key);let value;request.onsuccess=()=>{value=request.result;};request.onerror=()=>reject(request.error);tx.oncomplete=()=>{db.close();resolve(value);};};});
    await deleteDb();
    const legacy={phrase:'legacy browser fixture',profileId:'profile-legacy'};
    await putLegacy(legacy);
    const {createAccountStorage}=await import('/BIS/packages/integration/src/core/account-storage.ts');
    const storage=createAccountStorage();
    const migrated=await storage.load();
    const afterMigration=await storage.listProfiles();
    const legacyRemoved=(await readKey('identity'))===undefined;
    const envelope=await readKey('profile:profile-legacy');
    let extractable=true;try{await crypto.subtle.exportKey('raw',envelope.key);}catch{extractable=false;}
    const second={phrase:'second browser fixture',profileId:'profile-second'};
    await storage.save(second,afterMigration.generation,new AbortController().signal);
    await storage.save(second,afterMigration.generation,new AbortController().signal);
    const deduplicated=await storage.listProfiles();
    const peer=createAccountStorage();let notifications=0;
    const offA=storage.subscribe(()=>notifications++),offB=peer.subscribe(()=>{});
    await peer.selectProfile('profile-legacy',deduplicated.generation);
    await new Promise(resolve=>setTimeout(resolve,50));
    const selected=await storage.load();offA();offB();

    await deleteDb();
    await putLegacy({phrase:'invalid browser fixture',profileId:'profile-invalid'});
    const bad=await readKey('identity');bad.network='mainnet';
    await new Promise((resolve,reject)=>{const open=indexedDB.open(dbName,2);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('account','readwrite');tx.objectStore('account').put(bad,'identity');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});
    let invalidRejected=false;try{await createAccountStorage().load();}catch{invalidRejected=true;}
    const invalidPreserved=(await readKey('identity'))!==undefined;
    await deleteDb();
    return {migrated,afterMigration,legacyRemoved,extractable,deduplicated,notifications,selected,invalidRejected,invalidPreserved};
  });
  assert.equal(result.migrated.account.profileId,'profile-legacy');
  assert.deepEqual(result.afterMigration.profiles,['profile-legacy']);
  assert.equal(result.afterMigration.activeProfileId,'profile-legacy');
  assert.equal(result.legacyRemoved,true);assert.equal(result.extractable,false);
  assert.deepEqual(result.deduplicated.profiles,['profile-legacy','profile-second']);
  assert.equal(result.deduplicated.activeProfileId,'profile-second');
  assert.ok(result.notifications>0);assert.equal(result.selected.account.profileId,'profile-legacy');
  assert.equal(result.invalidRejected,true);assert.equal(result.invalidPreserved,true);
});
