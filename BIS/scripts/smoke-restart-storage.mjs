// Run from the repository root, against development Vite, in a fresh isolated browser. No real wallet is created.
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});const page=await browser.newPage();
await page.goto(process.argv[2] ?? 'http://127.0.0.1:5174/');
const result=await page.evaluate(async(sourceRoot)=>{
 const {createAccountStorage}=await import('/@fs/'+sourceRoot+'/BIS/packages/integration/src/core/account-storage.ts');
 const {createContext}=await import('/@fs/'+sourceRoot+'/BIS/packages/integration/src/core/context.ts');
 const aStore=createAccountStorage(),bStore=createAccountStorage();
 const account={phrase:'synthetic-storage-test-only',profileId:'fixture-public-a'};
 const make=store=>createContext(store,async()=>account,async()=>account.profileId);
 const a=make(aStore),b=make(bStore);await Promise.all([a.ready(),b.ready()]);
 await aStore.save(account,(await aStore.load()).generation,new AbortController().signal);
 // New contexts hydrate the saved synthetic record; no SDK or real recovery material is used.
 a.dispose();b.dispose();const c=make(aStore),d=make(bStore);await Promise.all([c.ready(),d.ready()]);
 const events=[],other=[];c.onEvent(e=>events.push({type:e.type,id:e.type==='restartRequested'?e.logoutId:null,hasProfile:c.getState().hasProfile}));d.onEvent(e=>other.push({type:e.type,id:e.type==='restartRequested'?e.logoutId:null,hasProfile:d.getState().hasProfile}));
 localStorage.setItem('other-app','keep');sessionStorage.setItem('other-app','keep');
 c.openAccountDialog();c.openLogoutConfirmation();c.setLogoutBackupAcknowledged(true);await c.confirmLogout();
 for(let i=0;i<100&&!other.some(e=>e.type==='restartRequested');i++)await new Promise(r=>setTimeout(r,20));
 const record=await aStore.load();const fresh=make(createAccountStorage());await fresh.ready();const absent=!fresh.getState().hasProfile;fresh.dispose();
 const channel=new BroadcastChannel('bis-account-signet-v1');channel.postMessage({type:'logout',...record.logout});await new Promise(r=>setTimeout(r,100));
 const counts=[events.length,other.length];
 // Restore a synthetic profile and deliver the old notification again.
 await aStore.save(account,record.generation,new AbortController().signal);await d.ready();
 sessionStorage.setItem('bis.integration-demo.preview-scale','keep-new');channel.postMessage({type:'logout',...record.logout});await new Promise(r=>setTimeout(r,100));
 const preserved=(await aStore.load()).account?.profileId===account.profileId && sessionStorage.getItem('bis.integration-demo.preview-scale')==='keep-new';
 const unrelated=localStorage.getItem('other-app')==='keep'&&sessionStorage.getItem('other-app')==='keep';
 channel.close();c.dispose();d.dispose();return {events,other:other.slice(0,2),counts,absent,preserved,unrelated,generation:record.generation};
}, process.cwd().replaceAll('\\', '/').replace(/^\/+/, ''));
assert.deepEqual(result.events.map(e=>e.type),['accountDisconnected','restartRequested']);assert.deepEqual(result.other.map(e=>e.type),['accountDisconnected','restartRequested']);assert.ok(result.events.every(e=>!e.hasProfile));assert.ok(result.other.every(e=>!e.hasProfile));assert.equal(result.events[1].id,result.other[1].id);assert.deepEqual(result.counts,[2,2]);assert.ok(result.absent&&result.preserved&&result.unrelated);assert.equal(result.generation,1);console.log('PASS real IndexedDB + BroadcastChannel with synthetic identity: cleanup, memory invalidation, equal restart IDs, duplicate/stale notification protection, fresh context, unrelated storage preserved.');await browser.close();
