import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';

const origin = process.env.PROTOTYPE_SANDBOX_URL ?? 'http://127.0.0.1:5174';

test('Send Asset exposes optional payment separately from carrier sats', { timeout: 45000 }, async t => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  page.on('dialog', dialog => dialog.accept());
  await page.goto(`${origin}/prototype-sandbox/demo-8/`);
  const payment = page.getByRole('combobox', { name: 'Optional Payment Sats:' });
  assert.equal(await payment.inputValue(), '0');
  assert.deepEqual(await payment.locator('option').allTextContents(), ['0', '100', '1000']);
  assert.match(await page.locator('#send-asset-payment-help').textContent() ?? '', /330 sats.*not to fees/);
  const source = await page.locator('#send-asset-source').textContent();
  assert.match(source ?? '', /asset-payment-sats/);
  assert.match(source ?? '', /amount: assetTransferSats\(wallet.dustAmount, optionalPaymentSats\)/);
  assert.match(source ?? '', /optional payment defaults to 0/);
  await payment.selectOption('100');
  await page.reload();
  assert.equal(await payment.inputValue(), '100');
  await page.locator('#network').selectOption('mutinynet');
  assert.equal(await payment.inputValue(), '0');
  await payment.selectOption('1000');
  await page.locator('#network').selectOption('signet');
  assert.equal(await payment.inputValue(), '100');
  const output = new URL('../../../../output/screenshots/asset-payment/', import.meta.url);
  await mkdir(output, { recursive: true });
  for (const width of [1440, 500]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: new URL(`dropdown-${width}.png`, output).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
  }
});
