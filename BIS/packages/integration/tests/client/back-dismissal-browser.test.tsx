import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';

test('back dismissal opts out cleanly', {timeout:60000}, async t => {
  const fixture = `
    import React, {useState} from 'react';
    import {createRoot} from 'react-dom/client';
    import {flushSync} from 'react-dom';
    import {BackDismissalLayer} from '/BIS/packages/integration/src/client/ui-layer-react/BackDismissalLayer.tsx';
    import {PendingOperations, usePendingNotice} from '/BIS/packages/integration/src/client/ui-layer-react/PendingOperationDialog.tsx';
    import '/BIS/packages/integration/src/client/ui-layer-react/overlay.css';
    const listeners=new Set();
    let state={view:'account',phase:'active'}, enabled=true, pending=false, calls=0;
    const context={subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener);},getState:()=>state};
    function Notice(){usePendingNotice(pending,'Loading ...',undefined,()=>{});return null;}
    function Screen(){return <PendingOperations loadingContext={context}><Notice/><BackDismissalLayer className="bis-test-layer" enabled={enabled} onBack={()=>{calls++;}}><section className="bis-card"><h2>Test View</h2><button type="button">Inside</button></section></BackDismissalLayer></PendingOperations>;}
    const root=createRoot(document.getElementById('root'));
    window.configure=options=>flushSync(()=>{enabled=options.enabled??enabled;pending=options.pending??pending;state={view:'account',phase:'active'};for(const listener of listeners)listener();root.render(<Screen/>);});
    window.calls=()=>calls;
    root.render(<Screen/>);
  `;
  const server=await createServer({configFile:false,root:process.cwd(),cacheDir:`output/tests/back-dismissal-${process.pid}`,optimizeDeps:{noDiscovery:true,include:['react','react-dom','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime']},esbuild:{jsx:'automatic'},plugins:[{
    name:'back-dismissal-fixture',
    resolveId(id){if(id==='/back-dismissal-fixture.tsx')return id;},
    load(id){if(id==='/back-dismissal-fixture.tsx')return fixture;},
    configureServer(server){server.middlewares.use('/back-dismissal-fixture.html',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<div id="root" style="position:relative;width:400px;height:400px"></div><script type="module" src="/back-dismissal-fixture.tsx"></script>');});},
  }],server:{host:'127.0.0.1',port:0,watch:{ignored:['**/output/**']}}});
  await server.listen();t.after(()=>server.close());
  const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(new URL('/back-dismissal-fixture.html',server.resolvedUrls.local[0]).href);
  await page.waitForFunction(()=>typeof window.configure==='function',{timeout:5000}).catch(error=>{assert.deepEqual(errors,[]);throw error;});
  await page.getByRole('button',{name:'Inside'}).focus();
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>window.calls()),1);
  await page.getByRole('button',{name:'Inside'}).click();
  assert.equal(await page.evaluate(()=>window.calls()),1);
  await page.locator('.bis-test-layer').dispatchEvent('click');
  assert.equal(await page.evaluate(()=>window.calls()),2);
  await page.evaluate(()=>window.configure({enabled:false}));
  await page.keyboard.press('Escape');
  await page.locator('.bis-test-layer').dispatchEvent('click');
  assert.equal(await page.evaluate(()=>window.calls()),2);
});
