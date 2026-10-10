import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const text = path => readFile(new URL(path, root), 'utf8');

test('entry loading waits for construction without delaying the underlying read', async () => {
  const [policy, send, client, css] = await Promise.all([
    text('src/client/ui-layer-react/view-loading.ts'),
    text('src/client/ui-layer-react/AccountSend.tsx'),
    text('src/client/ui-layer-react/client.tsx'),
    text('src/client/ui-layer-react/overlay.css'),
  ]);
  assert.match(policy, /requestAnimationFrame/);
  assert.match(policy, /The underlying read is never delayed/);
  assert.doesNotMatch(policy, /setTimeout\([^\n]*100/);
  assert.doesNotMatch(send, /setTimeout\([^\n]*100/);
  assert.match(send, /useEntryLoadingGate\(busy,initialLoad\.current,viewLoadingPolicies\.send\)/);
  assert.match(client, /useEntryLoadingGate\(entryLoading, entryViewKey !== 'none', entryPolicy, entryViewKey\)/);
  assert.match(policy, /entryPresentation/);
  assert.match(policy, /details: Object\.freeze\(\{ isLoadingAuto: true, isLoadingModal: false, isLoadingCached: true \}\)/);
  assert.match(policy, /onboarding: Object\.freeze\(\{ isLoadingAuto: true, isLoadingModal: false, isLoadingCached: false \}\)/);
  assert.match(policy, /marketplace: Object\.freeze\(\{ isLoadingAuto: true, isLoadingModal: true, isLoadingCached: false \}\)/);
  assert.match(policy, /if \(entryLoading\) hideFrame = window\.requestAnimationFrame/);
  assert.match(client, /entryViewKey !== 'none'/);
  assert.match(await text('src/client/ui-layer-react/AccountAssets.tsx'), /useEffect\(/);
  assert.match(await text('src/client/ui-layer-react/AccountContracts.tsx'), /useEffect\(/);
  assert.match(await text('src/client/ui-layer-react/AccountActivity.tsx'), /useEffect\(/);
  assert.match(css, /\.bis-title-icon:disabled \.bis-refresh-image \{ animation: bis-refresh-spin/);
  assert.match(css, /prefers-reduced-motion: reduce\).*bis-title-icon:disabled \.bis-refresh-image/);
});

test('view cache uses short-lived identity-scoped entries and explicit invalidation', async () => {
  const [context, lifecycle] = await Promise.all([
    text('src/client/state-layer-core/context.ts'),
    text('src/client/state-layer-core/asset-view-lifecycle.ts'),
  ]);
  assert.match(context, /createViewCache/);
  assert.match(context, /invalidateDataType\('activity'/);
  assert.match(context, /refreshBalance: \(\) => \{if\(state\.profileId\)/);
  assert.match(context, /const detailsRead = state\.accountDetails/);
  assert.match(context, /viewCache\.set\(detailsKey/);
  assert.match(context, /invalidateDataType\('details'/);
  assert.match(lifecycle, /createViewCache/);
  assert.match(lifecycle, /if \(background && cacheKey\) cache\.invalidate\(cacheKey\)/);
});
