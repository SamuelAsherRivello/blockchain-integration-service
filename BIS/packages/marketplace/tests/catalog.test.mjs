import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const text = path => readFile(new URL(path, root), 'utf8');

test('public catalog contains the exact nine game equipment entries and no wallet secret fields', async () => {
  const catalog = JSON.parse(await text('public/catalog.json'));
  assert.equal(catalog.version, 1);
  assert.equal(catalog.gameId, 'stealth-and-steel');
  assert.equal(catalog.items.length, 9);
  assert.deepEqual(catalog.items.map(item => item.name), ['Shoes I','Shoes II','Shoes III','Dagger I','Dagger II','Dagger III','Shield I','Shield II','Shield III']);
  assert.equal(JSON.stringify(catalog).match(/phrase|private|secret|seed/i), null);
});

test('public Marketplace uses a read-only address query and leaves trade actions disabled', async () => {
  const [app, inventory] = await Promise.all([text('src/App.tsx'), text('src/inventory.ts')]);
  assert.match(app, /fetch\('\/catalog\.json'/);
  assert.match(app, /<button disabled[^>]*>Buy<\/button>/);
  assert.match(app, /<button disabled[^>]*>Sell<\/button>/);
  assert.match(inventory, /new RestIndexerProvider/);
  assert.doesNotMatch(inventory, /MnemonicIdentity|Wallet\.create|mint|send/i);
});
