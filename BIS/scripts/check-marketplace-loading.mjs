import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const output = new URL('../../output/playwright/marketplace-loading-count/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const context = await browser.newContext();
await context.addInitScript(() => localStorage.setItem('bis:test-network:v1', 'signet'));
const page = await context.newPage();
await page.addInitScript(() => {
  window.__bisLoadingEvents = [];
  let previous = false;
  const sample = () => {
    const backdrop = document.querySelector('.bis-pending-backdrop');
    const visible = Boolean(backdrop && !backdrop.hasAttribute('data-closing') && getComputedStyle(backdrop).display !== 'none');
    if (visible !== previous) {
      window.__bisLoadingEvents.push({ visible, closing: Boolean(backdrop?.hasAttribute('data-closing')), heading: backdrop?.querySelector('h2')?.textContent ?? null, at: performance.now() });
      previous = visible;
    }
  };
  new MutationObserver(sample).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'data-closing', 'style'] });
  window.setInterval(sample, 25);
});
await page.goto('http://127.0.0.1:5174/marketplace/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('h1');
await page.waitForTimeout(30_000);
const events = await page.evaluate(() => window.__bisLoadingEvents);
const result = { events, shows: events.filter(event => event.visible).length, disappears: events.filter(event => !event.visible).length };
await writeFile(fileURLToPath(new URL('result.json', output)), JSON.stringify(result, null, 2));
await browser.close();
if (result.shows !== 1 || result.disappears !== 1) throw Error(`Expected one loading-menu show and hide, observed ${result.shows} and ${result.disappears}.`);
console.log(JSON.stringify(result));
