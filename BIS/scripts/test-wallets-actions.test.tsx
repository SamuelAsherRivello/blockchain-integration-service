import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOwnedAction, ownedAction } from './test-wallets/owned-actions.ts';
import { browserEnvironment } from './test-wallets/browser-public.ts';
import { joinedRequest } from './test-wallets/joined-browser.ts';
import { publicFailure } from './test-wallets/errors.ts';

test('owned collection actions reject arbitrary or private payloads and never upgrade joined authority', async () => {
  const request = { command: 'action', type: 'select-item', screen: 'Assets', index: 0 };
  assert.equal(validateOwnedAction(request), request);
  for (const changed of [{ ...request, phrase: 'private-sentinel' }, { ...request, screen: 'Game Wallet' },
    { ...request, index: -1 }, { ...request, index: 1000 }, { ...request, index: 0.5 },
    { ...request, type: 'evaluate' }, { ...request, selector: 'input' }, null, []])
    assert.throws(() => validateOwnedAction(changed), /invalid-owned-action/);
  assert.throws(() => joinedRequest(request), /joined-action-denied/);
  await assert.rejects(ownedAction({ inspect: async () => ({ mode: 'joined', screen: 'Assets' }) }, request), /context-mismatch/);
  await assert.rejects(ownedAction({ inspect: () => assert.fail('must validate first') }, { ...request, phrase: 'private-sentinel' }), /invalid-owned-action/);
});

for (const network of ['signet', 'mutinynet']) test(`${network}: noncatalog collection interaction keeps scope and exposes no private DOM`, { timeout: 30000 }, async t => {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true, env: browserEnvironment() });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const application = { origin: 'http://127.0.0.1:59999', path: '/marketplace/' };
  const playerId = 'a'.repeat(64), gameAddress = `tark1${'b'.repeat(30)}`;
  await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: `
    <div class="bis-layer" data-bis-player-id="${playerId}" data-bis-network="${network}" data-bis-game-address="${gameAddress}"></div>
    <div class="bis-card"><h2>Assets</h2><div class="bis-collection" aria-busy="false">
    <ul class="bis-collection-list"><li><button class="bis-collection-item" onclick="document.querySelector('h2').textContent='Asset Detail'">private-sentinel</button></li></ul></div>
    <button aria-label="Refresh Assets" onclick="window.refreshes++">Refresh</button>
    <button onclick="window.submissions++">Burn</button></div>
    <script>window.refreshes=0;window.submissions=0;</script>` }));
  await page.goto(`${application.origin}${application.path}`);
  let closed = false;
  const owner = { page, registration: { application, pair: { network }, player: { profileId: playerId } },
    expected: { game: { arkadeAddress: gameAddress } },
    inspect: async () => ({ mode: 'owned', screen: await page.locator('h2').textContent() }),
    close: async () => { closed = true; } };
  assert.equal((await ownedAction(owner, { command: 'action', type: 'refresh', screen: 'Assets' })).screen, 'Assets');
  const result = await ownedAction(owner, { command: 'action', type: 'select-item', screen: 'Assets', index: 0 });
  assert.deepEqual(result, { mode: 'owned', screen: 'Asset Detail' });
  assert.equal(JSON.stringify(result).includes('private-sentinel'), false);
  assert.deepEqual(await page.evaluate(() => [window.refreshes, window.submissions]), [1, 0]);
  assert.equal(closed, false);
  await page.evaluate(() => { document.querySelector('h2').textContent = 'Assets'; document.querySelector('.bis-layer').dataset.bisNetwork = 'mainnet'; });
  await assert.rejects(ownedAction(owner, { command: 'action', type: 'select-item', screen: 'Assets', index: 0 }), /context-mismatch/);
  assert.equal(closed, true);
  assert.equal(await page.evaluate(() => window.submissions), 0);
});

test('failed owned action cancels the session and suppresses raw browser exceptions', async () => {
  let closed = false;
  const owner = { registration: { application: {}, pair: {}, player: {} }, expected: { game: {} },
    inspect: async () => ({ mode: 'owned', screen: 'Assets' }),
    page: { evaluate: async () => { throw Error('private-sentinel'); } }, close: async () => { closed = true; } };
  try { await ownedAction(owner, { command: 'action', type: 'refresh', screen: 'Assets' }); assert.fail('must fail'); }
  catch (error) { assert.deepEqual(publicFailure(error), { ok: false, reason: 'owned-action-unavailable' }); }
  assert.equal(closed, true);
});

