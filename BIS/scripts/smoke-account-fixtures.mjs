// Existing synthetic UI fixtures only; external requests are blocked.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.SMOKE_CHROMIUM_EXECUTABLE });
const base = process.argv[2] ?? 'http://127.0.0.1:5174/';
const fixtures = ['recovery', 'restore', 'balance', 'activity', 'account-assets', 'addresses', 'receive', 'send', 'transfer', 'logout', 'pending-operation'];
let failed = false;
try {
  for (const fixture of fixtures) {
    const context = await browser.newContext();
    try {
      await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
      // Serve the fixture's metadata icon locally so image decoding is deterministic and offline.
      await context.route('https://samuelasherrivello.github.io/blockchain-integration-service/assets/achievements/v1/level-1-trophy.png', route => route.fulfill({
        path: fileURLToPath(new URL('../packages/integration-demo/public/assets/achievements/v1/level-1-trophy.png', import.meta.url)),
        contentType: 'image/png',
      }));
      const page = await context.newPage();
      await page.goto(new URL(`tests/${fixture}-host.html`, base).href);
      await page.locator('#run').click();
      await page.waitForFunction(() => /^(PASS|FAIL)/.test(document.querySelector('#result')?.textContent ?? ''), undefined, { timeout: 30000 });
      const result = await page.locator('#result').textContent();
      assert.match(result, /^PASS/, `${fixture}: ${result}`);
      console.log(`PASS ${fixture}: isolated browser fixture`);
    } catch (error) {
      failed = true;
      console.error(`FAIL ${fixture}: ${error.message}`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
process.exitCode = failed ? 1 : 0;
