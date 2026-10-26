import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {developmentConfig} from './dev-config.ts';

test('deterministic network replacement cannot redirect an original contract or mutate either journal',async t=>{
  const config=developmentConfig({port:0});config.cacheDir='output/vite-cache/treasure-network-replacement';config.server.hmr=false;
  const server=await createServer(config);let browser;
  try{
    await server.listen();browser=await chromium.launch({headless:true});
    for(const network of ['signet','mutinynet'] as const){
      const context=await browser.newContext();const page=await context.newPage();
      try{
        await page.goto(new URL('/integration/',server.resolvedUrls!.local[0]).href,{waitUntil:'domcontentloaded'});
        const remoteRequests=[];
        await page.route('https://**',route=>{remoteRequests.push(route.request().url());return route.abort();});
        const result=await page.evaluate(async network=>{
          const {exerciseDeterministicNetworkReplacement}=await import('/BIS/scripts/treasure-network-replacement-fixture.ts');
          return exerciseDeterministicNetworkReplacement(network);
        },network);
        assert.equal(result.originalNetwork,network);
        for(const [name,value] of Object.entries(result.assertions))assert.equal(value,true,name);
        assert.deepEqual(remoteRequests,[],'fixture must never call a remote wallet/provider');
        // A reused populated context must fail before changing either journal.
        await assert.rejects(page.evaluate(async network=>{
          const {exerciseDeterministicNetworkReplacement}=await import('/BIS/scripts/treasure-network-replacement-fixture.ts');
          return exerciseDeterministicNetworkReplacement(network);
        },network),/requires-empty-storage/);
        t.diagnostic(JSON.stringify(result));
      }finally{await context.close();}
    }
  }finally{await browser?.close();await server.close();}
});
