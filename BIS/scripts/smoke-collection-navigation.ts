import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:5174';
const browser = await chromium.launch({headless:true,executablePath:process.env.SMOKE_CHROMIUM_EXECUTABLE});
try {
  for (const reducedMotion of ['no-preference','reduce']) {
    const page = await browser.newPage({reducedMotion});
    const errors = [];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
    await page.goto(`${base}/BIS/packages/integration-admin/tests/client/collection-navigation-host.html`);
    const items = page.getByRole('list',{name:'Owned assets'}).getByRole('button');
    await items.first().click();
    await page.getByRole('heading',{name:'Asset Detail',exact:true}).waitFor();
    // Wait past the exit animation to catch selection lost through remounts.
    await page.waitForTimeout(500);
    assert.match(await page.getByRole('textbox',{name:'Asset details',exact:true}).inputValue(),/First fixture asset/);
    await page.getByRole('button',{name:'Back',exact:true}).click();
    await page.getByRole('heading',{name:'Assets',exact:true}).waitFor();
    await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-pressed')==='true');
    await items.nth(1).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('heading',{name:'Asset Detail',exact:true}).waitFor();
    await page.waitForTimeout(500);
    assert.match(await page.getByRole('textbox',{name:'Asset details',exact:true}).inputValue(),/Second fixture asset/);
    await page.getByRole('button',{name:'Back',exact:true}).click();
    await page.getByRole('heading',{name:'Assets',exact:true}).waitFor();
    assert.equal(await items.count(),2);
    assert.deepEqual(errors,[]);
    await page.close();
  }
  console.log('PASS: asset details persist after mouse/keyboard selection and Back restores the list, with normal and reduced motion.');
} finally {
  await browser.close();
}
