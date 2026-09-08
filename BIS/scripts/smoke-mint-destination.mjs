import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.SMOKE_CHROMIUM_EXECUTABLE});
const page=await browser.newPage({viewport:{width:1100,height:900}});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const base=process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:5174';
const mint=()=>page.getByRole('button',{name:'Mint',exact:true});
async function until(check,message){for(let i=0;i<100;i++){if(await check())return;await new Promise(r=>setTimeout(r,40));}throw Error(message);}
async function open(query=''){
  await page.goto(`${base}/tests/mint-destination.html${query}`);
  await page.getByRole('button',{name:'Open Mint Asset'}).click();
  await until(async()=>!(await page.locator('#mint-message').innerText()).includes('Checking destination'),'destination did not load');
}
try {
  await open();
  assert.equal(await page.getByLabel('Destination',{exact:true}).inputValue(),'game');
  await page.getByRole('button',{name:'Achievement: Level 2',exact:true}).click();
  const name=await page.getByLabel('Name *',{exact:true}).inputValue();
  await page.getByLabel('Destination',{exact:true}).focus();
  await page.keyboard.press('Home');await page.keyboard.press('Enter');
  await until(async()=>!(await mint().isDisabled()),'player mint not enabled');
  assert.equal(await page.getByLabel('Destination',{exact:true}).inputValue(),'player');
  assert.equal(await page.getByLabel('Name *',{exact:true}).inputValue(),name);
  await page.setViewportSize({width:390,height:650});
  const bounds=await page.locator('dialog').boundingBox();assert.ok(bounds.x>=0&&bounds.width<=390);
  const output=new URL('../../output/playwright/',import.meta.url);await mkdir(output,{recursive:true});
  await page.screenshot({path:fileURLToPath(new URL('mint-destination-mobile.png',output))});
  await mint().click();await page.getByRole('button',{name:'Done',exact:true}).waitFor();
  const player=await page.evaluate(()=>window.mintFixture.calls);
  assert.equal(player.length,1);assert.equal(player[0].destination,'player');assert.equal(player[0].request.name,name);
  await page.getByRole('button',{name:'Done',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Open Mint Asset'}).evaluate(el=>el===document.activeElement),true);
  await open();await mint().click();await page.getByRole('button',{name:'Done',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.mintFixture.calls[0].destination),'game');

  for(const missing of ['player','game','both']){
    await open(`?missing=${missing}`);
    for(const destination of ['player','game']){
      await page.getByLabel('Destination',{exact:true}).selectOption(destination);
      await until(async()=>!(await page.locator('#mint-message').innerText()).includes('Checking destination'),'lookup pending');
      assert.equal(await mint().isDisabled(),missing===destination||missing==='both', `missing=${missing}, destination=${destination}, message=${await page.locator('#mint-message').innerText()}`);
    }
  }
  await open('?low=game');assert.equal(await mint().isDisabled(),false);
  await mint().click();await page.getByRole('button',{name:'Done',exact:true}).waitFor();
  await open('?funds=insufficient');assert.equal(await mint().isDisabled(),false);
  await mint().click();
  await until(async()=>(await page.locator('#mint-message').innerText()).includes('Insufficient eligible funds'),'production error missing');
  assert.equal(await page.evaluate(()=>window.mintFixture.calls.length),0);
  await open('?lookup=error');assert.equal(await mint().isDisabled(),true);
  assert.match(await page.locator('#mint-message').innerText(),/lookup failed/);

  await page.goto(`${base}/tests/mint-destination.html?lookup=held`);
  await page.getByRole('button',{name:'Open Mint Asset'}).click();
  await until(async()=>(await page.locator('#mint-message').innerText()).includes('Checking destination'),'lookup not held');
  await page.getByLabel('Destination',{exact:true}).selectOption('player');
  await until(async()=>!(await mint().isDisabled()),'independent player lookup blocked');
  await page.evaluate(()=>window.mintFixture.release());
  assert.equal(await page.getByLabel('Destination',{exact:true}).inputValue(),'player');
  await mint().click();await page.getByRole('button',{name:'Done',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.mintFixture.calls[0].destination),'player');

  await open('?recovery=both&low=game');
  await page.getByLabel('Destination',{exact:true}).selectOption('player');
  await page.getByRole('button',{name:'Resume pending mint'}).click();
  assert.equal(await page.getByLabel('Destination',{exact:true}).isDisabled(),true);
  assert.equal(await page.getByLabel('Name *',{exact:true}).inputValue(),'Pending player');
  await page.getByRole('button',{name:'Check mint status'}).click();
  await page.getByRole('button',{name:'Done',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.mintFixture.calls[0].request.operationId),'pending-player');
  await page.getByRole('button',{name:'Done',exact:true}).click();
  await page.getByRole('button',{name:'Open Mint Asset'}).click();
  await page.getByRole('button',{name:'Resume pending mint'}).click();
  await page.getByRole('button',{name:'Check mint status'}).click();
  await page.getByRole('button',{name:'Done',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.mintFixture.calls[1].request.operationId),'pending-game');

  await open('?held');await mint().click();
  assert.equal(await page.getByLabel('Destination',{exact:true}).isDisabled(),true);
  await page.evaluate(()=>window.mintFixture.replace());await page.evaluate(()=>window.mintFixture.release());
  await until(async()=>(await page.locator('#mint-message').innerText()).includes('wallet changed'),'replacement not rejected');
  assert.equal(await page.getByRole('button',{name:'Done',exact:true}).count(),0);
  assert.equal(await page.evaluate(()=>window.mintFixture.logs.length),1);

  await open('?unknown');await mint().click();
  await page.getByRole('button',{name:'Check mint status'}).waitFor();
  assert.equal(await page.getByLabel('Destination',{exact:true}).isDisabled(),true);
  await page.getByRole('button',{name:'Check mint status'}).click();
  const retries=await page.evaluate(()=>window.mintFixture.calls);
  assert.equal(retries.length,2);assert.deepEqual(retries[0],retries[1]);

  await page.goto(base);
  await page.getByRole('button',{name:/B1/}).waitFor();
  assert.match(await page.getByRole('button',{name:/B1/}).innerText(),/\(Player->Game\)$/);
  assert.match(await page.getByRole('button',{name:/F3\. Send/}).innerText(),/^F3\. Send 1000 Sats \(Game->Player\)/);
  assert.deepEqual(errors,[]);
  console.log('PASS: destination routing, keyboard/mobile, wallet availability, pending recovery, account replacement, retry identity, focus restoration and B1/F3 labels. Isolated wallet callbacks; no live mints.');
} finally {await browser.close();}
