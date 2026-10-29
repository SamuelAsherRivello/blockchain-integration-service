import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedSignetArkadeRead, proxySignetArkadeRead } from '../src/server/arkade-read-proxy.ts';

test('Signet proxy maps only the fixed Arkade info, vtxo and asset GET routes', () => {
  assert.equal(allowedSignetArkadeRead(new URL('https://bis.test/api/bis/arkade/signet/v1/info'))?.href, 'https://signet.arkade.sh/v1/info');
  assert.equal(allowedSignetArkadeRead(new URL('https://bis.test/api/bis/arkade/signet/v1/indexer/vtxos?scripts=ab&outpoints=' + 'a'.repeat(64) + ':0&page.size=100'))?.host, 'signet.arkade.sh');
  assert.equal(allowedSignetArkadeRead(new URL('https://bis.test/api/bis/arkade/signet/v1/indexer/asset/' + 'a'.repeat(68)))?.pathname, '/v1/indexer/asset/' + 'a'.repeat(68));
  for (const path of [
    '/api/bis/arkade/mutinynet/v1/info',
    '/api/bis/arkade/signet/v1/tx/submit',
    '/api/bis/arkade/signet/v1/indexer/script/subscribe',
    '/api/bis/arkade/signet/v1/indexer/vtxos?admin=true',
    '/api/bis/arkade/signet/v1/indexer/vtxos?scripts=xyz',
    '/api/bis/arkade/signet/v1/indexer/vtxos?page.size=101',
    '/api/bis/arkade/signet/v1/indexer/asset/%2f%2fevil.test',
  ]) assert.equal(allowedSignetArkadeRead(new URL('https://bis.test' + path)), undefined, path);
});

test('proxy performs only bounded GETs to the fixed Signet host and returns sanitized JSON headers', async () => {
  let target = '';
  const request = new Request('https://bis.test/api/bis/arkade/signet/v1/indexer/vtxos?scripts=ab');
  const response = await proxySignetArkadeRead(request, async (input, init) => {
    target = String(input);
    assert.equal(init?.method, 'GET');
    assert.equal(init?.redirect, 'error');
    assert.ok(init?.signal);
    return Response.json({ vtxos: [], page: { index: 0, size: 100 } });
  });
  assert.equal(target, 'https://signet.arkade.sh/v1/indexer/vtxos?scripts=ab');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { vtxos: [], page: { index: 0, size: 100 } });
});

test('unsupported methods and routes never call the upstream', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls++; return Response.json({}); };
  assert.equal((await proxySignetArkadeRead(new Request('https://bis.test/api/bis/arkade/signet/v1/info', { method: 'POST' }), fetcher)).status, 405);
  assert.equal((await proxySignetArkadeRead(new Request('https://bis.test/api/bis/arkade/signet/v1/tx/submit'), fetcher)).status, 404);
  assert.equal((await proxySignetArkadeRead(new Request('https://bis.test/api/bis/arkade/mutinynet/v1/info'), fetcher)).status, 404);
  assert.equal(calls, 0);
});

test('invalid and oversized upstream responses fail closed', async () => {
  const request = new Request('https://bis.test/api/bis/arkade/signet/v1/info');
  assert.equal((await proxySignetArkadeRead(request, async () => new Response('not json', { headers: { 'Content-Type': 'text/html' } }))).status, 502);
  assert.equal((await proxySignetArkadeRead(request, async () => new Response(new Uint8Array(2 * 1024 * 1024 + 1), { headers: { 'Content-Type': 'application/json' } }))).status, 502);
  assert.equal((await proxySignetArkadeRead(request, async () => { throw Error('upstream detail secret'); })).status, 502);
});
