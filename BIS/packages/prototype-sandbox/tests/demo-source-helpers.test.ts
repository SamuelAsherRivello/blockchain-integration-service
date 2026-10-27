import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DEMO_FILES } from '../src/client/demo-files.ts';
import { demoEncodeHex, demoGetVtxosUrl } from '../src/client/demo-utils.ts';
import { DEFAULT_WALLET_1_ADDRESSES } from '../src/client/navigation.ts';

test('every executable source imports safely without browser storage or an operation', async t => {
  const forbidden = () => { throw new Error('Viewing/importing source must not execute a demo'); };
  t.mock.method(globalThis, 'fetch', forbidden);
  for (const property of ['window', 'localStorage', 'sessionStorage']) {
    const original = Object.getOwnPropertyDescriptor(globalThis, property);
    Object.defineProperty(globalThis, property, { configurable: true, get: forbidden });
    t.after(() => original ? Object.defineProperty(globalThis, property, original) : Reflect.deleteProperty(globalThis, property));
  }
  for (const demo of DEMO_FILES) {
    const url = new URL(`../src/client/demos/${demo.file}`, import.meta.url);
    const source = await readFile(url, 'utf8');
    const module = await import(url.href);
    assert.equal(typeof module.runDemo, 'function', demo.id);
    assert.deepEqual(source.match(/\/\/ (Arrange|Act|Assert)$/gm), ['// Arrange', '// Act', '// Assert'], demo.id);
    assert.doesNotMatch(source, /localStorageGetItem|sandboxWalletStorage|createDemoWallet|withFreshDemoWallet|localStorage\.(?:getItem|setItem|removeItem)/, demo.id);
    assert.doesNotMatch(source, /from ['"]react|<OperationDemo|setRunning|setOutput|beginExecution/, demo.id);
  }
});

test('public indexer helper builds the same script and selected-network operator URL', () => {
  assert.equal(demoEncodeHex(Uint8Array.of(0, 15, 128, 255)), '000f80ff');
  for (const network of ['signet', 'mutinynet'] as const) {
    const url = new URL(demoGetVtxosUrl(network, DEFAULT_WALLET_1_ADDRESSES[network]));
    assert.equal(url.origin, `https://${network}.arkade.sh`);
    assert.equal(url.pathname, '/v1/indexer/vtxos');
    assert.match(url.searchParams.get('scripts')!, /^5120[0-9a-f]{64}$/);
  }
  assert.throws(() => demoGetVtxosUrl('signet', 'invalid'));
});
