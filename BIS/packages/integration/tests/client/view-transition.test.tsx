import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const root = new URL('../../', import.meta.url);
const text = path => readFile(new URL(path, root), 'utf8');

test('shared BIS view transition exposes enter and exit lifecycle boundaries', async () => {
  const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, watch: { ignored: ['**/output/**'] } }, appType: 'custom' });
  try {
    const { ViewTransition } = await server.ssrLoadModule('/BIS/packages/integration/src/client/ui-layer-react/ViewTransition.tsx');
    const html = renderToStaticMarkup(createElement(ViewTransition, { viewKey: 'details' }, createElement('div', null, 'Account Details')));
    assert.match(html, /bis-view-transition/);
    assert.match(html, /bis-view-transition-surface bis-view-transition-enter/);
    assert.match(await text('src/client/ui-layer-react/ViewTransition.tsx'), /setOutgoing\(reducedMotion \? undefined : previous\)/);
    assert.match(await text('src/client/ui-layer-react/ViewTransition.tsx'), /event\.animationName !== 'bis-view-exit'/);
    assert.match(await text('src/client/ui-layer-react/ViewTransition.tsx'), /inert aria-hidden="true"/);
  } finally {
    await server.close();
  }
});

test('view transition values are centralized and wired to every BIS composition branch', async () => {
  const [client, pending, style] = await Promise.all([
    text('src/client/ui-layer-react/client.tsx'),
    text('src/client/ui-layer-react/PendingOperationDialog.tsx'),
    text('src/client/ui-layer-react/overlay.css'),
  ]);
  assert.match(style, /--bis-view-transition-duration: 100ms/);
  assert.match(style, /--bis-view-transition-from-scale: \.8/);
  assert.match(style, /@keyframes bis-view-enter/);
  assert.match(style, /@keyframes bis-view-exit/);
  assert.match(style, /\.bis-view-transition-surface:not\(\.bis-view-transition-exit\) > \* \{ pointer-events: auto; \}/);
  assert.match(style, /\.bis-view-transition-exit \{ pointer-events: none;/);
  assert.match(style, /prefers-reduced-motion: reduce\) \{ \.bis-view-transition-enter, \.bis-view-transition-exit \{ animation: none; \} \}/);
  assert.equal((client.match(/<ViewTransition viewKey=/g) ?? []).length, 3);
  assert.match(pending, /className="bis-pending-backdrop"/);
  assert.match(pending, /className="bis-pending-dialog" data-closing=/);
  assert.match(style, /\.bis-pending-dialog\[data-closing\] \{ opacity: 0; transform: scale\(var\(--bis-view-transition-from-scale\)\);/);
});
