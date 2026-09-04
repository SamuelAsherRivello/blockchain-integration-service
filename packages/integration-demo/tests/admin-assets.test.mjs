import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';

test('Admin renders implemented asset stories and omits empty categories', async () => {
    const source = await readFile(new URL('../src/admin/AdminPanel.tsx', import.meta.url), 'utf8');
    const { code } = await transformWithOxc(source, 'AdminPanel.tsx', { jsx: { runtime: 'automatic' } });
    const moduleText = code.replace('"react/jsx-runtime"', JSON.stringify(import.meta.resolve('react/jsx-runtime'))).replace('"react/jsx-dev-runtime"', JSON.stringify(import.meta.resolve('react/jsx-dev-runtime')));
    const { AdminPanel } = await import(`data:text/javascript,${encodeURIComponent(moduleText)}`);
    const unexpected = () => { throw Error('Rendering must not invoke an action'); };
    const html = renderToStaticMarkup(createElement(AdminPanel, {
      selected: null, accountOpen: false, canReset: false, onSelect: unexpected, onReset: unexpected,
      canFund: false, funding: false, onFund: unexpected, onExplorer: unexpected,
      onMint: unexpected, onListAssets: unexpected, assetBusy: false, consoleOutput: '',
    }));
    assert.match(html, />A\. Account</);
    assert.match(html, />C\. Assets</);
    assert.match(html, /<span>C1<\/span>Mint Asset/);
    assert.match(html, /<span>C4<\/span>List Assets/);
    assert.match(html, />B\. Pay-to-play</);
    assert.match(html, /Request Continue - 1,000 sats/);
    assert.match(html, /aria-label="Console output"/);
});
