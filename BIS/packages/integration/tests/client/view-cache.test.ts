import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

let server;
test.before(async () => {
  server = await createServer({ configFile: false, root: process.cwd(), optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, watch: { ignored: ['**/output/**'] } }, appType: 'custom' });
});
test.after(async () => { await server.close(); });

test('view cache expires entries and isolates data by account, network, and type', async () => {
  const { createViewCache } = await server.ssrLoadModule('/BIS/packages/integration/src/client/state-layer-core/view-cache.ts');
  const cache = createViewCache(100);
  const balanceA = { dataType: 'balance', profileId: 'a', network: 'signet' };
  const balanceB = { dataType: 'balance', profileId: 'b', network: 'signet' };
  const addressesA = { dataType: 'addresses', profileId: 'a', network: 'signet' };
  cache.set(balanceA, { availableSats: 10 }, 1000);
  cache.set(balanceB, { availableSats: 20 }, 1000);
  cache.set(addressesA, { arkadeAddress: 'tark1address' }, 1000);
  assert.equal(cache.get(balanceA, 1099).value.availableSats, 10);
  assert.equal(cache.get(balanceA, 1100), undefined);
  assert.equal(cache.get(balanceB, 1099).value.availableSats, 20);
  assert.equal(cache.get(addressesA, 1099).value.arkadeAddress, 'tark1address');
});

test('view cache invalidation preserves unrelated data and failed or partial reads are not cacheable', async () => {
  const { createViewCache } = await server.ssrLoadModule('/BIS/packages/integration/src/client/state-layer-core/view-cache.ts');
  const cache = createViewCache();
  const balance = { dataType: 'balance', profileId: 'a', network: 'signet' };
  const activity = { dataType: 'activity', profileId: 'a', network: 'signet' };
  const other = { dataType: 'balance', profileId: 'b', network: 'signet' };
  const partial = { dataType: 'assets', profileId: 'a', network: 'signet' };
  cache.set(balance, { complete: true });
  cache.set(activity, { complete: true });
  cache.set(other, { complete: true });
  cache.set(partial, { complete: false }, Date.now(), false);
  cache.invalidateDataType('balance', 'a', 'signet');
  assert.equal(cache.get(balance), undefined);
  assert.ok(cache.get(activity));
  assert.ok(cache.get(other));
  assert.equal(cache.get(partial), undefined);
  cache.invalidateProfile('a');
  assert.equal(cache.get(activity), undefined);
  assert.ok(cache.get(other));
});
