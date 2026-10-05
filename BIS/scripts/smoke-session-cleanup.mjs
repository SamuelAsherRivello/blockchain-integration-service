// Run from the repository root. Fresh browser profiles and synthetic identity only.
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});const bc=await browser.newContext();const a=await bc.newPage(),b=await bc.newPage();
try {
 await a.goto(process.argv[2] ?? 'http://127.0.0.1:5174/');
 await a.evaluate(async(sourceRoot)=>{const {createAccountStorage}=await import('/@fs/'+sourceRoot+'/BIS/packages/integration/src/core/account-storage.ts');const {createContext}=await import('/@fs/'+sourceRoot+'/BIS/packages/integration/src/core/context.ts');const storage=createAccountStorage();await storage.save({phrase:'fixture-only',profileId:'fixture-public'},0,new AbortController().signal);window.fixtureContext=createContext(storage,async()=>{throw Error('unused')},async()=> 'fixture-public');await window.fixtureContext.ready();}, process.cwd().replaceAll('\\', '/').replace(/^\/+/, ''));
 await b.goto(process.argv[2] ?? 'http://127.0.0.1:5174/');
 await b.evaluate(async(sourceRoot)=>{const {createAccountStorage}=await import('/@fs/'+sourceRoot+'/BIS/packages/integration/src/core/account-storage.ts');const {createContext}=await import('/@fs/'+sourceRoot+'/BIS/packages/integration/src/core/context.ts');const c=createContext(createAccountStorage(),async()=>{throw Error('unused')},async()=> 'fixture-public');await c.ready();window.fixtureContext=c;window.fixtureEvents=[];c.onEvent(e=>window.fixtureEvents.push(e.type));sessionStorage.setItem('bis.integration-demo.preview-scale','fixture');const remove=Storage.prototype.removeItem;window.fixtureFail=true;Storage.prototype.removeItem=function(key){if(window.fixtureFail&&this===sessionStorage&&key.startsWith('bis.'))throw Error('synthetic cleanup denial');return remove.call(this,key);};}, process.cwd().replaceAll('\\', '/').replace(/^\/+/, ''));
 await a.evaluate(async(sourceRoot)=>{const c=window.fixtureContext;c.openAccountDialog();c.openLogoutConfirmation();c.setLogoutBackupAcknowledged(true);await c.confirmLogout();});
 await b.waitForFunction(()=>window.fixtureContext.getState().phase==='error');assert.deepEqual(await b.evaluate(()=>window.fixtureEvents),[]);
 await b.evaluate(async(sourceRoot)=>{window.fixtureFail=false;await window.fixtureContext.retry();});
 assert.deepEqual(await b.evaluate(()=>window.fixtureEvents),['accountDisconnected','restartRequested']);assert.equal(await b.evaluate(()=>window.fixtureContext.getState().hasProfile),false);
 console.log('PASS receiving tab: failed session cleanup emits no restart; retry confirms cleanup then disconnects and requests restart once. Synthetic identity only.');
}finally{await browser.close();}
