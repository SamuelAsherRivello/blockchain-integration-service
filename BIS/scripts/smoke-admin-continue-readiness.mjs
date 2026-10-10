// Real Admin with delayed eligibility and a memory-only payment adapter.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {verifyWalletReadinessRaces} from './smoke-wallet-readiness-races.mjs';

const browser=await chromium.launch({headless:true,executablePath:process.env.SMOKE_CHROMIUM_EXECUTABLE});
const url=process.argv[2] ?? 'http://127.0.0.1:5174/admin/tests/client/continue-host.html';
try {
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 const pay=page.getByRole('button',{name:/B\.P\.1\. .*Pay 1000 Sats To Continue/});
 const calls=page.locator('#calls');
 await page.goto(url);
 await pay.waitFor();
 await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.getAttribute('aria-label')?.includes('B.P.1')&&!button.disabled));
 await page.selectOption('#outcome','pending');
 await pay.click();
 await page.waitForFunction(()=>document.querySelector('#calls').textContent==='Submissions: 1');
 assert.equal(await pay.isDisabled(),true);
 // A second attempt while pending must not submit another payment.
 await pay.dispatchEvent('click');
 assert.equal(await calls.innerText(),'Submissions: 1');
 await page.selectOption('#outcome','succeeded');
 await page.waitForFunction(()=>document.body.textContent.includes('You sent 1000 sats (Confirmed)'));
 await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.getAttribute('aria-label')?.includes('B.P.1')&&!button.disabled));
 assert.equal(await calls.innerText(),'Submissions: 1');
 await page.selectOption('#outcome','failed');
 await pay.click();
 await page.waitForFunction(()=>document.querySelector('#calls').textContent==='Submissions: 2');
 await page.waitForFunction(()=>document.body.textContent.includes('You could not send 1000 sats (Failed)'));
 await page.selectOption('#outcome','succeeded');
 await pay.click();
 await page.waitForFunction(()=>document.querySelector('#calls').textContent==='Submissions: 3');
 await page.waitForFunction(()=>document.body.textContent.includes('You sent 1000 sats (Confirmed)'));
 await page.goto(`${url}?guest`);
 await pay.waitFor();
 assert.equal(await pay.isDisabled(),true);
 assert.equal(await calls.innerText(),'Submissions: 0');
 await page.goto(`${url}?insufficient`);
 await pay.waitFor();
 await page.waitForFunction(()=>document.body.textContent.includes('Insufficient balance'));
 assert.equal(await pay.isDisabled(),true);
 assert.equal(await calls.innerText(),'Submissions: 0');
 assert.deepEqual(errors,[]);
 console.log(await verifyWalletReadinessRaces(page,new URL(url).origin));
 console.log('PASS Admin delayed readiness: first click submits once, pending blocks duplicates, failure retries, guests and insufficient funds stay blocked.');
} finally {await browser.close();}
