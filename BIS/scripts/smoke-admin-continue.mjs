// Real Admin and production BIS UI with the existing isolated B1 adapter fixture.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.SMOKE_CHROMIUM_EXECUTABLE});
try {
 const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.setDefaultTimeout(10000);
 await page.goto(process.argv[2] ?? 'http://127.0.0.1:5186/tests/continue-host.html');
 const pay=page.getByRole('button',{name:'B1 "Pay 1000 Sats To Continue"',exact:true});await pay.waitFor();
 await page.getByRole('button',{name:'E1 Fund Signet Sats',exact:true}).waitFor();
 await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.includes('Fund Signet Sats'))?.disabled);
 await page.selectOption('#outcome','pending');await pay.click();
 await page.waitForFunction(()=>document.querySelector('#calls')?.textContent==='Submissions: 1');
 assert.equal(await pay.isDisabled(),true);
 assert.equal(await page.locator('#calls').innerText(),'Submissions: 1');
 await page.waitForFunction(()=>document.querySelector('.bis-toast-text')?.textContent==='Payment is processing…');
 await page.selectOption('#outcome','succeeded');
 const toast=page.locator('.bis-toast-text');await page.waitForFunction(()=>document.querySelector('.bis-toast-text')?.textContent==='User paid 1000 sats to continue');
 await page.locator('.bis-toast[data-phase="visible"]').waitFor();
 await page.waitForFunction(()=>{const el=document.querySelector('.bis-toast-text'),r=document.querySelector('.game-viewport')?.getBoundingClientRect(),t=el?.getBoundingClientRect();return !!t&&!!r&&t.left>=r.left&&t.right<=r.right&&t.top>=r.top&&t.bottom<=r.bottom;});
 assert.equal(await page.locator('#calls').innerText(),'Submissions: 1');
 const inside=await toast.evaluate(el=>{const t=el.getBoundingClientRect(),r=document.querySelector('.runtime-preview')?.getBoundingClientRect()??el.closest('.bis-runtime').getBoundingClientRect();return t.left>=r.left&&t.right<=r.right&&t.top>=r.top&&t.bottom<=r.bottom;});assert.ok(inside);
 const bolt=page.locator('.bis-toast-lightning');assert.equal(await bolt.innerText(),'⚡');
 assert.ok((await bolt.boundingBox()).x+(await bolt.boundingBox()).width <= (await toast.boundingBox()).x);
 const output=new URL('../../output/playwright/',import.meta.url);await mkdir(output,{recursive:true});await page.screenshot({path:fileURLToPath(new URL('b1-admin-toast.png',output))});
 await page.selectOption('#outcome','failed');await pay.click();
 await page.waitForFunction(()=>document.querySelector('.bis-toast-text')?.textContent==='Insufficient eligible spendable funds for this 1,000-sat payment. No payment was submitted.');
 assert.equal(await pay.isDisabled(),false);
 await page.goto(new URL('/tests/continue-host.html?guest',page.url()).href);
 await pay.waitFor();assert.equal(await pay.isDisabled(),true);
 assert.equal(await page.locator('#calls').innerText(),'Submissions: 0');
 assert.deepEqual(errors,[]);console.log('PASS B1 processing, success and failure toasts in Runtime Preview; guest payment disabled; isolated adapter, no live payment.');
} finally {await browser.close();}
