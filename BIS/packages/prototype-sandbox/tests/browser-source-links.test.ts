import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { developmentConfig } from '../../../scripts/dev-config.ts';
import { DEMO_FILES } from '../src/client/demo-files.ts';
import { demoSourceFile } from '../src/client/source-links.ts';

test('all 21 panels, source viewers and Execute buttons use their registered file', { timeout: 120000 }, async t => {
  const server = await createServer({ ...developmentConfig({ port: 0 }), cacheDir: resolve('output/cache/executable-demos'), logLevel: 'error' });
  t.after(() => server.close());
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === 'string') throw new Error('isolated-preview-address-missing');
  const origin = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' });
  t.after(() => browser.close());
  const context = await browser.newContext();
  await context.route(/arkade\.sh|127\.0\.0\.1:707[45]/, route => route.abort());
  await context.addInitScript(() => { localStorage.setItem('prototype-sandbox-visited', 'true'); });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const demo of DEMO_FILES) {
    await page.goto(`${origin}/prototype-sandbox/demo-${demo.number}/`);
    const file = demoSourceFile(demo.id);
    const expected = await readFile(resolve(file), 'utf8');
    const panel = page.locator('[aria-label="Source code"]').first();
    await panel.waitFor();
    assert.deepEqual(await panel.locator('.sandbox-code-line').allTextContents(), expected.replace(/\r\n?/g, '\n').split('\n'), demo.id);
    const definition = await page.evaluate(async id => {
      const { demoDefinition } = await import('/BIS/packages/prototype-sandbox/src/client/demo-registry.ts');
      const entry = demoDefinition(id);
      const module = await import('/' + entry.file);
      return { source: entry.source, sameRunner: entry.run === module.runDemo };
    }, demo.id);
    assert.equal(definition.source, expected, demo.id);
    assert.equal(definition.sameRunner, true, demo.id);
    const link = page.getByRole('link', { name: 'Open source file', exact: true });
    assert.equal(await link.getAttribute('target'), '_blank');
    const popup = page.waitForEvent('popup');
    await link.click();
    const viewer = await popup;
    await viewer.locator('#source-title').filter({ hasText: file }).waitFor();
    await viewer.waitForFunction(() => !document.getElementById('source-content')!.textContent!.startsWith('Loading'));
    assert.equal(await viewer.locator('#source-content').textContent(), expected, demo.id);
    assert.equal(await viewer.locator('button,input,textarea').count(), 0);
    await viewer.close();
    assert.equal(await page.locator('textarea[aria-label="Demo output"]').inputValue(), '', 'opening source cannot execute ' + demo.id);
  }
  await page.goto(`${origin}/prototype-sandbox/source-view/?file=.env`);
  await page.getByText('Source unavailable. Open a source link from a sandbox demo.').waitFor();
  assert.deepEqual(errors, []);

  // Dispatch fixtures prove every button calls the registered executable module.
  // They never run SDK operations and do not establish live network acceptance.
  const dispatch = await browser.newContext();
  await dispatch.addInitScript(() => {
    localStorage.setItem('prototype-sandbox-visited', 'true');
    (window as any).__demoCalls = [];
  });
  await dispatch.route(/arkade\.sh|127\.0\.0\.1:707[45]/, route => route.abort());
  await dispatch.route('**/demos/*.ts*', route => {
    const url = new URL(route.request().url());
    if (url.searchParams.has('raw')) return route.continue();
    const file = url.pathname.split('/').at(-1);
    const result = { output: 'Dispatch fixture. No network operation.\nSuccess: true' };
    return route.fulfill({ contentType: 'application/javascript', body: `export async function runDemo(context) { window.__demoCalls.push({ file: ${JSON.stringify(file)}, network: context.network, ...(context.amount !== undefined ? { amount: context.amount } : {}) }); return ${JSON.stringify(result)}; }` });
  });
  const testPage = await dispatch.newPage();
  for (const demo of DEMO_FILES) {
    await testPage.goto(`${origin}/prototype-sandbox/demo-${demo.number}/`);
    if (demo.number === 12) await testPage.locator('#external-wallet-amount').fill('1234');
    await testPage.locator('.sandbox-execute-button').click();
    await testPage.waitForFunction(() => (window as any).__demoCalls.length === 1);
    assert.deepEqual(await testPage.evaluate(() => (window as any).__demoCalls), [{ file: demo.file, network: 'signet', ...(demo.number === 12 ? { amount: '1234' } : {}) }], demo.id);
  }
});
