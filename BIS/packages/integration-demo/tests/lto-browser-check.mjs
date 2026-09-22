import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(process.env.BIS_PLAYWRIGHT_PACKAGE || import.meta.url);
const {chromium}=require('playwright');const browser=await chromium.launch({headless:true,...(process.env.BIS_PLAYWRIGHT_CHANNEL?{channel:process.env.BIS_PLAYWRIGHT_CHANNEL}:{})});
const url=new URL('/tests/lto-browser-fixture.html',process.env.BIS_DEMO_URL || 'http://127.0.0.1:5174/').href;
const errors=[];
async function fixture(){const context=await browser.newContext();await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(url).origin?route.continue():route.abort());const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.getByRole('button',{name:'Start LTO',exact:true}).waitFor();return {context,page};}
const button=(page,name)=>page.getByRole('button',{name,exact:true});
const clickButton=(page,name)=>button(page,name).click({force:true});
const dblClickButton=(page,name)=>button(page,name).dblclick({force:true});
async function event(page,fragment){await page.waitForFunction(value=>document.querySelector('[aria-label="Fixture events"]')?.value.includes(value)===true,fragment);}
async function entries(page){return JSON.parse(await page.getByLabel('Fixture events').inputValue());}
async function noContractRows(page){await page.waitForFunction(()=>document.querySelectorAll('.bis-collection-item').length===0);}
async function contractRows(page,count){await page.waitForFunction(value=>document.querySelectorAll('.bis-collection-item').length<=value,count);}
try{
 {
  const {context,page}=await fixture();await clickButton(page,'Hold contract reads');await clickButton(page,'Refresh Contracts');
  assert.equal(await button(page,'Release contract reads').isVisible(),true);
  await clickButton(page,'Release contract reads');await page.waitForFunction(()=>!document.querySelector('.bis-pending-dialog'));await context.close();
 }
 {
  // Two actual tabs share IndexedDB and Web Locks, but keep separate host sessions.
  const {context,page}=await fixture();
  const other=await context.newPage();other.on('pageerror',e=>errors.push(e.message));
  await other.goto(url);await button(other,'Start LTO').waitFor();
  await clickButton(page,'Hold operations');await clickButton(page,'Start LTO');await event(page,'Offer funding pending');
  await clickButton(other,'Start LTO');await other.waitForTimeout(1500);
  assert.equal((await entries(other)).filter(e=>e.submission==='fund').length,0);
  await clickButton(page,'Complete operation');await page.waitForTimeout(2500);
  assert.equal((await entries(page)).filter(e=>e.submission==='fund').length,1);
  assert.equal((await entries(other)).filter(e=>e.submission).length,0);
  await context.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS: D.P.2 pending contract-read recovery and cooperating browser tabs. No live funds or external requests.');
}finally{await browser.close();}
