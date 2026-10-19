import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { developmentConfig } from '../../../scripts/dev-config.ts';

// Isolated UI verification only. No funded wallet, real Claim, or network write.
test('first Claim output survives a real Vite hot update, remount and blank completion', { timeout: 90000 }, async (t) => {
  const config = developmentConfig({ port: 0 });
  const server = await createServer({ ...config, cacheDir: resolve('output/cache/demo-output-hmr'), logLevel: 'error' });
  t.after(() => server.close());
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === 'string') throw Error('isolated-preview-address-missing');
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' });
  t.after(() => browser.close());
  const context = await browser.newContext();
  await context.addInitScript(() => {
    localStorage.setItem('network', 'signet');
    localStorage.setItem('prototype-sandbox-visited', 'true');
  });
  await context.route(/arkade\.sh|127\.0\.0\.1:707[45]/, route => route.abort());
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${address.port}/prototype-sandbox/demo-16/`, { waitUntil: 'networkidle' });
  const output = page.locator('textarea[aria-label="Demo output"]');
  await page.getByRole('button', { name: 'Execute', exact: true }).click();
  await page.waitForFunction(() => document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Demo output"]')?.value.endsWith('Success: false'));
  const first = await output.inputValue();
  assert.match(first, /^Demo: Claim Conditional Vault\nError:/);
  await page.evaluate(() => { document.querySelector('.sandbox-main-content')!.setAttribute('data-hmr-probe', 'before'); });
  let navigations = 0;
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations++; });
  const main = '/BIS/packages/prototype-sandbox/src/client/main.tsx';
  const app = '/BIS/packages/prototype-sandbox/src/client/App.tsx';
  // An actual Vite websocket update, without touching the user's source files
  // or notifying/reloading their separate preview server.
  server.ws.send({ type: 'update', updates: [{ type: 'js-update', path: main, acceptedPath: app, timestamp: Date.now() }] });
  await page.waitForFunction(() => document.querySelector('.sandbox-main-content') && !document.querySelector('[data-hmr-probe]'));
  assert.equal(navigations, 0);
  assert.equal(await output.inputValue(), first);
  // Synthetic completed receipt for display lifecycle checks, not financial evidence.
  await page.evaluate(() => {
    const store = (globalThis as any).__bisSandboxDemoOutputSession.store;
    store.write('signet:16', 'Status: claimed\nSuccess: true', { explorer: { network: 'signet', kind: 'ark-transaction', identifier: 'ab'.repeat(32) } });
    store.write('signet:16', '');
    store.setElapsedMs('signet:16', 100);
  });
  await page.waitForFunction(() => document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Demo output"]')?.value.endsWith('Success: true'));
  const completed = await output.inputValue();
  await output.hover();
  await page.mouse.wheel(0, 400);
  await page.locator('nav a[href="/prototype-sandbox/demo-17/"]').last().click();
  await page.locator('nav a[href="/prototype-sandbox/demo-16/"]').last().click();
  assert.equal(await output.inputValue(), completed);
  assert.equal(await page.getByRole('button', { name: 'Open on Explorer', exact: true }).isEnabled(), true);
  assert.equal(await page.getByRole('button', { name: 'Recover', exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: 'Execute', exact: true }).click();
  await page.waitForFunction(() => document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Demo output"]')?.value.endsWith('Success: false'));
  assert.equal(await output.inputValue(), first);
});
