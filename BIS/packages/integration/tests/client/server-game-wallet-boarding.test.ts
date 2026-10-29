import test from 'node:test';
import assert from 'node:assert/strict';
import { quoteServerSignetBoarding, submitServerSignetBoarding, type ServerBoardingWallet } from '../../src/client/state-layer-core/server-game-wallet-boarding.ts';
import type { BoardingQuote } from '../../src/client/state-layer-core/boarding-quote.ts';
import type { BisGameWalletOperationScope, BisGameWalletState } from '../../src/client/state-layer-core/game-wallet.ts';

const profileId = '1'.repeat(64);
const scope: BisGameWalletOperationScope = { playerProfileId: '2'.repeat(64), gameProfileId: profileId, network: 'signet', selectionVersion: 3 };
const quote: BoardingQuote = Object.freeze({ profileId, direction: 'to-arkade', amountSats: 1000, feeSats: 0, netSats: 1000,
  maxSats: 10_000, inputSats: 10_000, inputOutpoints: Object.freeze([Object.freeze({txid:'a'.repeat(64),vout:1,valueSats:10_000,assets:Object.freeze([])})]), bitcoinAfterSats: 9_000, arkadeAfterSats: 1000, totalAfterSats: 10_000,
  expiresAt: Date.now() + 60_000, fingerprint: 'a'.repeat(64) });

function fixture(overrides: { state?: Partial<BisGameWalletState>; quote?: Partial<BoardingQuote>; current?: boolean } = {}) {
  let state: BisGameWalletState = { source: 'server', serverStatus: 'connected', status: 'ready', profileId, network: 'signet', playerConnected: true, ...overrides.state };
  let liveQuote: BoardingQuote = overrides.quote ? { ...quote, ...overrides.quote } : quote;
  let current = overrides.current ?? true, quoteCalls = 0, boardCalls = 0;
  const wallet: ServerBoardingWallet = {
    getState: () => state,
    getOperationScope: () => scope,
    isOperationScopeCurrent: value => current && value.selectionVersion === scope.selectionVersion,
    quoteBoarding: async amount => { quoteCalls++; assert.equal(amount, 1000); return liveQuote; },
    board: async value => { boardCalls++; assert.equal(value.amountSats, 1000); return { status: 'succeeded', amountSats: 1000, direction: 'to-arkade' }; },
    checkBoarding: async () => ({ status: 'idle' }),
  };
  return { wallet, get quoteCalls() { return quoteCalls; }, get boardCalls() { return boardCalls; }, setCurrent(value: boolean) { current = value; },
    setState(value: Partial<BisGameWalletState>) { state = { ...state, ...value }; }, setQuote(value: Partial<BoardingQuote>) { liveQuote = Object.freeze({ ...liveQuote, ...value }); } };
}

test('quote requests are exact, read-only and require an explicit review before the one-shot submit', async () => {
  const f = fixture();
  const review = await quoteServerSignetBoarding(f.wallet);
  assert.equal(f.quoteCalls, 1);
  assert.equal(f.boardCalls, 0);
  await assert.rejects(submitServerSignetBoarding(f.wallet, review, false), /consent/);
  assert.equal(f.boardCalls, 0);
  assert.equal((await submitServerSignetBoarding(f.wallet, review, true)).status, 'succeeded');
  assert.equal(f.boardCalls, 1);
  await assert.rejects(submitServerSignetBoarding(f.wallet, review, true), /already used/);
  assert.equal(f.boardCalls, 1);
});

test('quote and submit fail closed on wrong network, source, amount, profile or changed wallet scope', async () => {
  for (const state of [{ network: 'mutinynet' as const }, { source: 'manual' as const }, { status: 'unavailable' as const }]) {
    const f = fixture({ state });
    await assert.rejects(quoteServerSignetBoarding(f.wallet));
    assert.equal(f.quoteCalls, 0);
    assert.equal(f.boardCalls, 0);
  }
  for (const changes of [{ amountSats: 5000 }, { profileId: '3'.repeat(64) }, { expiresAt: Date.now() + 1000 },
    { feeSats: 1001, netSats: -1 }, { maxSats: 999 },
    { inputOutpoints: [{txid:'b'.repeat(64),vout:1,valueSats:10_000,assets:[]}] },
    { inputOutpoints: [{txid:'a'.repeat(64),vout:1,valueSats:9_999,assets:[]}] }]) {
    const f = fixture({ quote: changes });
    await assert.rejects(quoteServerSignetBoarding(f.wallet));
    assert.equal(f.boardCalls, 0);
  }
  const f = fixture();
  const review = await quoteServerSignetBoarding(f.wallet);
  f.setCurrent(false);
  await assert.rejects(submitServerSignetBoarding(f.wallet, review, true));
  assert.equal(f.boardCalls, 0);
});

test('a live quote is invalidated when the Signet server profile changes before confirmation', async () => {
  const f = fixture();
  const review = await quoteServerSignetBoarding(f.wallet);
  f.setState({ profileId: '4'.repeat(64) });
  await assert.rejects(submitServerSignetBoarding(f.wallet, review, true));
  assert.equal(f.boardCalls, 0);
});

test('submit re-quotes exact inputs after consent and makes no submission when they changed', async () => {
  const f = fixture();
  const review = await quoteServerSignetBoarding(f.wallet);
  f.setQuote({ inputOutpoints: Object.freeze([Object.freeze({txid:'b'.repeat(64),vout:2,valueSats:10_000,assets:Object.freeze([])})]),
    fingerprint: 'b'.repeat(64) });
  await assert.rejects(submitServerSignetBoarding(f.wallet, review, true), /No transfer was submitted/);
  assert.equal(f.boardCalls, 0);
});
