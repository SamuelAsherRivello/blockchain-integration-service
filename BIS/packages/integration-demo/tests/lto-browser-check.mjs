import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(process.env.BIS_PLAYWRIGHT_PACKAGE || import.meta.url);
const {chromium}=require('playwright');const browser=await chromium.launch({headless:true});
const url=new URL('/tests/lto-browser-fixture.html',process.env.BIS_DEMO_URL || 'http://127.0.0.1:5174/').href;
const errors=[];
async function fixture(){const context=await browser.newContext();await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(url).origin?route.continue():route.abort());const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.getByRole('button',{name:'Start LTO',exact:true}).waitFor();return {context,page};}
const button=(page,name)=>page.getByRole('button',{name,exact:true});
async function event(page,fragment){await page.waitForFunction(value=>document.querySelector('[aria-label="Fixture events"]').value.includes(value),fragment);}
async function entries(page){return JSON.parse(await page.getByLabel('Fixture events').inputValue());}
try{
 {
  const {context,page}=await fixture();await button(page,'Claim LTO').click();await event(page,'No treasure offer available');
  await button(page,'Hold operations').click();await button(page,'Start LTO').click();await event(page,'Offer funding pending');
  await page.locator('.bis-collection-item').click();assert.equal(await button(page,'Claim').isEnabled(),false);assert.equal(await button(page,'Reject').isEnabled(),false);
  await button(page,'Claim LTO').click();assert.equal((await entries(page)).filter(e=>e.submission==='claim').length,0);
  await button(page,'Complete operation').click();await event(page,'Offer funding confirmed');await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Claim').disabled);
  await button(page,'Hold operations').click();await button(page,'Claim LTO').dblclick();await event(page,'Contract claim pending');
  assert.equal((await entries(page)).filter(e=>e.submission==='claim').length,1);
  await button(page,'Complete operation').click();await event(page,'Contract claim confirmed');await page.getByText('No active contracts.').waitFor();
  assert.equal((await entries(page)).filter(e=>e.toast?.includes('claim confirmed')).length,1);await context.close();
 }
 {
  const {context,page}=await fixture();await button(page,'Start LTO').click();await event(page,'Offer funding confirmed');await page.locator('.bis-collection-item').click();
  await button(page,'Advance 91 seconds').click();await event(page,"it's expired");
  await button(page,'Claim LTO').click();assert.equal((await entries(page)).filter(e=>e.submission==='claim').length,0);
  await button(page,'Reconcile').click();await event(page,'Contract refund confirmed');await page.getByText('No active contracts.').waitFor();
  await button(page,'Claim LTO').click();await event(page,"it's expired");await context.close();
 }
 {
  const {context,page}=await fixture();await button(page,'Start LTO').click();await event(page,'Offer funding confirmed');await page.reload();
  await page.locator('.bis-collection-item').waitFor();await page.locator('.bis-collection-item').click();
  await button(page,'Reject').click();await event(page,'Contract refund confirmed');await page.getByText('No active contracts.').waitFor();await context.close();
 }
 {
  const {context,page}=await fixture();await button(page,'Start LTO').click();await event(page,'Offer funding confirmed');await page.locator('.bis-collection-item').click();
  await button(page,'Toggle unavailable read').click();await page.getByText('Contracts are unavailable. Recovery records have been retained.').waitFor();assert.equal(await button(page,'Claim').isEnabled(),false);
  await button(page,'Toggle unavailable read').click();await button(page,'Replace account').click();await page.getByText('No active contracts.').waitFor();await button(page,'Claim LTO').click();assert.equal((await entries(page)).filter(e=>e.submission==='claim').length,0);await context.close();
 }
 {
  const {context,page}=await fixture();await button(page,'Start LTO').click();await event(page,'Offer funding confirmed');
  await button(page,'Hold operations').click();await button(page,'Claim LTO').click();await event(page,'Contract claim pending');
  await button(page,'Lose acknowledgement').click();await page.locator('.bis-collection-item').click();await page.getByText('unknown',{exact:true}).waitFor();
  assert.equal(await button(page,'Claim').isEnabled(),false);assert.equal(await button(page,'Reject').isEnabled(),false);
  await button(page,'Advance 91 seconds').click();await button(page,'Reconcile').click();assert.equal((await entries(page)).filter(e=>e.submission==='refund').length,0);
  await page.reload();await page.locator('.bis-collection-item').click();await page.getByText('unknown',{exact:true}).waitFor();assert.equal(await button(page,'Claim').isEnabled(),false);await context.close();
 }
 {
  const {context,page}=await fixture();await button(page,'Start LTO').click();await event(page,'Offer funding confirmed');
  await button(page,'Switch role').click();await page.locator('.bis-collection-item').click();
  assert.equal(await button(page,'Claim').count(),0);assert.equal(await button(page,'Reject').count(),0);
  await button(page,'Refund to game').click();await event(page,'Contract refund confirmed');await page.getByText('No active contracts.').waitFor();await context.close();
 }
 {
  // Two actual tabs share IndexedDB and Web Locks, but keep separate host sessions.
  const {context,page}=await fixture();
  const other=await context.newPage();other.on('pageerror',e=>errors.push(e.message));
  await other.goto(url);await button(other,'Start LTO').waitFor();
  await button(page,'Hold operations').click();await button(page,'Start LTO').click();await event(page,'Offer funding pending');
  await button(other,'Start LTO').click();await event(other,'No treasure offer available');
  assert.equal((await entries(other)).filter(e=>e.submission==='fund').length,0);
  await button(page,'Complete operation').click();await event(page,'Offer funding confirmed');
  // Observing the first tab's contract must not attach it to the skipped second session.
  await other.locator('.bis-collection-item').waitFor();await button(other,'Claim LTO').click();await event(other,'No treasure offer available');
  assert.equal((await entries(other)).filter(e=>e.submission==='claim').length,0);
  await button(page,'Hold operations').click();await button(page,'Claim LTO').click();await event(page,'Contract claim pending');
  await other.locator('.bis-collection-item').click();await other.getByText('claiming',{exact:true}).waitFor();
  assert.equal(await button(other,'Claim').isEnabled(),false);assert.equal(await button(other,'Reject').isEnabled(),false);
  await button(page,'Complete operation').click();await event(page,'Contract claim confirmed');
  await other.getByText('No active contracts.').waitFor();
  await button(other,'Reconcile').click();await button(other,'Claim LTO').click();
  assert.equal((await entries(other)).filter(e=>e.submission).length,0);
  assert.equal((await entries(page)).filter(e=>e.submission==='fund').length,1);
  await context.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS: G2 premature/duplicate claims, pending funding/claim, expiry/refund, console/toast correlation, terminal removal, real IndexedDB reload, Reject, unavailable reads, account replacement and cooperating browser tabs. No live funds or external requests.');
}finally{await browser.close();}
