import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {developmentConfig} from '../../../../scripts/dev-config.ts';
test('read-only Admin failure feedback does not restart boarding polling on parent renders',async()=>{
  const config=developmentConfig({port:0});config.cacheDir='output/vite-cache/treasure-readiness-feedback';config.server.hmr=false;
  const server=await createServer(config);let browser;
  try{
    await server.listen();browser=await chromium.launch({headless:true});const page=await browser.newPage();
    await page.goto(new URL('/BIS/packages/integration-admin/tests/fixtures/treasure-readiness.html',server.resolvedUrls!.local[0]).href);
    await page.waitForFunction(()=>window.__treasureReadiness?.reports>=1);
    await page.waitForTimeout(250);
    assert.deepEqual(await page.evaluate(()=>window.__treasureReadiness),{reads:1,reports:1},'logging must not trigger another provider read before the 15-second poll');
  }finally{await browser?.close();await server.close();}
});
