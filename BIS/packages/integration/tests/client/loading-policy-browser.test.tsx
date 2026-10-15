import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';

test('account page policy blocks active, host, and retained spinners at both overlay boundaries', {timeout:60000}, async t => {
  const fixture = `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {flushSync} from 'react-dom';
    import {PendingOperations,usePendingNotice} from '/BIS/packages/integration/src/client/ui-layer-react/PendingOperationDialog.tsx';
    import {viewLoadingPolicies} from '/BIS/packages/integration/src/client/ui-layer-react/view-loading.ts';
    let state={view:'account',phase:'active',accountAssets:true};
    const listeners=new Set();
    const context={subscribe:l=>{listeners.add(l);return()=>listeners.delete(l);},getState:()=>state};
    let busy=true,host=true,error,hostMode=false,internalBusy=false;
    const hostLoading={subscribe:context.subscribe,getSnapshot:()=>host};
    function Notice({internal=false}){usePendingNotice(hostMode&&internal?internalBusy:busy,'Loading ...',error,()=>{});return <button>Account controls</button>;}
    function Screen(){return <PendingOperations loadingContext={context} hostContextNotices={hostMode}><Notice/><PendingOperations loadingContext={context} hostLoading={hostLoading}><Notice internal/></PendingOperations></PendingOperations>;}
    const root=createRoot(document.getElementById('root'));
    window.update=(page,options={})=>flushSync(()=>{
      state={view:'account',phase:'active',[page]:true};
      if('busy' in options)busy=options.busy;
      if('host' in options)host=options.host;
      error=options.error;
      for(const listener of listeners)listener();
      root.render(<Screen/>);
    });
    window.nonModalPages=Object.entries(viewLoadingPolicies).filter(([,policy])=>!policy.isLoadingModal).map(([key])=>key);
    window.hostScenario=(view,options={})=>flushSync(()=>{
      hostMode=true;
      state={view,phase:'active',accountAssets:true};
      busy=options.busy??true;host=options.host??true;internalBusy=options.internalBusy??false;error=undefined;
      for(const listener of listeners)listener();
      root.render(<Screen/>);
    });
    flushSync(()=>root.render(<Screen/>));
  `;
  const server=await createServer({configFile:false,root:process.cwd(),cacheDir:`output/tests/loading-policy-${process.pid}`,optimizeDeps:{noDiscovery:true,include:['react','react-dom','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime']},esbuild:{jsx:'automatic'},plugins:[{
    name:'loading-policy-fixture',
    resolveId(id){if(id==='/loading-policy-fixture.tsx')return id;},
    load(id){if(id==='/loading-policy-fixture.tsx')return fixture;},
    configureServer(server){server.middlewares.use('/loading-policy-fixture.html',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<div id="root"></div><script type="module" src="/loading-policy-fixture.tsx"></script>');});},
  }],server:{host:'127.0.0.1',port:0,watch:{ignored:['**/output/**']}}});
  await server.listen();
  t.after(()=>server.close());
  const browser=await chromium.launch({headless:true,...(process.env.BIS_PLAYWRIGHT_CHANNEL?{channel:process.env.BIS_PLAYWRIGHT_CHANNEL}:{})});
  t.after(()=>browser.close());
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(new URL('/loading-policy-fixture.html',server.resolvedUrls.local[0]).href);
  await page.waitForFunction(()=>typeof window.update==='function').catch(error=>{
    assert.deepEqual(errors,[],'The loading fixture must initialize without browser errors');
    throw error;
  });
  assert.deepEqual(errors,[],'The loading fixture must mount without React errors');
  const dialogs=page.getByRole('dialog',{includeHidden:true});
  await dialogs.nth(1).waitFor({state:'attached'});
  assert.equal(await dialogs.count(),2);
  for(const collection of ['accountAssets','accountContracts','accountActivity']){
    await page.evaluate(collection=>window.update(collection,{busy:true,host:true}),collection);
    assert.equal(await dialogs.count(),2);
    await page.evaluate(()=>window.update('accountDetails'));
    assert.equal(await dialogs.count(),0,`${collection} Back must hide both active spinners immediately`);
    assert.equal(await page.locator('[inert]').count(),0);
    await page.waitForTimeout(300);
    assert.equal(await dialogs.count(),0,'background reads must stay non-modal');
    await page.evaluate(collection=>window.update(collection,{busy:true,host:false}),collection);
    await page.evaluate(()=>window.update('accountDetails',{busy:false,host:false}));
    assert.equal(await dialogs.count(),0,'retained notices must not cover Details');
  }
  assert.deepEqual(await page.evaluate(()=>window.nonModalPages),['details','onboarding']);
  await page.evaluate(()=>window.update('accountOnboarding',{busy:true,host:true}));
  assert.equal(await dialogs.count(),0,'onboarding also forbids loading modals');
  await page.evaluate(()=>window.update('accountDetails',{busy:false,host:false,error:'Read failed'}));
  assert.equal(await page.getByRole('alertdialog',{includeHidden:true}).count(),2,'errors remain available');
  await page.evaluate(()=>window.update('accountDetails',{busy:false,host:false}));
  await page.waitForTimeout(300);
  await page.evaluate(()=>window.hostScenario('account-button'));
  assert.equal(await dialogs.count(),2,'host API and Marketplace notices show when BIS is closed');
  await page.evaluate(()=>window.hostScenario('account'));
  assert.equal(await dialogs.count(),0,'opening BIS immediately suppresses active and retained host notices');
  assert.equal(await page.locator('[inert]').count(),0,'host work must not disable BIS controls');
  await page.evaluate(()=>window.hostScenario('account',{internalBusy:true}));
  assert.equal(await dialogs.count(),1,'BIS own loading remains visible while host work is deferred');
  await page.evaluate(()=>window.hostScenario('account',{internalBusy:false}));
  await page.waitForTimeout(300);
  await page.evaluate(()=>window.hostScenario('account-button'));
  assert.equal(await dialogs.count(),2,'closing BIS immediately reveals unfinished host work');
  await page.evaluate(()=>window.hostScenario('account'));
  await page.evaluate(()=>window.hostScenario('account',{busy:false,host:false}));
  await page.evaluate(()=>window.hostScenario('account-button',{busy:false,host:false}));
  assert.equal(await dialogs.count(),0,'host work completed while BIS was open must never replay');
  await page.evaluate(()=>window.hostScenario('account',{busy:true,host:true}));
  assert.equal(await dialogs.count(),0,'host requests started while BIS is open stay deferred');
  await page.evaluate(()=>window.hostScenario('account-button'));
  assert.equal(await dialogs.count(),2);
  await page.evaluate(()=>window.hostScenario('account-button',{busy:false,host:false}));
  assert.equal(await dialogs.count(),0,'completed host work clears immediately');
  assert.deepEqual(errors,[]);
});
