import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedSignetArkadeRead, proxySignetArkadeRead } from '../src/server/arkade-read-proxy.ts';
import { createSignerMiddleware } from '../src/server/vite.ts';

test('Signet proxy maps only the fixed Arkade info, vtxo and asset GET routes', () => {
  assert.equal(allowedSignetArkadeRead(new URL('https://bis.test/api/bis/arkade/signet/v1/info'))?.href, 'https://signet.arkade.sh/v1/info');
  assert.equal(allowedSignetArkadeRead(new URL('https://bis.test/api/bis/arkade/signet/v1/info?path=arkade%2Fsignet%2Fv1%2Finfo'))?.href, 'https://signet.arkade.sh/v1/info');
  assert.equal(allowedSignetArkadeRead(new URL('https://bis.test/api/bis/arkade/signet/v1/info?path=arkade%2Fmutinynet%2Fv1%2Finfo')), undefined);
  assert.equal(allowedSignetArkadeRead(new URL('https://bis.test/api/bis/arkade/signet/v1/indexer/vtxos?scripts=ab&outpoints=' + 'a'.repeat(64) + ':0&page.size=100'))?.host, 'signet.arkade.sh');
  assert.equal(allowedSignetArkadeRead(new URL('https://bis.test/api/bis/arkade/signet/v1/indexer/vtxos?scripts=' + 'ab'.repeat(34) + '&page.index=0&page.size=500'))?.search, '?scripts=' + 'ab'.repeat(34) + '&page.index=0&page.size=500');
  assert.equal(allowedSignetArkadeRead(new URL('https://bis.test/api/bis/arkade/signet/v1/indexer/vtxos?scripts=ab&after=AbCdEf012-_xy&page.index=0&page.size=500'))?.search, '?scripts=ab&after=AbCdEf012-_xy&page.index=0&page.size=500');
  assert.equal(allowedSignetArkadeRead(new URL('https://bis.test/api/bis/arkade/signet/v1/indexer/vtxos?scripts=ab&page.size=501')), undefined);
  assert.equal(allowedSignetArkadeRead(new URL('https://bis.test/api/bis/arkade/signet/v1/indexer/vtxos?scripts=ab&after=' + 'a'.repeat(129))), undefined);
  assert.equal(allowedSignetArkadeRead(new URL('https://bis.test/api/bis/arkade/signet/v1/indexer/vtxos?scripts=ab&after=../../private')), undefined);
  assert.equal(allowedSignetArkadeRead(new URL('https://bis.test/api/bis/arkade/signet/v1/indexer/vtxos?path=arkade%2Fsignet%2Fv1%2Findexer%2Fvtxos&scripts=ab'))?.search, '?scripts=ab');
  assert.equal(allowedSignetArkadeRead(new URL('https://bis.test/api/bis/arkade/signet/v1/indexer/asset/' + 'a'.repeat(68)))?.pathname, '/v1/indexer/asset/' + 'a'.repeat(68));
  const assetPath = '/api/bis/arkade/signet/v1/indexer/asset/' + 'a'.repeat(68);
  assert.equal(allowedSignetArkadeRead(new URL('https://bis.test' + assetPath + '?path=arkade%2Fsignet%2Fv1%2Findexer%2Fasset%2F' + 'a'.repeat(68)))?.pathname, '/v1/indexer/asset/' + 'a'.repeat(68));
  assert.equal(allowedSignetArkadeRead(new URL('https://bis.test' + assetPath + '?path=wrong')), undefined);
  assert.equal(allowedSignetArkadeRead(new URL('https://bis.test' + assetPath + '?extra=1')), undefined);
  for (const path of [
    '/api/bis/arkade/mutinynet/v1/info',
    '/api/bis/arkade/signet/v1/tx/submit',
    '/api/bis/arkade/signet/v1/indexer/script/subscribe',
    '/api/bis/arkade/signet/v1/indexer/vtxos?admin=true',
    '/api/bis/arkade/signet/v1/indexer/vtxos?scripts=xyz',
    '/api/bis/arkade/signet/v1/indexer/vtxos?page.size=501',
    '/api/bis/arkade/signet/v1/indexer/asset/%2f%2fevil.test',
  ]) assert.equal(allowedSignetArkadeRead(new URL('https://bis.test' + path)), undefined, path);
});

test('proxy performs only bounded GETs to the fixed Signet host and returns sanitized JSON headers', async () => {
  let target = '';
  const request = new Request('https://bis.test/api/bis/arkade/signet/v1/indexer/vtxos?scripts=ab&path=arkade%2Fsignet%2Fv1%2Findexer%2Fvtxos');
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

test('local Signet read proxy works when no local signer is configured', async () => {
  const previousFetch = globalThis.fetch;
  const requested: string[] = [];
  globalThis.fetch = async input => {
    requested.push(String(input));
    return Response.json({ network: 'signet' });
  };
  try {
    const { middleware } = createSignerMiddleware({ enabled: false, network: 'signet', gameId: 'test' });
    let statusCode = 0, body = '';
    const response = {
      setHeader() {},
      end(value?: string) { body = value ?? ''; },
    };
    await middleware(
      { url: '/api/bis/arkade/signet/v1/info', method: 'GET', headers: { host: '127.0.0.1:5174' } } as any,
      response as any,
      () => { throw new Error('Read proxy should handle this route.'); },
    );
    statusCode = (response as any).statusCode;
    assert.equal(statusCode, 200);
    assert.deepEqual(JSON.parse(body), { network: 'signet' });
    assert.deepEqual(requested, ['https://signet.arkade.sh/v1/info']);
  } finally { globalThis.fetch = previousFetch; }
});

test('invalid and oversized upstream responses fail closed', async () => {
  const request = new Request('https://bis.test/api/bis/arkade/signet/v1/info');
  assert.equal((await proxySignetArkadeRead(request, async () => new Response('not json', { headers: { 'Content-Type': 'text/html' } }))).status, 502);
  assert.equal((await proxySignetArkadeRead(request, async () => new Response(new Uint8Array(2 * 1024 * 1024 + 1), { headers: { 'Content-Type': 'application/json' } }))).status, 502);
  assert.equal((await proxySignetArkadeRead(request, async () => { throw Error('upstream detail secret'); })).status, 502);
});
