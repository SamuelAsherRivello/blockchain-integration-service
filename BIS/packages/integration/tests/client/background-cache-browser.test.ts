import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir,mkdtemp} from 'node:fs/promises';

test('deferred warm reads are adopted by Details, Receive, Send and Swap with normal loading', {timeout:180000}, async t=>{
 const cacheRoot=new URL('../../../../../output/tests/background-caching/',import.meta.url);
 await mkdir(cacheRoot,{recursive:true});
 const cacheDir=await mkdtemp(new URL('vite-',cacheRoot));
 const server=await createServer({configFile:false,root:process.cwd(),cacheDir,optimizeDeps:{noDiscovery:true,include:['@arkade-os/sdk','react','react-dom','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime']},server:{host:'127.0.0.1',port:0,hmr:false,watch:{ignored:['**/output/**']}}});
 await server.listen();t.after(()=>server.close());
 const browser=await chromium.launch({headless:true,...(process.env.BIS_PLAYWRIGHT_CHANNEL?{channel:process.env.BIS_PLAYWRIGHT_CHANNEL}:{})});t.after(()=>browser.close());
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(new URL('/BIS/packages/integration/tests/fixtures/background-cache.html',server.resolvedUrls.local[0]).href,{timeout:180000});
 await page.waitForFunction(()=>window.cacheFixture && window.cacheFixture.context.getState().phase==='active').catch(error=>{throw new Error(`${error.message}; page errors: ${JSON.stringify(errors)}`);});
 async function warm() {
   await page.waitForFunction(()=>window.cacheFixture.warmScheduled());
   await page.evaluate(()=>window.cacheFixture.warm());
   await page.waitForFunction(()=>window.cacheFixture.counts().balances===1 && window.cacheFixture.counts().addresses===1);
 }
 await warm();
 await page.evaluate(()=>{const c=window.cacheFixture.context;c.openAccountDialog();c.openAccountDetails();});
 await page.getByRole('heading',{name:'Accounts Details',exact:true}).waitFor();
 const refresh=page.getByRole('button',{name:'Refresh Accounts Details',exact:true});
 assert.equal(await refresh.isDisabled(),true);assert.equal(await page.locator('.bis-pending-dialog').count(),0);
 assert.ok((await page.locator('input').evaluateAll(inputs=>inputs.map(i=>i.value))).includes('—'));
 await page.evaluate(()=>window.cacheFixture.balance());
 await page.waitForFunction(()=>window.cacheFixture.context.getState().balance.status==='ready');
 assert.equal(await refresh.isDisabled(),true,'address dependency still pending');
 await page.evaluate(()=>window.cacheFixture.addresses());await page.waitForFunction(()=>window.cacheFixture.context.getState().addresses.status==='ready');
 assert.equal(await refresh.isDisabled(),false);
 await page.evaluate(()=>{const c=window.cacheFixture.context;c.closeAccount();c.openAccountDetails();});
 await page.waitForTimeout(100);assert.equal(await refresh.isDisabled(),false);assert.equal(await page.locator('.bis-pending-dialog').count(),0);
 for(const view of ['Receive','Send','Transfer']) {
   await page.evaluate(()=>window.resetCacheFixture());await page.waitForFunction(()=>window.cacheFixture.context.getState().phase==='active');await warm();
   await page.evaluate(view=>{const c=window.cacheFixture.context;c.openAccountDialog();c[`openAccount${view}`]();},view);
   await page.locator('.bis-pending-dialog').waitFor({state:'visible'});
   assert.deepEqual(await page.evaluate(()=>window.cacheFixture.counts()),{balances:1,addresses:1});
   await page.evaluate(view=>view==='Receive'?window.cacheFixture.addresses():window.cacheFixture.balance(),view);
   await page.locator('.bis-pending-dialog').waitFor({state:'hidden'});
   assert.deepEqual(await page.evaluate(()=>window.cacheFixture.counts()),{balances:1,addresses:1});
 }
 assert.deepEqual(errors,[]);
});
