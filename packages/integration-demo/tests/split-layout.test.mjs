import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('split width follows the pointer and reserves room for both panes', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { splitPercent } = await server.ssrLoadModule('/packages/integration-demo/src/split-layout.ts');
    assert.equal(splitPercent(400, 1000), 40);
    assert.equal(splitPercent(-10, 1000), 34);
    assert.equal(splitPercent(256, 800), 42.5);
    assert.equal(splitPercent(1200, 1000), 73);
    assert.equal(splitPercent(0, 0), 32);
    assert.equal(splitPercent(900, 800), 66.25);
  } finally { await server.close(); }
});

test('split preference round-trips and tolerates invalid or unavailable storage', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { readSplitPercent, saveSplitPercent } = await server.ssrLoadModule('/packages/integration-demo/src/split-layout.ts');
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
