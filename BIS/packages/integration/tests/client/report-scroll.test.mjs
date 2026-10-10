import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('long reports expose all text in a scrollable field without page navigation', async () => {
  const server = await createServer({ server: { middlewareMode: true, watch: { ignored: ['**/output/**'] } }, appType: 'custom' });
  try {
    const { FormValue } = await server.ssrLoadModule('/BIS/packages/integration/src/client/ui-layer-react/FormValue.tsx');
    const value = 'Long public report 🟢\n'.repeat(100);
    const html = renderToStaticMarkup(createElement(FormValue, { label: 'Recovery Info', value, multiline: true, 'aria-label': 'Recovery Info' }));
    assert.match(html, /bis-report-scrollable/);
    assert.doesNotMatch(html, /<nav|<button|Report pages/);
    assert.ok(html.includes(value));
    assert.match(html, /readonly/i);
  } finally { await server.close(); }
});

