import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('server Game Wallet presents a read-only quote entry point without quoting or submitting on render', async () => {
  const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, watch: { ignored: ['**/output/**'] } }, appType: 'custom' });
  let quoteCalls = 0, boardCalls = 0;
  try {
    const { GameWalletLoginView } = await server.ssrLoadModule('/BIS/packages/integration/src/client/ui-layer-react/GameWalletLogin.tsx');
    const state = { source: 'server', serverStatus: 'connected', status: 'ready', profileId: '1'.repeat(64), network: 'signet',
      playerConnected: true, addresses: { arkadeAddress: 'tark1test', bitcoinAddress: 'tb1ptest' } };
    const wallet = {
      getState: () => state, subscribe: () => () => {}, getOperationScope: () => ({ gameProfileId: state.profileId, network: 'signet', selectionVersion: 1 }),
      isOperationScopeCurrent: () => true, quoteBoarding: async () => { quoteCalls++; throw Error('Unexpected quote'); },
      board: async () => { boardCalls++; throw Error('Unexpected submit'); }, checkBoarding: async () => ({ status: 'idle' }),
      refresh: async () => {}, createWallet: async () => undefined, selectWallet: async () => false, importWallet: async () => false, logout: async () => {},
    };
    const markup = renderToStaticMarkup(createElement(GameWalletLoginView, { wallet, onBack() {} }));
    assert.match(markup, /Signet Bitcoin → Arkade/);
    assert.match(markup, /Get a 1,000-sat Signet quote/);
    assert.doesNotMatch(markup, /Confirm 1,000-sat Signet onboarding/);
    assert.equal(quoteCalls, 0);
    assert.equal(boardCalls, 0);
  } finally { await server.close(); }
});
