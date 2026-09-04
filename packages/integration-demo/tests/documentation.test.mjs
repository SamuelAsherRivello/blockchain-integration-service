import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('every documentation TOC link resolves to one rendered heading', async () => {
  const server = await createServer({
    root: 'packages/integration-demo',
    server: { middlewareMode: true },
    plugins: [{
      name: 'render-documentation-without-browser-mount',
      enforce: 'pre',
      transform(code, id) {
        if (id.endsWith('/src/documentation.tsx')) {
          return code.replace(/createRoot\(document\.getElementById\('root'\)!\)\.render\(<Documentation \/>\);/, 'export { Documentation };');
        }
      },
    }],
  });
  try {
    const { Documentation } = await server.ssrLoadModule('/src/documentation.tsx');
    const html = renderToStaticMarkup(createElement(Documentation));
    const targets = [...html.matchAll(/href="#([^"]+)"/g)].map(match => match[1]);
    const headings = [...html.matchAll(/<h[1-6]\b[^>]*\bid="([^"]+)"/g)].map(match => match[1]);
    assert.ok(targets.length >= 23);
    for (const target of targets) {
      assert.equal(headings.filter(id => id === target).length, 1, `Missing or duplicate heading: ${target}`);
    }
  } finally { await server.close(); }
});

test('documentation has a clean standalone route and no filesystem URL', async () => {
  const server = await createServer({ root: 'packages/integration-demo', optimizeDeps: { noDiscovery: true, include: [] }, server: { host: '127.0.0.1', port: 0 } });
  try {
    await server.listen();
    const base = server.resolvedUrls.local[0];
    const admin = await (await fetch(new URL('src/admin/AdminPanel.tsx', base))).text();
    assert.ok(!admin.includes('User%20Story%20Diagrams.md') && admin.includes('documentation/user-stories/'));
    const page = await (await fetch(new URL('documentation/user-stories/', base))).text();
    assert.match(page, /User Story Diagrams/);
    assert.match(page, /documentation\.tsx/);
    const legacy = new URL('/@fs/' + resolve('documentation/User Story Diagrams.md').replaceAll('\\', '/'), base);
    const redirect = await fetch(legacy, { redirect: 'manual' });
    assert.equal(redirect.status, 302);
    assert.equal(redirect.headers.get('location'), '/documentation/user-stories/');
  } finally { await server.close(); }
});


