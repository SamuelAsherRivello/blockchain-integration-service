import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({viewport:{width:900,height:640}});
  await page.goto(`${process.env.BIS_DEMO_URL ?? 'http://127.0.0.1:5174'}/tests/collection-layout-host.html`);
  await page.getByRole('button',{name:'Run collection layout checks',exact:true}).click();
  await page.waitForFunction(()=>/^(PASS|FAIL):/.test(document.getElementById('result')?.textContent ?? ''));
  assert.match(await page.locator('#result').textContent(),/^PASS:/);
  for(const [id,count] of [['rows-0',0],['rows-1',1],['rows-2',2],['rows-5',5]]) {
    await page.getByRole('button',{name:new RegExp(`^${count} row`) }).click();
    assert.equal(await page.locator('.bis-collection-item').count(),count*3,`${count} rows across three collections`);
    const bounds=await page.locator('.bis-collection-list').evaluateAll(lists=>lists.map(list=>({height:list.getBoundingClientRect().height,overflow:getComputedStyle(list).overflowY,gutter:getComputedStyle(list).scrollbarGutter,cardHeight:list.closest('.bis-item-list').getBoundingClientRect().height,backVisible:(()=>{const card=list.closest('.bis-item-list').getBoundingClientRect(),back=list.closest('.bis-item-list').querySelector('.bis-back').getBoundingClientRect();return back.top>=card.top&&back.bottom<=card.bottom;})()})));
    assert.ok(bounds.every(value=>Math.round(value.height)===276 && Math.round(value.cardHeight)===456 && value.overflow==='scroll' && value.gutter==='stable' && value.backVisible),`${id}: ${JSON.stringify(bounds)}`);
  }
  console.log('PASS: shared collection card, list viewport, scrollbar, and row geometry across empty, short, and long lists.');
} finally { await browser.close(); }
