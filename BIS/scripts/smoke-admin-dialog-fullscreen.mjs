import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.SMOKE_CHROMIUM_EXECUTABLE });
const base = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:5174';
const output = new URL('../../output/screenshots/admin-dialog-fullscreen/', import.meta.url);
await mkdir(output, { recursive: true });

const context = await browser.newContext();
await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));

async function openMint() {
  const trigger = page.getByRole('button', { name: 'Fixture: open mint' });
  await trigger.focus();
  await trigger.click();
  await page.getByRole('dialog', { name: 'Mint Asset' }).waitFor();
  await page.getByRole('button', { name: 'Mint', exact: true }).waitFor();
  return trigger;
}

async function assertMargins(width, height) {
  const bounds = await page.getByRole('dialog', { name: 'Mint Asset' }).boundingBox();
  assert.ok(bounds);
  const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) <= 1, `${label}: ${actual} != ${expected}`);
  close(bounds.x, width * .25, 'left margin');
  close(bounds.y, height * .10, 'top margin');
  close(bounds.width, width * .50, 'dialog width');
  close(bounds.height, height * .80, 'dialog height');
}

try {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/tests/asset-ui-host.html`);
  const trigger = await openMint();
  await assertMargins(1440, 1000);

  const dialog = page.getByRole('dialog', { name: 'Mint Asset' });
  const headings = await dialog.locator('legend, h3').allTextContents();
  assert.deepEqual(headings, ['Quick fill', 'Preview', 'Form']);
  assert.equal(await dialog.getByText('←', { exact: true }).count(), 0);
  const x = dialog.getByRole('button', { name: 'Close Mint Asset' });
  assert.equal(await x.innerText(), 'X');
  assert.deepEqual(await dialog.locator('.mint-presets button').allTextContents(), [
    'Clear',
    'Achievement: Level 1',
    'Achievement: Level 2',
    'Achievement: Level 3',
  ]);

  const summary = dialog.locator('.mint-summary');
  const initialSummaryBox = await summary.boundingBox();
  await dialog.getByRole('button', { name: 'Achievement: Level 2', exact: true }).click();
  assert.equal(await page.getByLabel('Name *', { exact: true }).inputValue(), 'Achievement: Level 2');
  assert.match(await dialog.locator('.mint-summary').innerText(), /Achievement: Level 2[\s\S]*1 LVL2/);
  assert.match(await dialog.locator('.mint-preview-icon').getAttribute('src'), /^https:\/\//);
  const presetSummaryBox = await summary.boundingBox();
  assert.deepEqual(presetSummaryBox, initialSummaryBox, 'preset icon does not resize Preview');

  const destinationBox = await page.getByLabel('Destination', { exact: true }).boundingBox();
  const controlBox = await page.getByLabel('Control Asset', { exact: true }).boundingBox();
  assert.ok(destinationBox && controlBox);
  assert.ok(Math.abs(destinationBox.width - controlBox.width) <= 1, 'Destination and Control Asset are equal width');
  assert.ok(Math.abs(destinationBox.y - controlBox.y) <= 1, 'Destination and Control Asset share a row');

  const iconInput = page.getByLabel('Icon URL', { exact: true });
  await iconInput.press('Control+A');
  await iconInput.press('Backspace');
  assert.equal(await dialog.locator('.mint-preview-icon').count(), 0, 'blank Icon URL removes the image');
  assert.equal(await dialog.locator('.mint-avatar').count(), 1, 'blank Icon URL restores the avatar');
  assert.deepEqual(await summary.boundingBox(), initialSummaryBox, 'blank icon does not resize Preview');
  await iconInput.fill('https://example.com/edited-icon.png');
  assert.equal(await dialog.locator('.mint-preview-icon').getAttribute('src'), 'https://example.com/edited-icon.png');
  assert.deepEqual(await summary.boundingBox(), initialSummaryBox, 'edited icon does not resize Preview');

  await page.getByLabel('Destination', { exact: true }).selectOption('player');
  await dialog.getByRole('button', { name: 'Clear', exact: true }).click();
  assert.equal(await page.getByLabel('Destination', { exact: true }).inputValue(), 'player');
  assert.equal(await page.getByLabel('Name *', { exact: true }).inputValue(), 'an asset');
  assert.equal(await page.getByLabel('Ticker *', { exact: true }).inputValue(), 'ASSET');
  assert.equal(await page.getByLabel('Amount *', { exact: true }).inputValue(), '1');
  assert.equal(await page.getByLabel('Decimals', { exact: true }).inputValue(), '0');
  assert.equal(await iconInput.inputValue(), '');
  assert.equal(await dialog.locator('.mint-preview-icon').count(), 0);
  assert.equal(await dialog.locator('.mint-avatar').count(), 1);
  assert.deepEqual(await summary.boundingBox(), initialSummaryBox, 'Clear does not resize Preview');
  await page.getByLabel('Destination', { exact: true }).selectOption('game');

  const actionBox = await dialog.getByRole('button', { name: 'Mint', exact: true }).boundingBox();
  const consoleBox = await dialog.locator('#mint-console').boundingBox();
  assert.ok(actionBox && consoleBox && actionBox.y + actionBox.height <= consoleBox.y, 'console follows Mint button');
  assert.match(await dialog.locator('#mint-console').innerText(), /Mint to the game wallet/);
  await page.screenshot({ path: fileURLToPath(new URL('mint-dialog-desktop.png', output)) });

  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  assert.equal(await trigger.evaluate(element => element === document.activeElement), true, 'focus returns to opener');

  await page.getByLabel('Mint scenario').selectOption('error');
  await openMint();
  await page.getByLabel('Name *', { exact: true }).fill('');
  assert.match(await page.locator('#mint-console').innerText(), /Enter a name, ticker/);
  assert.equal(await page.getByRole('button', { name: 'Mint', exact: true }).isDisabled(), true);
  await page.getByLabel('Name *', { exact: true }).fill('Error asset');
  await page.getByRole('button', { name: 'Mint', exact: true }).click();
  await page.getByText('Assets are unavailable. Try again.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Close Mint Asset' }).click();

  await page.getByLabel('Mint scenario').selectOption('held-pending');
  await openMint();
  await page.getByRole('button', { name: 'Mint', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Close Mint Asset' }).isDisabled(), true);
  assert.match(await page.locator('#mint-console').innerText(), /Minting asset/);
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog', { name: 'Mint Asset' }).count(), 1, 'Escape cannot close pending mint');
  await page.getByRole('button', { name: 'Fixture: release held result' }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).waitFor();
  assert.match(await page.locator('#mint-console').innerText(), /Asset minted/);
  await page.getByRole('button', { name: 'Done', exact: true }).click();

  await page.setViewportSize({ width: 390, height: 650 });
  await page.getByLabel('Mint scenario').selectOption('success');
  await openMint();
  await assertMargins(390, 650);
  await page.getByLabel('Control Asset', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: fileURLToPath(new URL('mint-dialog-narrow.png', output)) });

  assert.deepEqual(errors, []);
  console.log('PASS: shared Admin dialog margins, X/cancel guards, focus restoration, Mint section order, preview/form updates, console states, and narrow scrolling. Synthetic fixture only; no live mint.');
} finally {
  await context.close();
  await browser.close();
}
