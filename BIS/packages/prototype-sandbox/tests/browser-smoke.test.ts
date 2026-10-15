import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
import { DEMOS, HOME_PATH, SETUP_PATH } from '../src/client/navigation.ts';

const baseUrl = process.env.PROTOTYPE_INTERACTIVE_DOCS_URL ?? 'http://127.0.0.1:5174';
const landingVisitedStorageKey = 'prototype-interactive-docs-visited';

test('Playwright renders the landing page, setup page, and every demo route', { timeout: 60000 }, async t => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
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
    const response = await page.goto(new URL(route.path, baseUrl).toString(), { waitUntil: 'networkidle' });
    assert.equal(response?.status(), 200, route.path);
    await assert.doesNotReject(() => page.getByRole('heading', { level: 1, name: `BIS - Prototype Interactive Docs - ${route.title}` }).waitFor(), route.path);
    await assert.doesNotReject(() => page.getByRole('navigation', { name: 'Prototype Interactive Docs navigation' }).waitFor(), route.path);
  }

  await context.close();
});
