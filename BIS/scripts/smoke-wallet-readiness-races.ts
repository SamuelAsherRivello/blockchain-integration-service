import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

export async function verifyWalletReadinessRaces(page,base='http://127.0.0.1:5174'){
 const errors=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(15000);
 const url=`${base}/admin/tests/client/continue-host.html`;
 const pay=page.getByRole('button',{name:/B\.P\.1\. .*Pay 1000 Sats To Continue/});
 const enabled=()=>page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.getAttribute('aria-label')?.includes('B.P.1')&&!b.disabled));
 await page.goto(url);await enabled();await page.selectOption('#outcome','succeeded');
 await page.evaluate(()=>window.readinessProbe.arm());await pay.click();
 await page.waitForFunction(()=>window.readinessProbe.count()>0);
 await page.evaluate(()=>window.readinessProbe.bump());
 await pay.dispatchEvent('click');
 assert.equal(await page.locator('#calls').innerText(),'Submissions: 0');
 await page.evaluate(()=>window.readinessProbe.release());
 await page.waitForFunction(()=>document.querySelector('#calls').textContent==='Submissions: 1');
 await page.waitForFunction(()=>document.body.textContent.includes('You sent 1000 sats (Confirmed)'));
 await page.goto(url);await enabled();await page.selectOption('#outcome','succeeded');
 await page.evaluate(()=>window.readinessProbe.arm());await pay.click();
 await page.waitForFunction(()=>window.readinessProbe.count()>0);
 await page.evaluate(()=>{window.readinessProbe.replace();window.readinessProbe.release();});
 await enabled();assert.equal(await page.locator('#calls').innerText(),'Submissions: 0');
 // A fresh gesture after replacement can prepare and submit normally.
 await pay.click();await page.waitForFunction(()=>document.querySelector('#calls').textContent==='Submissions: 1');
 await page.goto(url);await enabled();await page.selectOption('#outcome','succeeded');
 await page.evaluate(()=>window.readinessProbe.arm());await pay.click();
 await page.waitForFunction(()=>window.readinessProbe.count()>0);
 await page.evaluate(()=>{window.readinessProbe.bump();window.readinessProbe.unavailable(true);window.readinessProbe.release();});
 await page.waitForFunction(()=>document.body.textContent.includes('Balance unavailable'));
 assert.equal(await page.locator('#calls').innerText(),'Submissions: 0');
 await page.evaluate(()=>window.readinessProbe.unavailable(false));await enabled();
 await pay.click();await page.waitForFunction(()=>document.querySelector('#calls').textContent==='Submissions: 1');
 await page.goto(`${base}/admin/tests/client/wallet-race-host.html`);
 await page.getByRole('button',{name:'Run refresh race'}).click();
 await page.waitForFunction(()=>document.querySelector('#result').textContent.startsWith('PASS:'));
 for(const at of ['balance','recipient']){
  await page.goto(`${base}/marketplace/tests/client/checkout-session-host.html`);
  await page.selectOption('#pause',at);await page.getByRole('button',{name:'Prepare purchase'}).click();
  await page.waitForFunction(()=>document.querySelector('#result').textContent==='Read paused');
  await page.getByRole('button',{name:'Replace Game Wallet'}).click();await page.getByRole('button',{name:'Complete old read'}).click();
  await page.waitForFunction(()=>document.querySelector('#result').textContent.startsWith('PASS:'));
  assert.equal(await page.locator('#calls').innerText(),'Submissions: 0; journals: 0');
 }
 assert.deepEqual(errors,[]);
 return 'PASS: Admin overlapping readiness, duplicate gesture, replacement/retry; ready Game Wallet ignores stale conflict; Marketplace stale balance/recipient reads create no journals or submissions.';
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const browser=await chromium.launch({headless:true,executablePath:process.env.SMOKE_CHROMIUM_EXECUTABLE});
 try{console.log(await verifyWalletReadinessRaces(await browser.newPage(),process.argv[2]));}finally{await browser.close();}
}
