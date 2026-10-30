import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';
import { DEMO_FILES } from '../src/client/demo-files.ts';

const origin = process.env.PROTOTYPE_SANDBOX_URL ?? 'http://127.0.0.1:5174';

test('Send Asset defaults to its minimum and explains payment in a label tooltip', { timeout: 45000 }, async t => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  page.on('dialog', dialog => dialog.accept());
  await page.route('https://*.arkade.sh/**', route => route.abort());
  await page.goto(`${origin}/prototype-sandbox/demo-8/`);
  const payment = page.getByRole('combobox', { name: 'Payment Sats:' });
  assert.equal(await payment.inputValue(), '330');
  assert.deepEqual(await payment.locator('option').allTextContents(), ['330', '1000']);
  assert.equal(await page.locator('label[for="send-asset-payment"] span').getAttribute('title'), 'Sats sent with the asset. Minimum 330.');
  assert.equal(await page.locator('#send-asset-payment-help').count(), 0);
  const source = await page.locator('#send-asset-source').textContent();
  assert.match(source ?? '', /asset-payment-sats/);
  assert.match(source ?? '', /const amount = demoValidateAssetTransferSats\(assetPaymentSats\(paymentSats\)\)/);
  assert.doesNotMatch(source ?? '', /wallet\.dustAmount/);
  assert.match(source ?? '', /export async function runDemo\(/);
  await page.evaluate(() => localStorage.setItem('signet-asset-payment-sats', '0'));
  await page.reload();
  assert.equal(await payment.inputValue(), '330', 'saved zero selections must migrate to the minimum');
  await payment.selectOption('1000');
  await page.reload();
  assert.equal(await payment.inputValue(), '1000');
  await page.locator('#network').selectOption('mutinynet');
  assert.equal(await payment.inputValue(), '330');
  await payment.selectOption('1000');
  await page.locator('#network').selectOption('signet');
  assert.equal(await payment.inputValue(), '1000');
  const output = new URL('../../../../output/screenshots/asset-payment/', import.meta.url);
  await mkdir(output, { recursive: true });
  for (const width of [1440, 500]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: new URL(`dropdown-${width}.png`, output).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
  }
});

test('every demo orders read-only inputs alphabetically before editable inputs', { timeout: 90000 }, async t => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.route('https://*.arkade.sh/**', route => route.abort());
  for (const demo of DEMO_FILES) {
    await page.goto(`${origin}/prototype-sandbox/demo-${demo.number}/`);
    await page.locator('.sandbox-demo-input-body').waitFor();
    const fields = await page.locator('.sandbox-demo-input-body').evaluate(body => [...body.querySelectorAll('label')].flatMap(label => {
      const control = label.htmlFor ? document.getElementById(label.htmlFor) : label.querySelector('input, select, textarea');
      if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement)) return [];
      const name = label.cloneNode(true) as HTMLElement;
      name.querySelectorAll('input, select, textarea').forEach(node => node.remove());
      return [{name: name.textContent.trim(), editable: !control.disabled && !('readOnly' in control && control.readOnly)}];
    }));
    assert.ok(fields.length, `${demo.file} exposes its input fields`);
    const sorted = [...fields].sort((a,b) => Number(a.editable)-Number(b.editable) || a.name.localeCompare(b.name,'en',{sensitivity:'base'}));
    assert.deepEqual(fields,sorted,demo.file);
  }
});
