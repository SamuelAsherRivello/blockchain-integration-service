import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
import { DEMOS } from '../src/client/navigation.ts';
import { SOURCE_FILES } from '../src/client/source-links.ts';

const origin = process.env.PROTOTYPE_SANDBOX_URL ?? 'http://127.0.0.1:5174';
test('every local demo source opens readable source in a new window without running it', { timeout: 60000 }, async t => {
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
  const page = await browser.newPage();
  for (const demo of DEMOS) {
    await page.goto(`${origin}${demo.path}`);
    const link = page.getByRole('link', { name: 'Open source file', exact: true });
    await link.waitFor();
    assert.match(await link.getAttribute('href') ?? '', /^\/prototype-sandbox\/source-view\//);
    assert.equal(await link.getAttribute('target'), '_blank');
  }
  for (const [demo, file] of [[1, SOURCE_FILES.app], [21, SOURCE_FILES.events], [20, SOURCE_FILES.upgrade], [14, SOURCE_FILES.vault]] as const) {
    await page.goto(`${origin}/prototype-sandbox/demo-${demo}/`);
    const opened = page.waitForEvent('popup');
    await page.getByRole('link', { name: 'Open source file', exact: true }).click();
    const source = await opened;
    await source.locator('#source-title').filter({ hasText: file }).waitFor();
    await source.waitForFunction(() => !document.getElementById('source-content')!.textContent!.startsWith('Loading'));
    const text = await source.locator('pre').textContent();
    assert.match(text ?? '', /import /);
    assert.ok(!text?.startsWith('export default "'), 'raw Vite module wrapper is not displayed');
    assert.equal(await source.locator('button,input,textarea').count(), 0);
    await source.close();
  }
  const response = await page.goto(`${origin}/prototype-sandbox/source-view/?file=.env`);
  assert.equal(response?.status(), 200);
  await page.getByText('Source unavailable. Open a source link from a sandbox demo.').waitFor();
});
