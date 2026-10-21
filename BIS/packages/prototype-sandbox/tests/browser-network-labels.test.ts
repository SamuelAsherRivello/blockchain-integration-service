import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';
import { DEMOS, DEFAULT_WALLET_1_ADDRESSES } from '../src/client/navigation.ts';

const origin = process.env.PROTOTYPE_SANDBOX_URL ?? 'http://127.0.0.1:5174';

test('every demo action shows the selected network with secondary typography', { timeout: 60000 }, async t => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 740, height: 1000 } });
  page.on('dialog', dialog => dialog.accept());
  const directory = new URL('../../../../output/screenshots/sandbox-network-labels/', import.meta.url);
  await mkdir(directory, { recursive: true });
  for (const [network, label] of [['signet', 'Signet'], ['mutinynet', 'Mutinynet']]) {
    await page.goto(`${origin}/prototype-sandbox/demo-21/`);
    if (await page.locator('#network').inputValue() !== network) await page.locator('#network').selectOption(network);
    assert.equal(await page.locator('.sandbox-execute-network').textContent(), `(${label})`, 'updates without reload');
    for (const demo of DEMOS) {
      await page.goto(`${origin}${demo.path}`);
      const action = page.locator('.sandbox-demo .sandbox-execute-button');
      await action.waitFor();
      assert.equal(await action.count(), 1, demo.path);
      assert.equal(await action.locator('.sandbox-execute-network').textContent(), `(${label})`, demo.path);
      const metrics = await action.evaluate(button => {
        const primary = button.querySelector('.sandbox-execute-label')!;
        const secondary = button.querySelector('.sandbox-execute-network')!;
        return {
          primarySize: parseFloat(getComputedStyle(primary).fontSize), secondarySize: parseFloat(getComputedStyle(secondary).fontSize),
          primaryWeight: getComputedStyle(primary).fontWeight, secondaryWeight: getComputedStyle(secondary).fontWeight,
          secondLine: secondary.getBoundingClientRect().top >= primary.getBoundingClientRect().bottom,
        };
      });
      assert.ok(metrics.primarySize > 16 && metrics.primarySize > metrics.secondarySize, demo.path);
      assert.equal(metrics.primaryWeight, '700'); assert.equal(metrics.secondaryWeight, '400');
      assert.ok(metrics.secondLine, demo.path);
      if (demo.number === 21) await action.screenshot({ path: new URL(`execute-${network}.png`, directory).pathname.replace(/^\/(\w:)/, '$1') });
    }
    // Visual-only capture. Real stream lifecycle is covered separately.
    await page.route('https://*.arkade.sh/**', route => route.abort());
    await page.goto(`${origin}/prototype-sandbox/events-monitor/?${new URLSearchParams({ network, address: DEFAULT_WALLET_1_ADDRESSES[network] })}`);
    await page.getByRole('heading', { name: 'Wallet 1', exact: true }).waitFor();
    assert.equal(await page.locator('.wallet-events-front .wallet-events-network').textContent(), `(${label})`);
    assert.equal(await page.locator('.wallet-events-front').evaluate(card => card.children[1].className), 'wallet-events-network');
    await page.screenshot({ path: new URL(`monitor-${network}.png`, directory).pathname.replace(/^\/(\w:)/, '$1') });
    await page.unroute('https://*.arkade.sh/**');
  }
});
