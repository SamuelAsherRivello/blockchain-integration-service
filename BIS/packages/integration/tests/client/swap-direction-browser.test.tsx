import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { browserEnvironment } from '../../../../scripts/test-wallets/browser-public.ts';
import { readSwapReview, publicBoardings, readSwapState } from '../../../../scripts/test-wallets/swap.ts';

test('an Arkade-only wallet can select Bitcoin without bypassing availability, amount or review guards', {timeout:60000}, async t => {
  const fixture = `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {AccountTransferView} from '/BIS/packages/integration/src/client/ui-layer-react/AccountTransfer.tsx';
    const root=createRoot(document.getElementById('host'));
    let generation=0;
    window.mountSwap=(blocked=false,network='signet',withPending=false)=>{
      window.calls={quotes:0,confirmations:0,directions:[]};
      const context={
        getState:()=>({network}),
        getPendingAccountTransfers:()=>withPending?[{status:'pending',amountSats:100,operationId:'pending-synthetic'}]:[],checkAccountTransfer:async()=>withPending?{status:'pending',amountSats:100,operationId:'pending-synthetic'}:{status:'idle'},
        getAccountTransferAvailability:direction=>{
          window.calls.directions.push(direction);
          if(direction==='to-arkade')return Promise.resolve({available:false,reason:'insufficient-funds',message:'No eligible Bitcoin.'});
          return new Promise(resolve=>{window.finishAvailability=()=>resolve(blocked
            ?{available:false,reason:'policy-unavailable',message:'Policy unavailable.'}:{available:true});});
        },
        quoteAccountTransfer:async(amountSats,direction,destination)=>{
          window.calls.quotes++;
          window.calls.destination=destination;
          return {profileId:'synthetic',direction,amountSats,feeSats:0,netSats:amountSats,maxSats:20000,
            bitcoinAfterSats:destination?0:amountSats,arkadeAfterSats:20000-amountSats,totalAfterSats:destination?20000-amountSats:20000,...(destination?{destination}:{}),
            expiresAt:Date.now()+60000,fingerprint:'a'.repeat(64)};
        },
        confirmAccountTransfer:async()=>{window.calls.confirmations++;throw Error('No live submissions in this fixture.');},
      };
      root.render(<AccountTransferView key={++generation} context={context} balance={{status:'ready',
        availableBitcoinSats:0,availableArkadeSats:20000,availableSats:20000,bitcoinSats:0,arkadeSats:20000,totalSats:20000}} onBack={()=>{}}/>);
    };
    window.mountSwap();
  `;
  const cacheDir = `output/tests/swap-direction/vite-${process.pid}`;
  await mkdir(cacheDir, { recursive: true });
  const server=await createServer({configFile:false,root:process.cwd(),cacheDir,
    resolve:{dedupe:['react','react-dom']},optimizeDeps:{noDiscovery:true,include:['react','react-dom','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime','@arkade-os/sdk','@scure/bip39','@scure/bip39/wordlists/english.js']},
    esbuild:{jsx:'automatic'},plugins:[{
      name:'swap-direction-fixture',resolveId:id=>id==='/swap-direction-fixture.tsx'?id:undefined,
      load:id=>id==='/swap-direction-fixture.tsx'?fixture:undefined,
      configureServer(server){server.middlewares.use('/swap-direction-fixture.html',(_req,res)=>{
        res.setHeader('Content-Type','text/html');res.end('<link rel="icon" href="data:,"><div id="host"></div><script type="module" src="/swap-direction-fixture.tsx"></script>');
      });},
    }],server:{host:'127.0.0.1',port:0,hmr:false,watch:{ignored:['**/output/**']}}});
  await server.listen();t.after(()=>server.close());
  const browser=await chromium.launch({headless:true,env:browserEnvironment(),...(process.env.BIS_PLAYWRIGHT_CHANNEL?{channel:process.env.BIS_PLAYWRIGHT_CHANNEL}:{})});
  t.after(()=>browser.close());const page=await browser.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  t.after(()=>{assert.deepEqual(errors,[],'synthetic Swap fixture must render without runtime errors');});
  // Only synthetic presentation state; no tracing, recordings or storage exports.
  await page.goto(new URL('/swap-direction-fixture.html',server.resolvedUrls.local[0]).href);
  await page.waitForFunction(()=>!!window.calls,undefined,{timeout:10000});
  assert.deepEqual(errors,[]);
  const toggle=page.getByRole('button',{name:'Bitcoin → Arkade. Toggle transfer direction',exact:true});
  await page.getByText('No eligible Bitcoin.',{exact:true}).waitFor();
  assert.equal(await toggle.isEnabled(),true);
  const amount=page.getByLabel('Amount (sats)',{exact:true});
  await amount.fill('50000');assert.equal(await toggle.isEnabled(),true,'an oversized amount must not trap the direction');
  await toggle.click();
  const reverse=page.getByRole('button',{name:'Arkade → Bitcoin. Toggle transfer direction',exact:true});
  await page.waitForFunction(()=>window.calls.directions.includes('to-bitcoin'));
  assert.equal(await page.getByRole('button',{name:'Review Transfer',exact:true}).isDisabled(),true,'unknown availability must block review even when direction remains selectable');
  await page.evaluate(()=>window.finishAvailability());
  await page.waitForFunction(()=>!document.querySelector('.bis-balance-direction').disabled);
  const review=page.getByRole('button',{name:'Review Transfer',exact:true});
  assert.equal(await review.isDisabled(),true,'oversized reverse amount remains blocked');
  await amount.fill('0');
  await page.getByText('Set amount above',{exact:true}).waitFor();
  assert.equal(await page.locator('.bis-field-status-line').count(),1,'Swap has one standalone field-status line');
  await page.getByRole('button',{name:'Increase amount',exact:true}).click();
  assert.equal(await amount.inputValue(),'100','Swap amount controls change by 100 sats');
  assert.equal(await review.isEnabled(),true,'a 100-sat reverse amount is available for review');
  await amount.fill('10000');assert.equal(await review.isEnabled(),true);
  await review.click();await page.getByRole('heading',{name:'Review: Arkade → Bitcoin',exact:true}).waitFor();
  assert.equal(await reverse.isDisabled(),true,'review direction is immutable');
  assert.equal(await page.evaluate(()=>window.calls.quotes),1);
  assert.equal(await page.evaluate(()=>window.calls.confirmations),0);
  assert.equal(await page.getByRole('checkbox',{name:'Fund another Bitcoin account',exact:true}).count(),0,'Swap never offers cross-account funding');
  assert.equal(await page.evaluate(()=>window.calls.destination),undefined,'reverse swaps use the current account destination');
  const reviewed=await readSwapReview(page);
  assert.equal(reviewed.amountSats,10000);assert.equal(reviewed.netSats,10000);
  assert.equal(reviewed.quoteFingerprint,'a'.repeat(64));assert.ok(reviewed.quoteExpiresAt>Date.now());
  const synthetic={version:1,id:'public-swap-1',profileId:'synthetic',network:'mutinynet',status:'pending',phase:'registered',
    bitcoinAddress:'tb1p'+'q'.repeat(58),inputs:[{txid:'c'.repeat(64),vout:0}],
    quote:{profileId:'synthetic',direction:'to-bitcoin',amountSats:10000,feeSats:0,netSats:10000,maxSats:20000,
      bitcoinAfterSats:10000,arkadeAfterSats:10000,totalAfterSats:20000,expiresAt:reviewed.quoteExpiresAt,fingerprint:reviewed.quoteFingerprint},
    extraPrivateSentinel:'synthetic-should-never-leave-projection'};
  await page.evaluate(record=>{
    localStorage.setItem('bis-mutinynet-boarding-operation-v1:synthetic',JSON.stringify(record));
    localStorage.setItem('bis-signet-boarding-operation-v1:synthetic','invalid-other-network');
  },synthetic);
  const projected=await publicBoardings(page,'synthetic','mutinynet');
  assert.equal(projected.length,1);assert.equal(projected[0].id,synthetic.id);
  assert.equal(JSON.stringify(projected).includes(synthetic.extraPrivateSentinel),false);
  await assert.rejects(publicBoardings(page,'synthetic','signet'),/swap-journal-unavailable/);
  await page.evaluate(()=>window.mountSwap(true));
  await page.getByText('No eligible Bitcoin.',{exact:true}).waitFor();await toggle.click();
  await page.waitForFunction(()=>window.calls.directions.includes('to-bitcoin'));await page.evaluate(()=>window.finishAvailability());
  await page.getByText('Policy unavailable.',{exact:true}).waitFor();await amount.fill('10000');
  assert.equal(await review.isDisabled(),true,'changing direction does not bypass failed policy');
  assert.equal(await reverse.isEnabled(),true,'the user can select another direction');
  assert.deepEqual(await page.evaluate(()=>[window.calls.quotes,window.calls.confirmations]),[0,0]);
  await page.evaluate(()=>window.mountSwap());
  await page.getByText('No eligible Bitcoin.',{exact:true}).waitFor();
  // An already queued input event can arrive after the direction click but
  // before the pending availability read disables/re-renders the amount field.
  await toggle.click();
  await page.waitForFunction(()=>window.calls.directions.includes('to-bitcoin'));
  await page.evaluate(()=>{
    const input=document.querySelector('input[aria-label="Amount (sats)"]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'10000');
    input.dispatchEvent(new Event('input',{bubbles:true}));
  });
  assert.equal(await review.isDisabled(),true,'a queued edit cannot allow review before availability');
  await page.evaluate(()=>window.finishAvailability());
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent==='Review Transfer'&&!button.disabled),undefined,{timeout:3000});
  assert.equal(await amount.inputValue(),'10000','queued amount is retained');
  assert.equal(await review.isEnabled(),true,'editing must not discard the independent availability result');
  assert.deepEqual(await page.evaluate(()=>[window.calls.quotes,window.calls.confirmations]),[0,0]);
  await page.evaluate(()=>window.mountSwap(false,'signet',true));
  await page.getByText('See Transactions for any pending transfers.',{exact:true}).waitFor();
  assert.equal(await page.locator('.bis-field-status-line').count(),1,'pending Swap still has exactly one status line');
  // Public projection must not read arbitrary text, form values or storage.
  await page.evaluate(()=>{
    const host=document.getElementById('host');host.className='bis-card';
    const heading=document.createElement('h2');heading.textContent='Swap';host.prepend(heading);
    const status=document.createElement('p');status.className='bis-transfer-status';
    status.textContent='Operator policy verification is unavailable. private-synthetic-sentinel';host.append(status);
  });
  const state=await readSwapState(page);
  assert.equal(state.direction,'to-bitcoin');assert.equal(state.reviewEnabled,true);
  assert.equal(state.availability,'policy-unavailable');assert.equal(JSON.stringify(state).includes('private-synthetic-sentinel'),false);
});


