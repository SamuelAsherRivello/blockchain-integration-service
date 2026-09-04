import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('preview scale persists supported choices and tolerates invalid or blocked storage', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { readPreviewScale, savePreviewScale } = await server.ssrLoadModule('/packages/integration-demo/src/preview/preview-scale.ts');
    const values = new Map();
    const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
    const key = 'bis.integration-demo.preview-scale';
    assert.equal(readPreviewScale(storage), 0.5);
    for (const scale of [1, 0.5, 0.25]) {
      savePreviewScale(scale, storage);
      assert.equal(values.get(key), String(scale));
      assert.equal(readPreviewScale(storage), scale);
    }
    for (const value of ['', 'broken', 'NaN', 'Infinity', '-1', '0', '0.75', '100']) {
      storage.setItem(key, value);
      assert.equal(readPreviewScale(storage), 0.5);
    }
    const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    assert.equal(readPreviewScale(blocked), 0.5);
    assert.doesNotThrow(() => savePreviewScale(1, blocked));
    assert.equal(readPreviewScale(), 0.5);
    assert.doesNotThrow(() => savePreviewScale(1));
  } finally { await server.close(); }
});
