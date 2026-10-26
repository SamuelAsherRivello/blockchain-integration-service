import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {developmentConfig} from './dev-config.ts';
import {observeGameReadiness} from './treasure-acceptance-policy.ts';

test('wallet-free browser loads the actual acceptance policy under CSP without borrowing another log status',async()=>{
  const config=developmentConfig({port:0});config.cacheDir='output/vite-cache/treasure-readiness';config.server.hmr=false;
  const server=await createServer(config);let browser;
  try{
    await server.listen();browser=await chromium.launch({headless:true});const page=await browser.newPage();
    // The Integration README has no wallet application or financial fixture.
    await page.goto(new URL('/integration/',server.resolvedUrls!.local[0]).href,{waitUntil:'domcontentloaded'});
    const observed=await page.evaluate(async()=>{
      const {gameReadinessFromConsole}=await import('/BIS/scripts/treasure-acceptance-policy.ts');
      const status=value=>JSON.stringify({operation:'A.G.3 Wallet Status',status:value,availability:{status:'ready'}});
      return [gameReadinessFromConsole(status('loading')+'\n'+JSON.stringify({operation:'other',status:'ready'})),
        gameReadinessFromConsole(status('unavailable')),gameReadinessFromConsole(status('ready'))];
    });
    assert.deepEqual(observed,['loading','unavailable','ready']);
    let reads=0;
    const terminal=await observeGameReadiness(()=>page.evaluate(async status=>{
      const {gameReadinessFromConsole}=await import('/BIS/scripts/treasure-acceptance-policy.ts');
      return gameReadinessFromConsole(JSON.stringify({operation:'A.G.3 Wallet Status',status}));
    },++reads===1?'loading':'ready'),5000);
    assert.equal(terminal,'ready');assert.equal(reads,2);
  }finally{await browser?.close();await server.close();}
});
