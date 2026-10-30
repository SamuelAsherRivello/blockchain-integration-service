import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';

const origin = process.env.PROTOTYPE_SANDBOX_URL ?? 'http://127.0.0.1:5174';

test('sidebar follows its responsive width while Events and payment content remain beside it', { timeout: 60000 }, async t => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const screenshots = new URL('../../../../output/screenshots/sandbox-responsive/', import.meta.url);
  await mkdir(screenshots, { recursive: true });
  for (const route of ['demo-21', 'demo-4', 'setup']) {
    await page.goto(`${origin}/prototype-sandbox/${route}/`);
    for (const width of [1440, 930, 761, 740, 640, 500, 420]) {
      await page.setViewportSize({ width, height: 900 });
      const rail = await page.getByRole('navigation').boundingBox();
      const main = await page.locator('.sandbox-main-content').boundingBox();
      const railWidth = width <= 480 ? 144 : width <= 760 ? 180 : 232;
      assert.equal(rail?.width, railWidth, `${route} at ${width}: responsive sidebar`);
      assert.equal(main?.x, railWidth, `${route} at ${width}: content remains beside sidebar`);
      assert.equal(main?.y, rail?.y, `${route} at ${width}: no stacked navigation`);
      assert.equal(main?.width, width - railWidth, `${route} at ${width}: flexible content`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route} at ${width}: no page overflow`);
      if (route === 'demo-21' && [1440, 740].includes(width)) {
        await page.screenshot({ path: new URL(`events-${width}.png`, screenshots).pathname.replace(/^\/(\w:)/, '$1') });
      }
    }
  }
});
