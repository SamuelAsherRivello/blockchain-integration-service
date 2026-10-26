import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {developmentConfig} from '../../../../scripts/dev-config.ts';
test('actual Admin retains the terminal Wallet Status when a later boarding report arrives',async()=>{
  const config=developmentConfig({port:0});config.cacheDir='output/vite-cache/treasure-readiness-console';config.server.hmr=false;
  const server=await createServer(config);let browser;
  try{
    await server.listen();browser=await chromium.launch({headless:true});const page=await browser.newPage();
    await page.goto(new URL('/BIS/packages/integration-admin/tests/fixtures/treasure-readiness-console.html',server.resolvedUrls!.local[0]).href,{waitUntil:'domcontentloaded'});
    await page.locator('.story-card').filter({hasText:'A.G.3. Board Game Wallet'}).getByRole('button',{name:'Details',exact:true}).click();
    const output=page.getByLabel('Console output',{exact:true});
    await page.waitForFunction(()=>document.querySelector('textarea[aria-label="Console output"]')?.value.includes('A.G.3 Wallet Status'));
    await page.evaluate(()=>window.__treasureConsole.failBoarding());
    await page.waitForFunction(()=>document.querySelector('textarea[aria-label="Console output"]')?.value.includes('A.G.3 Boarding Status'));
    const text=await output.inputValue();
    assert.match(text,/A\.G\.3 Wallet Status/,'background reads cannot erase the explicit Details result');
    assert.match(text,/A\.G\.3 Boarding Status/);assert.match(text,/"status": "ready"/);
    assert.equal(await page.evaluate(()=>window.__treasureConsole.refreshes),1);
  }finally{await browser?.close();await server.close();}
});
