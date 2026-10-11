import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readLogoutCount, browserEnvironment } from './test-wallets/browser-public.mjs';

test('game pending reader uses loaded public package and fails closed without its export', { timeout: 30000 }, async t => {
  const browser = await chromium.launch({ headless: true, env: browserEnvironment() });
  t.after(() => browser.close());
  for (const available of [true, false]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const requested = [];
    await page.route('**/*', route => {
      const url = new URL(route.request().url()); requested.push(url.pathname);
      return route.fulfill({ contentType: url.pathname.endsWith('.js') ? 'text/javascript' : 'text/html',
        body: url.pathname.endsWith('.js') ? available
          ? 'export function pendingLogoutOperations(storage) { const row=JSON.parse(storage.getItem("synthetic-pending")); if(!Number.isSafeInteger(row))throw Error("private-sentinel"); return {count:row}; }'
          : 'export const packageVersion="old-without-public-classifier";'
          : '<script type="module" src="/node_modules/.vite/deps/@bis_integration.js"></script>' });
    });
    await page.goto('http://127.0.0.1:59999/blockchain-stealth-and-steel-game/?muteMusic=true&muteSFX=true');
    await page.evaluate(() => localStorage.setItem('synthetic-pending', '2'));
    if (available) {
      assert.equal(await readLogoutCount(page), 2);
      await page.evaluate(() => localStorage.setItem('synthetic-pending', 'null'));
    }
    await assert.rejects(readLogoutCount(page), /logout-readiness-unavailable/);
    assert.equal(requested.some(path => path.startsWith('/BIS/')), false);
    await context.close();
  }
});
