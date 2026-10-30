import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {developmentConfig} from '../../../../scripts/dev-config.ts';
import {observeTreasureClaimFeedback} from '../../../../scripts/treasure-feedback-observation.ts';

test('Admin starts a new Browser validation offer on each selected network',async()=>{
  const config=developmentConfig({port:0});config.cacheDir='output/vite-cache/treasure-new-offer';config.server.hmr=false;
  const server=await createServer(config);let browser;
  try{
    await server.listen();browser=await chromium.launch({headless:true});
    for(const network of ['signet','mutinynet']){
      const page=await browser.newPage();
      await page.goto(new URL('/BIS/packages/integration-admin/tests/fixtures/treasure-panel.html?network='+network,server.resolvedUrls!.local[0]).href);
      assert.equal(await page.getByRole('combobox',{name:'Signing / validation solution'}).inputValue(),'browser-policy-v1');
      await page.getByRole('button',{name:'Start LTO',exact:true}).click();
      await page.waitForFunction(()=>window.__treasureUiFixture.requests.length===1);
      assert.equal(await page.evaluate(()=>window.__treasureUiFixture.requests[0].validationSolution),'browser-policy-v1');
      await page.close();
    }
  }finally{await browser?.close();await server.close();}
});

test('deterministic Admin feedback stays immediate and suppresses duplicate claims while inspection waits',async t=>{
  const config=developmentConfig({port:0});config.cacheDir='output/vite-cache/treasure-feedback';config.server.hmr=false;
  const server=await createServer(config);let browser;
  try{
    await server.listen();browser=await chromium.launch({headless:true});
    for(const width of [1280,390]){
      const page=await browser.newPage({viewport:{width,height:900}});
      await page.goto(new URL('/BIS/packages/integration-admin/tests/fixtures/treasure-panel.html',server.resolvedUrls!.local[0]).href);
      await page.getByRole('button',{name:'Start LTO',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('select')?.disabled);
      const before=await page.getByRole('button',{name:'Claim LTO',exact:true}).boundingBox();
      const observation=page.evaluate(observeTreasureClaimFeedback);
      await page.waitForFunction(()=>document.querySelector('[data-bis-feedback-observing="true"]')!==null);
      await page.evaluate(()=>{
        window.__treasureUiFixture.block=true;
        const button=[...document.querySelectorAll('button')].find(b=>b.textContent==='Claim LTO')!;
        button.click();button.click();
      });
      const claim=page.getByRole('button',{name:'Claim LTO',exact:true});
      const feedback=await observation;
      assert.equal(feedback.observed,true);assert.equal(feedback.inputReceived,true);
      assert.equal(feedback.trusted,false,'this duplicate-event fixture uses programmatic events');
      assert.ok(Number.isFinite(feedback.eventToFrameMs)&&feedback.eventToFrameMs!>=0);
      t.diagnostic(JSON.stringify({viewport:width,feedback,qualification:'deterministic UI observation only; not funded p95'}));
      await page.waitForFunction(()=>document.querySelector('button[aria-busy="true"]')!==null);
      assert.equal(await claim.isDisabled(),true);
      assert.match(await page.getByRole('status').textContent()??'',/Checking the treasure claim/);
      assert.deepEqual(await claim.boundingBox(),before,'feedback does not move the claim button');
      assert.equal(await page.evaluate(()=>window.__treasureUiFixture.logs.filter(e=>e.event==='Claim LTO').length),1);
      assert.equal(await page.evaluate(()=>window.__treasureUiFixture.claims),0,'pending inspection has not acted');
      await page.evaluate(()=>window.__treasureUiFixture.release());
      await page.waitForFunction(()=>window.__treasureUiFixture.claims===1);
      assert.equal(await page.evaluate(()=>window.__treasureUiFixture.toasts.length),0,'duplicate does not raise false unavailable feedback');
      // A passive observation with no input must expire without dispatching an
      // action, disabling the control, or leaving its instrumentation behind.
      const noInput=await page.evaluate(observeTreasureClaimFeedback);
      assert.equal(noInput.observed,false);assert.equal(noInput.inputReceived,false);
      assert.equal(noInput.eventToFrameMs,null);assert.equal(noInput.targetMet,false);
      assert.equal(await page.evaluate(()=>window.__treasureUiFixture.claims),1);
      assert.equal(await claim.isDisabled(),false);
      assert.equal(await claim.getAttribute('data-bis-feedback-observing'),null);
      // Validate the same passive observer with a normal trusted browser click.
      // The controller remains the isolated wallet-free fixture above.
      await page.getByRole('button',{name:'Start LTO',exact:true}).click();
      await page.evaluate(()=>{window.__treasureUiFixture.block=true;});
      const trustedObservation=page.evaluate(observeTreasureClaimFeedback);
      await page.waitForFunction(()=>document.querySelector('[data-bis-feedback-observing="true"]')!==null);
      await claim.click();
      const trustedFeedback=await trustedObservation;
      assert.equal(trustedFeedback.observed,true);assert.equal(trustedFeedback.trusted,true);
      assert.equal(await page.evaluate(()=>window.__treasureUiFixture.claims),1,'input acknowledgement precedes the blocked action');
      t.diagnostic(JSON.stringify({viewport:width,feedback:trustedFeedback,qualification:'trusted input on wallet-free fixture only; not funded p95'}));
      await page.evaluate(()=>window.__treasureUiFixture.release());
      await page.waitForFunction(()=>window.__treasureUiFixture.claims===2);
      await page.close();
    }
  }finally{await browser?.close();await server.close();}
});
