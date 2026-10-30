import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';

test('Treasure Hunt pages retain network controls and fail before opening an absent wallet', { timeout: 120000 }, async t => {
  const origin = process.env.PROTOTYPE_SANDBOX_URL ?? 'http://127.0.0.1:5174';
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' });
  t.after(() => browser.close());
  for (const network of ['signet', 'mutinynet']) {
  const context = await browser.newContext();
  const forbiddenRequests: string[] = [];
  await context.route('**/*', route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === new URL(origin).origin && ['GET', 'HEAD'].includes(request.method()) && !/^\/api(?:\/|$)/.test(url.pathname)) return route.continue();
    forbiddenRequests.push(`${request.method()} ${url.origin}${url.pathname}`);
    return route.abort();
  });
  await context.routeWebSocket('**/*', socket => socket.close());
  await context.addInitScript(network => {
    localStorage.setItem('prototype-sandbox-visited', 'true');
    localStorage.setItem('network', network);
  }, network);
  const page = await context.newPage();
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  for (const [number, title] of [[22, 'Create Treasure Hunt Offer'], [23, 'Check Treasure Hunt Offer'], [24, 'Claim Treasure'], [25, 'Reject Treasure Offer']]) {
    await page.goto(`${origin}/prototype-sandbox/demo-${number}/`);
    await page.getByRole('heading', { name: 'Treasure Hunt' }).first().waitFor();
    assert.equal(await page.getByLabel('Network default').count(), 0);
    assert.equal(await page.getByLabel('Treasure offer').count(), 0);
    const wallet1Input = page.getByLabel('Wallet 1 Address input value');
    const wallet2Input = page.getByLabel('Wallet 2 Mnemonic input value');
    assert.equal(await wallet2Input.inputValue(), '', 'fresh UI check never receives a mnemonic');
    assert.equal(await wallet1Input.isEditable(), false);
    assert.equal(await wallet2Input.isEditable(), false);
    const execute = page.getByRole('button', { name: 'Execute' });
    assert.equal(await execute.isDisabled(), false, `${title} remains clickable without client-side offer state`);
    assert.equal(await execute.locator('.sandbox-execute-label').textContent(), 'Execute');
    assert.equal((await execute.locator('.sandbox-execute-network').textContent())?.trim().toLowerCase(), `(${network})`);
    await execute.hover();
    assert.equal(await page.locator('.sandbox-loading-backdrop').count(), 0, 'hovering never opens the loading prompt');
    await execute.click();
    const demoOutput = page.getByRole('textbox', { name: 'Demo output' });
    await demoOutput.waitFor();
    await page.waitForFunction(() => document.querySelector('[aria-label="Demo output"]')?.value.includes('Error: Enter Wallet 2 Mnemonic on Setup Input first.'));
    assert.equal(await page.locator('.sandbox-loading-backdrop').count(), 0, 'a rejected setup leaves the page usable');
    const manageAccount = page.getByRole('button', { name: 'Manage BIS Account' });
    assert.equal(await manageAccount.count(), 0);
  }

  await page.goto(`${origin}/prototype-sandbox/demo-14/`);
  await page.getByRole('heading', { name: /Conditional Vault/ }).first().waitFor();
  await page.goto(`${origin}/prototype-sandbox/demo-17/`);
  await page.getByRole('heading', { name: /Conditional Vault/ }).first().waitFor();
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(forbiddenRequests, [], 'no API or external request is attempted');
  await context.close();
  }
});
