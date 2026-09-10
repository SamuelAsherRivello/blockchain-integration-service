// Synthetic accounts only. No live wallet creation, recovery material, or financial submissions.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.SMOKE_CHROMIUM_EXECUTABLE});
try {
 const context=await browser.newContext();
 await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 const page=await context.newPage();
 await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.feedbackCopied=value;}}}));
 for(const size of [{width:743,height:1321},{width:360,height:640},{width:393,height:700}]) {
  await page.setViewportSize(size);
  await page.goto('http://127.0.0.1:5174/tests/ui-feedback-host.html');
  for(const screen of ['setup','saved','restore','account']) {
   await page.evaluate(s=>window.uiFeedback.open(s),screen);
   await page.locator('.bis-card').waitFor();
   await page.waitForTimeout(150);
   const bounds=await page.locator('.bis-card').evaluate(c=>{const r=c.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,scroll:c.scrollHeight>c.clientHeight+1};});
   assert.ok(bounds.top>=0 && bounds.bottom<=size.height && bounds.left>=0 && bounds.right<=size.width,`${screen} bounds ${JSON.stringify(bounds)}`);
   assert.equal(bounds.scroll,false,`${screen} card scroll`);
   const warning=page.locator('.bis-seed-warning');
   if(await warning.count())assert.equal(await warning.evaluate(w=>w.scrollWidth<=w.clientWidth),true,'warning fits one line');
   assert.equal(await page.getByRole('button',{name:'Copy Account ID',exact:true}).count(),0);
  }
  await page.getByRole('button',{name:'Accounts Details',exact:true}).click();
  await page.getByRole('button',{name:'Copy Account ID',exact:true}).click();
  await page.waitForFunction(()=>window.feedbackCopied==='fixture-public-account-0123456789');
  await page.getByRole('button',{name:'Transactions',exact:true}).click();
  await page.waitForTimeout(100);
  assert.equal(await page.getByRole('button',{name:'Copy Account ID',exact:true}).count(),0);
  console.log(`PASS ${size.width}x${size.height}: four screens fit at native 100%, warning, Account ID placement/full copy`);
 }
 await context.close();
} finally {await browser.close();}
