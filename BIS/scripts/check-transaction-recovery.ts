import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser=await chromium.launch({headless:true});
await mkdir('output/playwright',{recursive:true});
try {
  const page=await browser.newPage({viewport:{width:420,height:800}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.setDefaultTimeout(10000);
  const base=process.env.RECOVERY_TEST_URL ?? 'http://127.0.0.1:5191';
  await page.goto(`${base}/tests/transaction-recovery.html`);
  await page.getByRole('button',{name:'Accounts Details',exact:true}).click();
  await page.getByRole('button',{name:'Transactions',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.bis-transaction-row').length===3);
  await page.getByRole('button',{name:/Send Balance/}).click();
  const report=page.getByRole('textbox',{name:'Transaction',exact:true});
  assert.match(await report.inputValue(),/send:one/);
  assert.doesNotMatch(await report.inputValue(),/transfer:draft|burn:unknown/);
  assert.deepEqual(await page.locator('.bis-transaction-back button').allTextContents(),['View Recovery Info','Open On Explorer','Back']);
  await page.evaluate(()=>{window.recoveryWindowCalls=0;window.open=()=>{window.recoveryWindowCalls++;return null;};});
  await page.getByRole('button',{name:'View Recovery Info',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Recovery Info',exact:true});
  await dialog.waitFor();
  assert.equal(await page.evaluate(()=>window.recoveryWindowCalls),0);
  assert.equal(page.context().pages().length,1);
  assert.deepEqual(await dialog.locator('.bis-actions button').allTextContents(),['Back']);
  const recovery=dialog.getByRole('textbox',{name:'Recovery Info',exact:true});
  assert.match(await recovery.inputValue(),/send:one/);
  assert.doesNotMatch(await recovery.inputValue(),/transfer:draft|burn:unknown/);
  assert.equal(await page.locator('.bis-card[inert]').count(),1);
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedReport=text;}}}));
  await dialog.getByRole('button',{name:'Copy Recovery Info',exact:true}).click();
  await page.waitForFunction(()=>!!window.copiedReport);
  assert.equal(await page.evaluate(()=>window.copiedReport),await recovery.inputValue());
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('denied');}}}));
  await dialog.locator('.bis-copy-field-heading button').click();
  await dialog.getByText('Could not copy. Select the text and copy it manually.').waitFor();
  assert.equal(await recovery.getAttribute('readonly'),'');
  for(const width of [360,280]) {
    await page.locator('#host').evaluate((el,width)=>el.style.width=width+'px',width);
    assert.equal(await dialog.evaluate(el=>el.scrollHeight<=el.clientHeight+1 && el.scrollWidth<=el.clientWidth+1),true,'dialog card must not overflow');
  }
  await dialog.screenshot({path:'output/playwright/recovery-info.png'});
  await dialog.getByRole('button',{name:'Back',exact:true}).focus();
  await page.keyboard.press('Tab');
  assert.equal(await dialog.getByRole('button',{name:'Copy Recovery Info',exact:true}).evaluate(el=>el===document.activeElement),true);
  await dialog.getByRole('button',{name:'Back',exact:true}).click();
  await dialog.waitFor({state:'detached'});
  assert.equal(await page.getByRole('button',{name:'View Recovery Info',exact:true}).evaluate(el=>el===document.activeElement),true);
  await page.getByRole('button',{name:'View Recovery Info',exact:true}).click();
  await page.keyboard.press('Escape');
  await dialog.waitFor({state:'detached'});
  assert.match(await report.inputValue(),/send:one/);
  assert.equal(await page.evaluate(()=>window.recoveryFixture.checks),0);
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await page.getByRole('button',{name:/Transfer/}).click();
  assert.match(await report.inputValue(),/Status: Not submitted/);
  assert.equal(await page.getByRole('button',{name:'Open On Explorer',exact:true}).isDisabled(),true);
  assert.equal(await page.getByText('Explorer unavailable:',{exact:false}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Discard unsent draft',exact:true}).count(),0);
  await page.screenshot({path:'output/playwright/transaction-recovery.png'});
  assert.equal(await page.locator('.bis-card').evaluate(el=>el.scrollHeight<=el.clientHeight+1 && el.scrollWidth<=el.clientWidth+1),true);
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await page.evaluate(()=>window.recoveryFixture.settle());
  await page.waitForFunction(()=>document.querySelectorAll('.bis-transaction-row').length===1);
  await page.getByRole('button',{name:/Send Balance/}).click();
  assert.equal(await page.getByRole('button',{name:'View Recovery Info',exact:true}).isDisabled(),true);
  assert.deepEqual(errors,[]);
  console.log('PASS: exact actions, selected recovery, in-BIS dialog, copy success/failure, Back, focus trapping, Escape, no popup, ordinary records, no status checks, compact layout.');
  if(!process.env.RECOVERY_TEST_URL) for(const fixture of ['activity-host','activity-recovery-host']) {
    await page.goto(`${base}/tests/${fixture}.html`);
    await page.locator('#run').click();
    await page.waitForFunction(()=>/^(PASS|FAIL):/.test(document.getElementById('result').textContent));
    assert.match(await page.locator('#result').textContent(),/^PASS:/);
    console.log(`PASS: ${fixture}`);
  }
} finally {await browser.close();}




