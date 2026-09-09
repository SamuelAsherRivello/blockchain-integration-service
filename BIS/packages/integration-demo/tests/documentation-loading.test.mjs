import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { resolve } from 'node:path';

test('documentation entry and its dependencies load successfully', async () => {
  const server = process.env.BIS_DEMO_URL ? undefined : await createServer({
    root: 'BIS/packages/integration-demo',
    cacheDir: resolve(`output/tests/documentation-loading/${process.pid}`),
    server: { host: '127.0.0.1', port: 0 },
  });
  try {
    await server?.listen();
    const base = process.env.BIS_DEMO_URL ?? server.resolvedUrls.local[0];
    const pageUrl = new URL('/documentation/user-stories/', base);
    const page = await fetch(pageUrl);
    assert.equal(page.status, 200);
    const html = await page.text();
    const entry = html.match(/src="([^"]*documentation\.tsx[^"]*)"/)?.[1];
    assert.ok(entry, 'Documentation must have its own entry module');
    const moduleUrl = new URL(entry, pageUrl);
    const response = await fetch(moduleUrl);
    assert.equal(response.status, 200);
    const code = await response.text();
    const imports = [...code.matchAll(/\bfrom\s*["']([^"']+)["']/g)].map(match => match[1]);
    assert.ok(imports.some(path => path.includes('react-markdown')));
    for (const path of imports) {
      const dependency = await fetch(new URL(path, moduleUrl), { signal: AbortSignal.timeout(15000) });
      assert.equal(dependency.status, 200, `Documentation dependency failed: ${path}`);
      await dependency.text();
    }
  } finally { await server?.close(); }
});
