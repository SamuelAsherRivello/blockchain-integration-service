import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('copy and title refresh utilities leave sequential tab order while retained controls stay focusable', async () => {
  const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, watch: { ignored: ['**/output/**'] } }, appType: 'custom' });
  try {
    const { CopyButton, PasteButton, VisibilityToggle } = await server.ssrLoadModule('/BIS/packages/integration/src/client/ui-layer-react/IconButton.tsx');
    const copy = renderToStaticMarkup(createElement(CopyButton, { label: 'Account ID', onClick: () => {} }));
    const paste = renderToStaticMarkup(createElement(PasteButton, { onClick: () => {} }));
    const visibility = renderToStaticMarkup(createElement(VisibilityToggle, { shown: false, onClick: () => {} }));

    assert.match(copy, /aria-label="Copy Account ID"/);
    assert.match(copy, /tabindex="-1"/);
    assert.doesNotMatch(paste, /tabindex="-1"/);
    assert.doesNotMatch(visibility, /tabindex="-1"/);

    const client = await readFile(new URL('../../src/client/ui-layer-react/client.tsx', import.meta.url), 'utf8');
    const itemList = await readFile(new URL('../../src/client/ui-layer-react/ItemList.tsx', import.meta.url), 'utf8');
    const formValue = await readFile(new URL('../../src/client/ui-layer-react/FormValue.tsx', import.meta.url), 'utf8');
    const splitWorkspace = await readFile(new URL('../../../integration-admin/src/client/ui-layer-react/SplitWorkspace.tsx', import.meta.url), 'utf8');
    assert.equal((client.match(/className="bis-title-icon"[^\n]*tabIndex=\{-1\}/g) ?? []).length, 2);
    assert.match(itemList, /className="bis-title-icon" label=\{`Refresh \$\{title\}`\} tabIndex=\{-1\}/);
    assert.match(formValue, /bis-balance-tooltip[^\n]*tabIndex=\{0\}/);
    assert.match(splitWorkspace, /role="separator"[\s\S]*tabIndex=\{0\}/);
  } finally {
    await server.close();
  }
});
