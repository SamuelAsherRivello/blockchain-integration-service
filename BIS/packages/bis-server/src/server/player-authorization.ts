import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { schnorr } from '@noble/curves/secp256k1.js';
import { playerProofMessage, assertPlayerChallenge, type PlayerProofBinding, type PlayerChallenge } from '../../../integration/src/client/wallet-layer-arkade/player-proof-protocol.ts';

type PlayerAuthority = PlayerProofBinding & { playerPublicKey: string; playerProfileId: string; expires: number; purpose: 'bis-player-authority-v1' };
const denied = () => Error('Player authorization required.');
export function createPlayerAuthorization(secret: string | undefined, now = Date.now) {
  const configured = typeof secret === 'string' && secret.length >= 32;
  const mac = (domain: string, value: string) => {
    if (!configured) throw denied();
    return createHmac('sha256', secret!).update(`${domain}:${value}`).digest();
  };
  const seal = (domain: string, scope: unknown) => {
    const value = Buffer.from(JSON.stringify(scope)).toString('base64url');
    return `${value}.${mac(domain, value).toString('base64url')}`;
  };
  const open = (domain: string, token: string) => {
    if (!configured || typeof token !== 'string' || token.length > 4096) throw denied();
    const parts = token.split('.');
    if (parts.length !== 2) throw denied();
    const expected = mac(domain, parts[0]), actual = Buffer.from(parts[1], 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw denied();
    return JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  };
  return {
    challenge(binding: PlayerProofBinding & { playerPublicKey: string }) {
      const scope: PlayerChallenge = { ...binding, nonce: randomUUID(), expires: now() + 60000, purpose: 'bis-player-proof-v1' };
      playerProofMessage(scope);
      return { scope, challenge: seal('bis-player-challenge-v1', scope) };
    },
    authenticate(challenge: string, signature: string, binding: PlayerProofBinding) {
      try {
        const scope = open('bis-player-challenge-v1', challenge) as PlayerChallenge;
        assertPlayerChallenge(scope, { ...binding, playerPublicKey: scope.playerPublicKey }, now());
        if (typeof signature !== 'string' || !/^[0-9a-f]{128}$/.test(signature)) throw denied();
        const message = createHash('sha256').update(playerProofMessage(scope)).digest();
        if (!schnorr.verify(Buffer.from(signature, 'hex'), message, Buffer.from(scope.playerPublicKey.slice(2), 'hex'))) throw denied();
        const authority: PlayerAuthority = { ...binding, playerPublicKey: scope.playerPublicKey,
          playerProfileId: createHash('sha256').update(Buffer.from(scope.playerPublicKey, 'hex')).digest('hex'), expires: now() + 600000, purpose: 'bis-player-authority-v1' };
        return { token: seal('bis-player-authority-v1', authority), expires: authority.expires };
      } catch { throw denied(); }
    },
    verify(token: string, binding: PlayerProofBinding): Readonly<PlayerAuthority> {
      try {
        const scope = open('bis-player-authority-v1', token) as PlayerAuthority;
        if (scope.purpose !== 'bis-player-authority-v1' || !Number.isSafeInteger(scope.expires) || scope.expires <= now() || scope.expires > now() + 600000 ||
          Object.entries(binding).some(([key, value]) => Reflect.get(scope, key) !== value) || !/^0[23][a-f0-9]{64}$/.test(scope.playerPublicKey)) throw denied();
        return Object.freeze(scope);
      } catch { throw denied(); }
    },
  };
}
