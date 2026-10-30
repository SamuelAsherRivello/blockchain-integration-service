import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
import { ArkAddress } from '@arkade-os/sdk';
import { DEFAULT_WALLET_1_ADDRESSES } from '../src/client/navigation.ts';
import { publicAddressScript } from '../src/client/wallet-events.ts';
import { mkdir } from 'node:fs/promises';

const origin = process.env.PROTOTYPE_SANDBOX_URL ?? 'http://127.0.0.1:5174';
const address = DEFAULT_WALLET_1_ADDRESSES.signet;
const signer = Buffer.from(ArkAddress.decode(address).serverPubKey).toString('hex');
test('Events popup stays independent, pulses, resets, reconnects, reuses and cleans up', { timeout: 90000 }, async t => {
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
  const context = await browser.newContext();
  let subscriptions = 0, unsubscribes = 0;
  await context.route('https://*.arkade.sh/**', route => {
    const path = new URL(route.request().url()).pathname;
    const body = path === '/v1/info' ? { network: 'signet', signerPubkey: signer }
      : path.endsWith('/subscribe') ? { subscriptionId: `fixture-${++subscriptions}` }
      : path.endsWith('/unsubscribe') ? (unsubscribes++, {}) : { vtxos: [] };
    return route.fulfill({ json: body });
  });
  // Test-only transport replacement. Production never imports or exposes this hook.
  await context.addInitScript(() => {
    (window as any).sources = [];
    class Source extends EventTarget {
      closed = false;
      constructor() { super(); (window as any).sources.push(this); setTimeout(() => this.dispatchEvent(new Event('open')), 20); }
      close() { this.closed = true; }
    }
    (window as any).EventSource = Source;
  });
  const page = await context.newPage(); page.on('dialog', d => d.accept());
  await page.goto(`${origin}/prototype-sandbox/demo-21/`);
  const promise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Execute', exact: true }).click();
  let popup = await promise;
  await popup.getByRole('status').filter({ hasText: "I'm listening" }).waitFor();
  assert.equal(await popup.locator('.wallet-events-front .wallet-events-network').textContent(), '(Signet)');
  assert.equal(await popup.locator('button,input,textarea,a').count(), 0);
  assert.equal(await popup.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(0, 0, 0)');
  assert.equal(await popup.evaluate(() => innerWidth), 500); assert.equal(await popup.evaluate(() => innerHeight), 400);
  await page.getByRole('button', { name: 'Execute', exact: true }).click();
  assert.equal(context.pages().length, 2); assert.equal(subscriptions, 1);
  await page.getByRole('navigation').locator('a[href="/prototype-sandbox/demo-4/"]').click();
  assert.match(await popup.getByRole('status').textContent() ?? '', /I'm listening/);
  await popup.bringToFront();
  await popup.clock.install();
  await popup.clock.pauseAt(Date.now() + 1000);
  await popup.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  const dots = popup.locator('.wallet-events-dots');
  const initialDots = await dots.textContent();
  await popup.clock.runFor(1000);
  assert.notEqual(await dots.textContent(), initialDots);
  await popup.clock.runFor(2000);
  assert.equal(await dots.textContent(), initialDots, 'dots repeat every three seconds');
  assert.equal(await popup.locator('.wallet-events-front').evaluate(el => getComputedStyle(el).borderRadius), '7px');
  async function send(id: string, assets = false) {
    await popup.evaluate(({ script, id, assets }) => {
      const event = { txid: id, scripts: [script], newVtxos: [{ outpoint: { txid: id, vout: 0 }, amount: '100', script, createdAt: '1', isPreconfirmed: true, commitmentTxids: [], assets: assets ? [{ assetId: 'example-asset', amount: '9007199254740993123' }] : [] }] };
      (window as any).sources.at(-1).dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ event }) }));
    }, { script: publicAddressScript(address), id, assets });
    await popup.waitForFunction(id => document.querySelector('.wallet-events-card')?.getAttribute('data-event')?.includes(id), id);
  }
  await send('a'.repeat(64));
  const animations = await popup.evaluate(() => document.querySelector('.wallet-events-card')!.getAnimations().map(a => a.effect!.getTiming()));
  assert.equal(animations[0].duration, 1000); assert.equal(animations[0].iterations, 3);
  await popup.clock.fastForward(3000);
  assert.match(await popup.getByRole('status').innerText(), /Received/);
  await send('b'.repeat(64), true);
  await popup.clock.fastForward(3001);
  assert.match(await popup.getByRole('status').innerText(), /9007199254740993123/);
  await popup.clock.fastForward(1998);
  assert.match(await popup.getByRole('status').innerText(), /asset/);
  await popup.clock.fastForward(1);
  assert.match(await popup.getByRole('status').innerText(), /I'm listening/);
  await popup.getByRole('button', { name: 'Show Wallet 1 event log' }).click();
  await popup.clock.runFor(500);
  assert.equal(await popup.locator('.wallet-events-turn').evaluate(async el => {
    await Promise.all(el.getAnimations().map(animation => animation.finished));
    return getComputedStyle(el).transform;
  }), 'matrix3d(-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1)');
  await send('d'.repeat(64));
  assert.equal(await popup.getByRole('list').locator('li').count(), 5, 'events arrive while the log is open');
  await popup.getByRole('button', { name: 'Return to Wallet 1 monitor' }).press('Space');
  await popup.clock.runFor(500);
  assert.equal(await popup.getByRole('status').innerText(), 'Received 100 sats');
  await popup.clock.fastForward(4500);
  assert.match(await popup.getByRole('status').innerText(), /I'm listening/);
  await popup.emulateMedia({ reducedMotion: 'reduce' });
  await send('c'.repeat(64));
  assert.equal(await popup.evaluate(() => document.querySelector('.wallet-events-card')!.getAnimations().length), 0);
  await popup.clock.fastForward(5000);
  const card = popup.getByRole('button', { name: 'Show Wallet 1 event log' });
  await card.click();
  await popup.clock.runFor(500);
  const log = popup.getByRole('list', { name: 'Connection and event history' });
  assert.deepEqual((await log.locator('li span').allTextContents()).slice(0, 2), ['Connecting', 'Connected']);
  assert.equal(await log.locator('li').count(), 6, 'connection changes and every notification are kept');
  assert.equal(await popup.locator('.wallet-events-back').evaluate(el => getComputedStyle(el).height), '368px');
  const directory = new URL('../../../../output/screenshots/events-log/', import.meta.url);
  await mkdir(directory, { recursive: true });
  await popup.screenshot({ path: new URL('back.png', directory).pathname.replace(/^\/(\w:)/, '$1') });
  await popup.getByRole('button', { name: 'Return to Wallet 1 monitor' }).press('Enter');
  await popup.getByRole('status').waitFor();
  await popup.screenshot({ path: new URL('front.png', directory).pathname.replace(/^\/(\w:)/, '$1') });
  await popup.evaluate(() => (window as any).sources.at(-1).dispatchEvent(new Event('error')));
  await popup.clock.fastForward(1100);
  await popup.clock.fastForward(100);
  await popup.getByRole('status').filter({ hasText: "I'm listening" }).waitFor();
  assert.equal(subscriptions, 2);
  await popup.close();
  await page.getByRole('navigation').locator('a[href="/prototype-sandbox/demo-21/"]').click();
  const reopened = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Execute', exact: true }).click();
  popup = await reopened;
  await popup.getByRole('status').filter({ hasText: "I'm listening" }).waitFor();
  await page.goto(`${origin}/prototype-sandbox/demo-21/`);
  await page.evaluate(() => localStorage.setItem('network', 'mutinynet'));
  await page.reload();
  await page.getByRole('button', { name: 'Execute', exact: true }).click();
  await popup.waitForURL('**/events-monitor/?network=mutinynet&address=*');
  await popup.locator('.wallet-events-front .wallet-events-network').filter({ hasText: '(Mutinynet)' }).waitFor();
  assert.ok(unsubscribes >= 1);
  await page.close(); assert.ok(!popup.isClosed());
  await popup.close();
});

test('blocked popup reports a retry instruction without claiming launch success', async t => {
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(`${origin}/prototype-sandbox/demo-21/`);
  await page.evaluate(() => { window.open = () => null; });
  await page.getByRole('button', { name: 'Execute', exact: true }).click();
  const text = await page.getByRole('textbox', { name: 'Demo output', exact: true }).inputValue();
  assert.match(text, /Allow popups/); assert.match(text, /Success: false/);
});
