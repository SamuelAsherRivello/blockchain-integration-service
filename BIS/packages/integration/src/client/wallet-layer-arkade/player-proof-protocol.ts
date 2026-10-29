import type { TestNetwork } from '../state-layer-core/test-network.ts';

export type PlayerProofBinding = Readonly<{ audience: string; gameId: string; network: TestNetwork; profileId: string; operationId: string }>;
export type PlayerChallenge = PlayerProofBinding & Readonly<{ playerPublicKey: string; nonce: string; expires: number; purpose: 'bis-player-proof-v1' }>;

/** Both peers hash this fixed, domain-separated message. Never sign an opaque
 * server-supplied digest or a transaction disguised as an authentication proof.
 */
export function playerProofMessage(scope: PlayerChallenge): Uint8Array {
  if (scope.purpose !== 'bis-player-proof-v1' || !['signet', 'mutinynet'].includes(scope.network) ||
    !/^[a-zA-Z0-9-]{1,100}$/.test(scope.gameId) || !/^[a-zA-Z0-9-]{1,100}$/.test(scope.operationId) ||
    !/^[a-f0-9]{64}$/.test(scope.profileId) || !/^0[23][a-f0-9]{64}$/.test(scope.playerPublicKey) ||
    !/^[a-f0-9-]{36}$/.test(scope.nonce) || !Number.isSafeInteger(scope.expires)) throw Error('Invalid player proof scope.');
  const audience = new URL(scope.audience);
  if (audience.protocol !== 'https:' || audience.origin !== scope.audience) throw Error('Invalid player proof audience.');
  return new TextEncoder().encode(JSON.stringify(['BIS player proof of possession, not a payment', scope.purpose,
    scope.audience, scope.gameId, scope.network, scope.profileId, scope.operationId, scope.playerPublicKey, scope.nonce, scope.expires]));
}

export const playerProofClientClockSkewMs = 5000;

export function assertPlayerChallenge(scope: PlayerChallenge, expected: PlayerProofBinding & { playerPublicKey: string }, now = Date.now(), maximumFutureSkewMs = 0) {
  playerProofMessage(scope);
  if (!Number.isSafeInteger(maximumFutureSkewMs) || maximumFutureSkewMs < 0 || maximumFutureSkewMs > playerProofClientClockSkewMs ||
    Object.entries(expected).some(([key, value]) => Reflect.get(scope, key) !== value) || scope.expires <= now || scope.expires > now + 60000 + maximumFutureSkewMs) throw Error('Player proof scope or deadline changed.');
}
