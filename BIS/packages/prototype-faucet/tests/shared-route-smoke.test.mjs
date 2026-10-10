import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { developmentConfig } from '../../../scripts/dev-config.mjs';

test('shared Vite server exposes all five local destinations', async t => {
  const server = await createServer(developmentConfig({ port: 0 }));
  t.after(() => server.close());
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  const checks = [
    ['/admin/', /<title>BIS - Admin<\/title>/],
    ['/marketplace/', /<title>BIS - Marketplace<\/title>/],
    ['/onboarding/', /<title>BIS - Onboarding<\/title>/],
    ['/prototype-faucet/', /<title>BIS Prototype Faucet<\/title>/],
    ['/integration/', /<h1[^>]*>Integration package<\/h1>/],
  ];
  for (const [path, expected] of checks) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), expected, path);
  }
});
