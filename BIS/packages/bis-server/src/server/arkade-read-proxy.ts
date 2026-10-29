const UPSTREAM = 'https://signet.arkade.sh';
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_QUERY_BYTES = 8 * 1024;
// RestIndexerProvider defaults to 500 results per page. Keep that SDK default
// usable while retaining a bounded request and a 2 MiB response cap.
const MAX_VTXO_PAGE_SIZE = 500;

function allowedVtxosQuery(params: URLSearchParams) {
  const allowed = new Set(['scripts', 'outpoints', 'spendableOnly', 'spentOnly', 'recoverableOnly', 'pendingOnly', 'renewableOnly', 'after', 'before', 'page.index', 'page.size']);
  let entries = 0;
  for (const key of new Set(params.keys())) {
    if (!allowed.has(key)) return false;
    const values = params.getAll(key);
    if ((key === 'scripts' || key === 'outpoints') ? values.length > 32 : values.length !== 1) return false;
    entries += values.length;
    if (entries > 64) return false;
    for (const value of values) {
      if (key === 'scripts' && (!/^(?:[a-f0-9]{2}){1,5000}$/i.test(value))) return false;
      if (key === 'outpoints') {
        const outpoint = value.match(/^([a-f0-9]{64}):([0-9]{1,10})$/i);
        if (!outpoint || Number(outpoint[2]) > 0xffff_ffff) return false;
      }
      if (['spendableOnly', 'spentOnly', 'recoverableOnly', 'pendingOnly', 'renewableOnly'].includes(key) && value !== 'true' && value !== 'false') return false;
      if (['after', 'before'].includes(key) && !/^(?:0|[1-9][0-9]{0,8}|[A-Za-z0-9_-]{1,128})$/.test(value)) return false;
      if (['page.index', 'page.size'].includes(key) && (!/^(0|[1-9][0-9]{0,8})$/.test(value) || (key === 'page.size' && Number(value) > MAX_VTXO_PAGE_SIZE))) return false;
    }
  }
  return true;
}

/** Only fixed Signet JSON reads needed to display wallet balances and public assets cross this boundary. */
export function allowedSignetArkadeRead(url: URL): URL | undefined {
  // Vercel appends an unmatched named rewrite parameter to the function query.
  // Accept it only when it exactly mirrors the already-routed public API path.
  const query = new URLSearchParams(url.searchParams);
  const rewritePath = query.getAll('path');
  if (rewritePath.length) {
    const expected = url.pathname.startsWith('/api/bis/') ? url.pathname.slice('/api/bis/'.length) : '';
    if (rewritePath.length !== 1 || !expected || rewritePath[0] !== expected) return undefined;
    query.delete('path');
  }
  const search = query.toString();
  if (url.pathname === '/api/bis/arkade/signet/v1/info' && !search) return new URL('/v1/info', UPSTREAM);
  if (url.pathname === '/api/bis/arkade/signet/v1/indexer/vtxos' && Buffer.byteLength(search) <= MAX_QUERY_BYTES && allowedVtxosQuery(query)) {
    const upstream = new URL('/v1/indexer/vtxos', UPSTREAM);
    upstream.search = search;
    return upstream;
  }
  const asset = url.pathname.match(/^\/api\/bis\/arkade\/signet\/v1\/indexer\/asset\/([^/]+)$/);
  if (asset) {
    let id: string;
    try { id = decodeURIComponent(asset[1]); } catch { return undefined; }
    if (search || !/^[a-z0-9:_-]{1,128}$/i.test(id)) return undefined;
    return new URL(`/v1/indexer/asset/${encodeURIComponent(id)}`, UPSTREAM);
  }
  return undefined;
}

export async function proxySignetArkadeRead(request: Request, fetcher: typeof fetch = fetch): Promise<Response> {
  if (request.method !== 'GET') return Response.json({ error: 'Arkade proxy only permits read requests.' }, { status: 405, headers: { Allow: 'GET' } });
  const target = allowedSignetArkadeRead(new URL(request.url));
  if (!target) return Response.json({ error: 'Arkade read route is not allowed.' }, { status: 404 });
  try {
    const upstream = await fetcher(target, { method: 'GET', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10_000), headers: { Accept: 'application/json' } });
    const type = upstream.headers.get('content-type') ?? '';
    if (!type.toLowerCase().includes('application/json')) return Response.json({ error: 'Arkade response type is unavailable.' }, { status: 502 });
    const length = Number(upstream.headers.get('content-length'));
    if (Number.isFinite(length) && length > MAX_RESPONSE_BYTES) return Response.json({ error: 'Arkade response is too large.' }, { status: 502 });
    if (!upstream.body) return Response.json({ error: 'Arkade response is empty.' }, { status: 502 });
    const reader = upstream.body.getReader(), chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) { await reader.cancel(); return Response.json({ error: 'Arkade response is too large.' }, { status: 502 }); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return new Response(bytes, { status: upstream.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch {
    return Response.json({ error: 'Signet Arkade read service is unavailable.' }, { status: 502 });
  }
}
