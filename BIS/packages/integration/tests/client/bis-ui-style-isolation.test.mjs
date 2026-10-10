import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const overlayPath = new URL('../../src/client/ui-layer-react/overlay.css', import.meta.url);
const marketplacePolishPath = new URL('../../../marketplace/src/client/ui-layer-react/player-polish.css', import.meta.url);
const marketplaceStylePath = new URL('../../../marketplace/src/client/ui-layer-react/style.css', import.meta.url);

test('BIS style boundary owns protected typography and Marketplace does not override BIS headings', async () => {
  const [overlay, marketplacePolish, marketplaceStyle] = await Promise.all([
    readFile(overlayPath, 'utf8'),
    readFile(marketplacePolishPath, 'utf8'),
    readFile(marketplaceStylePath, 'utf8'),
  ]);
  assert.match(overlay, /\.bis-layer \{[\s\S]*?font: 400 12\.8px\/1\.5 Inter/);
  assert.match(overlay, /\.bis-layer \{[\s\S]*?letter-spacing: normal;[\s\S]*?text-transform: none;/);
  assert.match(overlay, /\.bis-copy-field-heading \{[\s\S]*?font: 700 9\.6px\/1\.5 Inter/);
  assert.match(overlay, /\.bis-copy-field-heading \{[\s\S]*?text-align: left;[\s\S]*?text-transform: none;/);
  assert.doesNotMatch(marketplacePolish, /\.bis-copy-field-heading\s*\{[^}]*font\s*:/);
  assert.doesNotMatch(marketplaceStyle, /(?:^|\n)header\s*\{/);
  assert.doesNotMatch(marketplaceStyle, /(?:^|\n)h1\s*\{/);
});

test('BIS protected typography is equal in Admin-like, game-like, and Marketplace-like hosts', async t => {
  const server = await createServer({
    configFile: false,
    server: { host: '127.0.0.1', port: 0, hmr: false, watch: { ignored: ['**/output/**'] } },
    appType: 'spa',
  });
  await server.listen();
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BIS_PLAYWRIGHT_CHANNEL ? { channel: process.env.BIS_PLAYWRIGHT_CHANNEL } : {}),
    ...(process.env.SMOKE_CHROMIUM_EXECUTABLE ? { executablePath: process.env.SMOKE_CHROMIUM_EXECUTABLE } : {}),
  });
  t.after(async () => { await browser.close(); await server.close(); });
  const page = await browser.newPage({ viewport: { width: 1200, height: 700 } });
  await page.goto(new URL('/BIS/packages/integration/tests/fixtures/bis-style-host.html', server.resolvedUrls.local[0]).href);
  await page.locator('.bis-layer').first().waitFor();
  const styles = await page.locator('[data-bis-style-check]').evaluateAll(elements => elements.map(element => {
    const style = getComputedStyle(element);
    return {
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing,
      textTransform: style.textTransform,
      color: style.color,
      textAlign: style.textAlign,
    };
  }));
  assert.equal(styles.length, 15);
  const expected = styles.slice(0, 5);
  for (const hostStyles of [styles.slice(5, 10), styles.slice(10, 15)]) {
    assert.deepEqual(hostStyles, expected);
  }
  assert.deepEqual(await page.locator('.bis-copy-field-heading').allTextContents(), [
    'Arkade address', 'Total balance', 'Bitcoin balance',
    'Arkade address', 'Total balance', 'Bitcoin balance',
    'Arkade address', 'Total balance', 'Bitcoin balance',
  ]);
});
