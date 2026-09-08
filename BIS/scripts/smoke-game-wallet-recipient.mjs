import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage(),errors=[];
 page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5186/tests/continue-host.html?wallet-import');
 const pay=page.getByRole('button',{name:'B1 "Pay 1000 Sats To Continue"',exact:true});
 const panel=page.locator('.game-wallet-panel');
 await panel.getByRole('button',{name:'Import',exact:true}).click();
 assert.equal(await pay.isDisabled(),true);
 await panel.getByLabel('Recovery phrase').fill('fixture-only');
 await panel.locator('button[type="submit"]').click();
 await panel.getByRole('button',{name:'Details',exact:true}).waitFor();
 await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.includes('Pay 1000 Sats To Continue'))?.disabled);
 await page.selectOption('#outcome','succeeded');await pay.click();
 await page.waitForFunction(()=>document.querySelector('.bis-toast-text')?.textContent==='User paid 1000 sats to continue');
 const output=await page.locator('.admin-console').inputValue();
 assert.match(output,/"recipient": "tark1/);
 await page.reload();await panel.getByRole('button',{name:'Details',exact:true}).waitFor();
 await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.includes('Pay 1000 Sats To Continue'))?.disabled);
 await panel.getByRole('button',{name:'Logout',exact:true}).click();
 await panel.getByRole('button',{name:'Import',exact:true}).waitFor();
 assert.equal(await pay.isDisabled(),true);
 assert.deepEqual(errors,[]);
 console.log('PASS wallet import enables B1, payment binds the imported recipient, reload restores it, logout disables B1. No live funds.');
} finally {await browser.close();}
