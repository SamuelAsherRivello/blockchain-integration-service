import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createContext } from '../src/core/context.ts';

const addresses = { arkadeAddress: 'tark1-test-address', bitcoinAddress: 'tb1p-test-address' };
const tick = () => new Promise(resolve => setImmediate(resolve));
function setup() {
  const account = { phrase: 'test-placeholder', profileId: 'test-profile' };
  return createContext({ load: async () => ({ account, generation: 0 }), save: async () => { throw Error('Unexpected write'); }, reset: async () => { throw Error('Unexpected reset'); }, subscribe: () => () => {} }, undefined, async () => account.profileId, undefined, async () => { throw Error('Unexpected balance request'); }, undefined, async () => addresses);
}

test('invoice capability is unavailable and navigation leaves address receiving usable', async () => {
  const context = setup();
  try {
    await context.ready();
    assert.deepEqual(context.getState().invoiceReceiving, { status: 'unavailable', reason: 'No supported Signet receiving service is configured.' });
    assert.ok(Object.isFrozen(context.getState().invoiceReceiving));
    context.openAccountDialog();
    for (let visit = 0; visit < 2; visit++) {
      context.openAccountReceive();
      await tick();
      assert.deepEqual(context.getState().addresses, { status: 'ready', ...addresses });
      assert.equal(context.getState().invoiceReceiving.status, 'unavailable');
      context.closeAccount();
      assert.equal(context.getState().accountReceive, false);
      assert.equal(context.getState().view, 'account');
    }
  } finally { context.dispose(); }
});

test('production Receive hides deferred invoice UI and keeps address Copy and Back enabled', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  const context = setup();
  try {
    const { BisView } = await server.ssrLoadModule('/packages/integration/src/ui/client.tsx');
    await context.ready();
    context.openAccountDialog();
    context.openAccountReceive();
    await tick();
    const html = renderToStaticMarkup(createElement(BisView, { context }));
    assert.doesNotMatch(html, /Lightning invoice|No Invoice|With Invoice|Currently unavailable|bis-invoice/);
    for (const label of ['Arkade address', 'Bitcoin address']) {
      const button = html.match(new RegExp(`<button[^>]*aria-label="Copy ${label}"[^>]*>`))[0];
      assert.ok(!button.includes('disabled='));
    }
    assert.ok(html.includes(addresses.arkadeAddress) && html.includes(addresses.bitcoinAddress));
    assert.match(html, /<button[^>]*>Back<\/button>/);
    assert.ok(!html.match(/<button[^>]*disabled[^>]*>Back<\/button>/));
  } finally { context.dispose(); await server.close(); }
});
