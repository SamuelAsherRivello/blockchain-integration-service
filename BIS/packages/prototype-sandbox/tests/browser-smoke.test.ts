import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
import { DEMOS, HOME_PATH, SETUP_PATH } from '../src/client/navigation.ts';

const baseUrl = process.env.PROTOTYPE_SANDBOX_URL ?? 'http://127.0.0.1:5174';
const landingVisitedStorageKey = 'prototype-sandbox-visited';

test('Playwright renders the landing page, setup page, and every demo route', { timeout: 60000 }, async t => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? {channel:process.env.PLAYWRIGHT_CHANNEL} : {}) });
  t.after(() => browser.close());

  const context = await browser.newContext();
  await context.addInitScript(key => window.localStorage.setItem(key, 'true'), landingVisitedStorageKey);
  const page = await context.newPage();
  const routes = [
    { path: HOME_PATH, title: 'Home' },
    { path: SETUP_PATH, title: 'Setup' },
    ...DEMOS.map(demo => ({
      path: demo.path,
      title: demo.subject === demo.title ? demo.title : `${demo.subject} - ${demo.title}`,
    })),
  ];

  for (const route of routes) {
    const response = await page.goto(new URL(route.path, baseUrl).toString(), { waitUntil: 'domcontentloaded' });
    assert.equal(response?.status(), 200, route.path);
    await assert.doesNotReject(() => page.getByRole('heading', { level: 1, name: `BIS - Prototype Sandbox - ${route.title}` }).waitFor(), route.path);
    await assert.doesNotReject(() => page.getByRole('navigation', { name: 'Prototype Sandbox navigation' }).waitFor(), route.path);
  }

  await context.close();
});

test('each demo exposes an executable action and formatted output', { timeout: 60000 }, async t => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? {channel:process.env.PLAYWRIGHT_CHANNEL} : {}) });
  t.after(() => browser.close());

  const context = await browser.newContext();
  await context.addInitScript(key => window.localStorage.setItem(key, 'true'), landingVisitedStorageKey);
  const page = await context.newPage();

  for (const demo of DEMOS) {
    await page.goto(new URL(demo.path, baseUrl).toString(), { waitUntil: 'domcontentloaded' });
    const demoTitle = demo.subject === demo.title ? demo.title : `${demo.subject} - ${demo.title}`;
    await page.getByRole('heading', { level: 1, name: `BIS - Prototype Sandbox - ${demoTitle}` }).waitFor();
    const sourceField = page.locator('[aria-label="Source code"]');
    await sourceField.waitFor();
    const source = await sourceField.textContent();
    if([14,15,16,17].includes(demo.number))assert.match(source ?? '', /await demo(Create|Increment|Check|Claim)ConditionalVault\(/, demo.path);
    else if (demo.number === 20) assert.match(source ?? '', /demoExecuteAssetUpgrade\(/, demo.path);
    else if (demo.number === 21) assert.match(source ?? '', /export async function observeAddressScript\(/, demo.path);
    else assert.match(source ?? '', /export async function runDemo\(/, demo.path);

    const action = page.locator('.sandbox-demo button.sandbox-action-button').last();
    await action.waitFor();
    if (demo.number > 11 && demo.number !== 20) continue;

    await action.click();
    const output = page.locator('textarea[aria-label="Demo output"]');
    await output.waitFor();
    const deadline = Date.now() + 15000;
    let outputValue = '';
    while (Date.now() < deadline) {
      outputValue = await output.evaluate(element => element.value);
      if (outputValue) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const lines = outputValue.split('\n');
    assert.match(lines[0], /^Demo: .+ - Signet$/, demo.path);
    assert.doesNotMatch(lines.slice(1, -1).join('\n'), /^(?:Demo|Network|Success):/m, demo.path);
    assert.ok(/\nSuccess: (?:true|false)$/.test(outputValue),demo.path);
    if (demo.number === 20) {
      assert.match(outputValue, /Use Mint Asset demo first/);
      assert.match(outputValue, /\nSuccess: false$/);
      continue;
    }
  }

  await context.close();
});

test('each demo exposes the shared Overview tabs and naturally sized diagram canvas', { timeout: 60000 }, async t => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? {channel:process.env.PLAYWRIGHT_CHANNEL} : {}) });
  t.after(() => browser.close());

  const context = await browser.newContext({ viewport: { width: 420, height: 800 } });
  await context.addInitScript(key => window.localStorage.setItem(key, 'true'), landingVisitedStorageKey);
  const page = await context.newPage();

  for (const demo of DEMOS) {
    await page.goto(new URL(demo.path, baseUrl).toString(), { waitUntil: 'domcontentloaded' });
    const overview = page.getByRole('region', { name: 'Overview' });
    await overview.waitFor();
    for (const label of ['Intro', 'Diagram', 'Docs']) {
      assert.equal(await overview.getByRole('tab', { name: label, exact: true }).count(), 1, demo.path);
    }
    await overview.getByRole('tab', { name: 'Intro', exact: true }).click();
    assert.ok((await overview.getByRole('tabpanel').innerText()).trim().length > 0, `${demo.path}: visible Intro text`);

    await overview.getByRole('tab', { name: 'Diagram', exact: true }).click();
    const diagram = overview.locator('.sandbox-diagram-canvas');
    try { await diagram.locator('svg').waitFor(); }
    catch { assert.fail(`${demo.path}: ${await overview.innerText()}`); }
    assert.ok(((await diagram.boundingBox())?.height ?? 0) > 0, demo.path);
    const diagramBody = overview.locator('.sandbox-diagram-body');
    assert.equal(await diagramBody.evaluate(element => element.scrollHeight === element.clientHeight), true, demo.path);
    assert.equal(await diagramBody.evaluate(element => element.scrollWidth > element.clientWidth), true, demo.path);

    await overview.getByRole('tab', { name: 'Docs', exact: true }).click();
    assert.ok(await overview.locator('a[href^="https://docs.arkadeos.com/"]').count(), demo.path);
  }

  await context.close();
});
