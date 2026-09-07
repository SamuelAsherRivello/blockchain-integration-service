// A fresh synthetic account; no wallet, clipboard or network operations.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 276, height: 300 }, deviceScaleFactor: 2 });
  await page.goto(new URL('tests/ui-feedback-host.html', process.argv[2] ?? 'http://127.0.0.1:5174/').href);
  await page.evaluate(() => window.uiFeedback.open('account'));
  const card = page.locator('.bis-card');
  await card.waitFor();
  // At a short viewport/browser zoom, wheel or focus scrolling can move the card contents.
  for (const scroll of [6, 24, 44]) {
    await card.evaluate((element, value) => { element.scrollTop = value; }, scroll);
    const bounds = await card.evaluate(element => {
      const outer = element.getBoundingClientRect();
      const header = element.querySelector('.bis-network-label').getBoundingClientRect();
      return { top: outer.top, headerTop: header.top, headerBottom: header.bottom, bottom: outer.bottom };
    });
    assert.ok(bounds.headerTop >= bounds.top, `Account header clipped after scrolling: ${JSON.stringify(bounds)}`);
    assert.ok(bounds.headerBottom < bounds.bottom, 'Network header must remain visible');
  }
  const output = new URL('../../output/playwright/', import.meta.url);
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: fileURLToPath(new URL('account-header.png', output)) });
  console.log('PASS Account top remains intact at short viewport and scrolled positions');
} finally { await browser.close(); }
