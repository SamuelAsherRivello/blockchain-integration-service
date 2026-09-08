// Real Admin and production BIS UI with the existing isolated B1 adapter fixture.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.SMOKE_CHROMIUM_EXECUTABLE});
try {
 const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.argv[2] ?? 'http://127.0.0.1:5186/tests/continue-host.html');
 const pay=page.getByRole('button',{name:'B1 "Pay 1000 Sats To Coninue"',exact:true});await pay.waitFor();
 await page.selectOption('#outcome','pending');await pay.click();assert.equal(await pay.isDisabled(),true);
 await page.waitForFunction(()=>document.querySelector('#calls')?.textContent==='Submissions: 1');
 assert.equal(await page.locator('#calls').innerText(),'Submissions: 1');
 assert.equal(await page.locator('.bis-toast-text').count(),0);
 await page.selectOption('#outcome','succeeded');
 const toast=page.locator('.bis-toast-text');await page.locator('.bis-toast[data-phase="visible"]').waitFor();assert.equal(await toast.innerText(),'User paid 1000 sats to continue');
 assert.equal(await page.locator('#calls').innerText(),'Submissions: 1');
 const inside=await toast.evaluate(el=>{const t=el.getBoundingClientRect(),r=document.querySelector('.runtime-preview')?.getBoundingClientRect()??el.closest('.bis-runtime').getBoundingClientRect();return t.left>=r.left&&t.right<=r.right&&t.top>=r.top&&t.bottom<=r.bottom;});assert.ok(inside);
 const bolt=page.locator('.bis-toast-lightning');assert.equal(await bolt.innerText(),'⚡');
 assert.ok((await bolt.boundingBox()).x+(await bolt.boundingBox()).width <= (await toast.boundingBox()).x);
 const output=new URL('../../output/playwright/',import.meta.url);await mkdir(output,{recursive:true});await page.screenshot({path:fileURLToPath(new URL('b1-admin-toast.png',output))});
 assert.deepEqual(errors,[]);console.log('PASS exact quoted B1 button, pending disables repeat payment, confirmed success shows one production toast in Runtime Preview; isolated adapter, no live payment.');
} finally {await browser.close();}
