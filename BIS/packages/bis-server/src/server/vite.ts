import type { IncomingMessage, ServerResponse } from 'node:http';
import { createLocalSigner } from './signer.ts';
import { loadSignerEnvironment, type SignerConfiguration } from './environment.ts';
import { createWalletPool } from './wallet-pool.ts';

const json = (response: ServerResponse, code: number, value: unknown) => {
  response.statusCode = code; response.setHeader('Content-Type', 'application/json'); response.setHeader('Cache-Control', 'no-store'); response.end(JSON.stringify(value));
};
export function createSignerMiddleware(config: SignerConfiguration = loadSignerEnvironment()) {
  const signer = createLocalSigner(config);
  const pooled = Object.values(config.walletEnvironment ?? {}).some(value => value?.trim());
  const pool = createWalletPool(pooled ? config.walletEnvironment! : { [`BIS_GAME_WALLET_${config.network.toUpperCase()}_01_MNEMONIC`]: config.mnemonic });
  const signers = new Map<string, ReturnType<typeof createLocalSigner>>();
  const selectedSigner = async (network: 'signet' | 'mutinynet', profileId?: string, requirement = {}) => {
    if (!pooled) {
      if (network !== config.network) throw Error('Game signer network mismatch.');
      if (Object.keys(requirement).length) await pool.select(network, requirement);
      return signer;
    }
    const wallet = profileId ? await pool.original(network, profileId) : await pool.select(network, requirement);
    const key = `${network}:${wallet.profileId}`;
    let selected = signers.get(key);
    if (!selected) { selected = createLocalSigner({ ...config, ...wallet }); signers.set(key, selected); }
    return selected;
  };
  async function middleware(request: IncomingMessage, response: ServerResponse, next: (error?: unknown) => void) {
    const path = (request.url ?? '').split('?')[0];
    if (!path.startsWith('/api/bis/')) { next(); return; }
    if (config.enabled === false || (!config.mnemonic && !pooled)) { json(response, 404, { error: 'Game signer disabled or not configured.' }); return; }
    // This adapter grants developer signing authority only on a loopback host.
    // It cannot become a public signer merely by binding Vite to 0.0.0.0.
    const host = request.headers.host ?? '';
    if (process.env.VERCEL || !/^(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(host) || (request.headers.origin && request.headers.origin !== `http://${host}`) || request.headers['sec-fetch-site'] === 'cross-site') {
      json(response, 403, { error: 'Local game signer access denied.' }); return;
    }
    try {
      if (path === '/api/bis/identity' && request.method === 'GET') {
        const network = new URL(request.url!, 'http://localhost').searchParams.get('network') ?? config.network;
        if (network !== 'signet' && network !== 'mutinynet') throw Error('Invalid network.');
        json(response, 200, await (await selectedSigner(network)).info()); return;
      }
      if (!['/api/bis/sign', '/api/bis/connect'].includes(path) || request.method !== 'POST') { json(response, 404, { error: 'Signer route not found.' }); return; }
      if (request.headers['content-type'] !== 'application/json') { json(response, 415, { error: 'JSON required.' }); return; }
      const chunks: Buffer[] = []; let size = 0;
      for await (const chunk of request) { size += chunk.length; if (size > 1024 * 1024) { json(response, 413, { error: 'Signer request too large.' }); return; } chunks.push(Buffer.from(chunk)); }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      if (!body || Array.isArray(body) || typeof body !== 'object') throw Error('Invalid request.');
      const network = body.network ?? config.network;
      if (network !== 'signet' && network !== 'mutinynet') throw Error('Invalid network.');
      if (path === '/api/bis/connect') {
        if (body.profileId !== undefined && (typeof body.profileId !== 'string' || !/^[0-9a-f]{64}$/.test(body.profileId) || body.requirement !== undefined)) throw Error('Invalid original game wallet request.');
        const connection = await (await selectedSigner(network, body.profileId, body.requirement)).connect();
        if (body.profileId !== undefined && connection.profileId !== body.profileId) throw Error('Original game wallet unavailable.');
        json(response, 200, connection); return;
      }
      const token = request.headers.authorization?.replace(/^Bearer /, '') ?? '';
      const result = await (await selectedSigner(network, body.profileId)).request(token, body);
      json(response, 200, { result });
    } catch { json(response, 503, { error: 'Game signer unavailable, invalid request or signing session expired.' }); }
  }
  return { middleware, dispose: () => { signer.dispose(); for (const selected of signers.values()) selected.dispose(); signers.clear(); } };
}
export function bisSignerPlugin(config?: ReturnType<typeof loadSignerEnvironment>) {
  return { name: 'bis-server-signer', enforce: 'pre' as const, configureServer(server: { middlewares: { use: (handler: ReturnType<typeof createSignerMiddleware>['middleware']) => void }; httpServer: { once: (event: string, handler: () => void) => void } | null }) {
    const signer = createSignerMiddleware(config); server.middlewares.use(signer.middleware); server.httpServer?.once('close', signer.dispose);
  } };
}
