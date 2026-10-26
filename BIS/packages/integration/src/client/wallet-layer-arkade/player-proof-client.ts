import type { Identity } from '@arkade-os/sdk';
import { assertPlayerChallenge, playerProofMessage, type PlayerChallenge, type PlayerProofBinding } from './player-proof-protocol.ts';
import { toHex } from './server-wallet-protocol.ts';

/** App composition supplies the local Player identity. Only its public key and
 * a typed proof leave the client. No phrase, owner token or arbitrary digest.
 */
export async function authenticatePlayerProof(options: {
  endpoint: string; identity: Identity; binding: Omit<PlayerProofBinding, 'audience'>;
  signal: AbortSignal; fetcher?: typeof fetch; now?: () => number;
}) {
  const endpoint = new URL(options.endpoint);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw Error('Player proof requires the configured HTTPS backend.');
  const base = endpoint.href.endsWith('/') ? endpoint.href : endpoint.href + '/';
  const binding = { ...options.binding, audience: endpoint.origin };
  const signal = AbortSignal.any([options.signal, AbortSignal.timeout(15000)]), fetcher = options.fetcher ?? fetch;
  signal.throwIfAborted();
  const playerPublicKey = toHex(await options.identity.compressedPublicKey());
  const send = async (path: string, body: unknown) => {
    signal.throwIfAborted();
    const response = await fetcher(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal, redirect: 'error', cache: 'no-store' });
    if (!response.ok) throw Error('Player proof was refused by the configured backend.');
    return response.json();
  };
  const challenge = await send('player/challenge', { ...options.binding, playerPublicKey });
  const scope = challenge.scope as PlayerChallenge;
  assertPlayerChallenge(scope, { ...binding, playerPublicKey }, options.now?.() ?? Date.now());
  if (typeof challenge.challenge !== 'string' || challenge.challenge.length > 4096) throw Error('Invalid player challenge.');
  const message = new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(playerProofMessage(scope))));
  signal.throwIfAborted();
  const signature = toHex(await options.identity.signMessage(message, 'schnorr'));
  signal.throwIfAborted();
  const result = await send('player/authenticate', { ...options.binding, challenge: challenge.challenge, signature });
  signal.throwIfAborted();
  const now = options.now?.() ?? Date.now();
  if (typeof result.token !== 'string' || !result.token || result.token.length > 4096 || !Number.isSafeInteger(result.expires) || result.expires <= now || result.expires > now + 600000) throw Error('Invalid player authority response.');
  return Object.freeze({ token: result.token as string, expires: result.expires as number, playerPublicKey });
}
