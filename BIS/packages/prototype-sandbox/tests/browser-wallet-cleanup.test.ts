import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';

const origin = process.env.PROTOTYPE_SANDBOX_URL ?? 'http://127.0.0.1:5174';
test('real cleanup rejects invalid credentials without network requests or erasing Setup', { timeout: 30000 }, async t => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  let requests = 0;
  await page.route('https://*.arkade.sh/**', route => { requests++; return route.abort(); });
  await page.goto(`${origin}/prototype-sandbox/setup/`);
  const signet = page.locator('.sandbox-setup-profile').filter({ has: page.getByRole('heading', { name: 'Signet', exact: true }) });
  const field = signet.getByLabel('Wallet 2 Mnemonic', { exact: true });
  await field.fill('invalid recovery input');
  await field.locator('..').getByRole('button', { name: 'Submit', exact: true }).click();
  await signet.getByRole('button', { name: 'Clean Wallet 2' }).click();
  await signet.getByRole('status').filter({ hasText: 'Wallet cleanup could not finish.' }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('signet-wallet-2-mnemonic')), 'invalid recovery input');
  assert.equal(await signet.getByRole('button', { name: 'Clean Wallet 2' }).isEnabled(), true);
  assert.equal(requests, 0);
});

test('Setup cleanup uses submitted profile values and offers progress, success and retryable errors', { timeout: 45000 }, async t => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  // Deterministic presentation only. Real SDK acceptance has its own network runner.
  await page.route(/\/wallet-maintenance\.ts(?:\?.*)?$/, route => {
    const url = new URL(route.request().url());
    if (url.searchParams.has('original-cleanup')) return route.continue();
    url.searchParams.set('original-cleanup', '1');
    return route.fulfill({ contentType: 'application/javascript', body: `
    export * from ${JSON.stringify(url.pathname + url.search)};
    export async function installWalletMaintenance() {}
    export async function cleanWallet2(network, mnemonic, progress) {
      if (!mnemonic) throw Error('Submit Wallet 2 Mnemonic first.');
      window.__cleanCalls ??= [];
      window.__cleanCalls.push({ network, mnemonic });
      progress('Finishing pending transactions...');
      await new Promise(resolve => { window.__releaseClean = resolve; });
      if (network === 'mutinynet') throw Error('A pending transaction is not resolved yet. Try Clean Wallet 2 again later.');
      return 'Wallet cleaned.';
    }
  ` });
  });
  await page.goto(`${origin}/prototype-sandbox/setup/`);
  const signet = page.locator('.sandbox-setup-profile').filter({ has: page.getByRole('heading', { name: 'Signet', exact: true }) });
  const mutiny = page.locator('.sandbox-setup-profile').filter({ has: page.getByRole('heading', { name: /mutiny/i }) });
  await signet.getByRole('button', { name: 'Clean Wallet 2', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Clean Wallet 2', exact: true }).count(), 2);
  await signet.getByRole('button', { name: 'Clean Wallet 2' }).click();
  await signet.getByRole('status').filter({ hasText: 'Submit Wallet 2 Mnemonic first.' }).waitFor();
  const phrase = signet.getByLabel('Wallet 2 Mnemonic', { exact: true });
  await phrase.fill('submitted-signet');
  await phrase.locator('..').getByRole('button', { name: 'Submit', exact: true }).click();
  await phrase.fill('unsaved-edit');
  await signet.getByRole('button', { name: 'Clean Wallet 2' }).click();
  await signet.getByRole('status').filter({ hasText: 'Finishing pending transactions...' }).waitFor();
  assert.equal(await signet.getByRole('button', { name: 'Clean Wallet 2' }).isDisabled(), true);
  assert.equal(await mutiny.getByRole('button', { name: 'Clean Wallet 2' }).isEnabled(), true);
  assert.deepEqual(await page.evaluate(() => (window as any).__cleanCalls), [{ network: 'signet', mnemonic: 'submitted-signet' }]);
  await page.evaluate(() => (window as any).__releaseClean());
  await signet.getByRole('status').filter({ hasText: 'Wallet cleaned.' }).waitFor();
  assert.equal(await signet.getByRole('button', { name: 'Clean Wallet 2' }).isEnabled(), true);
  const otherPhrase = mutiny.getByLabel('Wallet 2 Mnemonic', { exact: true });
  await otherPhrase.fill('submitted-mutiny');
  await otherPhrase.locator('..').getByRole('button', { name: 'Submit', exact: true }).click();
  await mutiny.getByRole('button', { name: 'Clean Wallet 2' }).click();
  await mutiny.getByRole('status').filter({ hasText: 'Finishing pending transactions...' }).waitFor();
  await page.evaluate(() => (window as any).__releaseClean());
  await mutiny.getByRole('status').filter({ hasText: /pending transaction is not resolved/ }).waitFor();
  assert.equal(await mutiny.getByRole('button', { name: 'Clean Wallet 2' }).isEnabled(), true);
  assert.equal(await page.evaluate(() => localStorage.getItem('mutinynet-wallet-2-mnemonic')), 'submitted-mutiny');
  const screenshots = new URL('../../../../output/screenshots/prototype-wallet-cleanup/', import.meta.url);
  await mkdir(screenshots, { recursive: true });
  for (const width of [1440, 500]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: new URL(`setup-${width}.png`, screenshots).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
  }
});
