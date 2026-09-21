import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('split width follows the pointer and reserves room for both panes', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { splitPercent } = await server.ssrLoadModule('/BIS/packages/integration-demo/src/split-layout.ts');
    assert.equal(splitPercent(400, 1000), 40);
    assert.equal(splitPercent(-10, 1000), 38);
    assert.equal(splitPercent(256, 800), 47.5);
    assert.equal(splitPercent(1200, 1000), 73);
    assert.equal(splitPercent(0, 0), 32);
    assert.equal(splitPercent(900, 800), 66.25);
    assert.equal(splitPercent(-10, 600), 63.33333333333333);
    assert.equal(splitPercent(300, 600), 63.33333333333333);
    assert.equal(splitPercent(900, 600), 68.83333333333333);
  } finally { await server.close(); }
});

test('split preference round-trips and tolerates invalid or unavailable storage', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { readSplitPercent, saveSplitPercent } = await server.ssrLoadModule('/BIS/packages/integration-demo/src/split-layout.ts');
    const values = new Map();
    const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
    assert.equal(readSplitPercent(storage), 32);
    saveSplitPercent(47.5, storage);
    assert.equal(values.get('bis.integration-demo.admin-split-percent'), '47.5');
    assert.equal(readSplitPercent(storage), 47.5);
    for (const value of ['', 'broken', 'NaN', 'Infinity', '-1', '0', '100', '150']) {
      storage.setItem('bis.integration-demo.admin-split-percent', value);
      assert.equal(readSplitPercent(storage), 32);
    }
    const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    assert.equal(readSplitPercent(blocked), 32);
    assert.doesNotThrow(() => saveSplitPercent(45, blocked));
  } finally { await server.close(); }
});

test('split preference uses browser localStorage when no storage is passed', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  const values = new Map();
  const originalStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
  });
  try {
    const { readSplitPercent, saveSplitPercent } = await server.ssrLoadModule('/BIS/packages/integration-demo/src/split-layout.ts');
    assert.equal(readSplitPercent(), 32);
    saveSplitPercent(54);
    assert.equal(values.get('bis.integration-demo.admin-split-percent'), '54');
    assert.equal(readSplitPercent(), 54);
  } finally {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: originalStorage });
    await server.close();
  }
});
