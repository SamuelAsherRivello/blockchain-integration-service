import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { GameNetwork } from './environment.ts';

export const signingDigest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const equal = (left: string, right: string) => {
  const a = Buffer.from(left), b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};
export type SigningScope = { gameId: string; network: GameNetwork; profileId: string; operationId: string; digest: string; expires: number; purpose: 'owner-signing' };
export type ConnectionScope = { gameId: string; network: GameNetwork; profileId: string; id: string; expires: number; purpose: 'connection' };
// The cryptographic secret also protects durable recovery. A separate bearer
// credential can change owner access without changing those existing keys.
export function createSigningAuthorization(ownerSecret: string | undefined, now = Date.now, ownerAccessToken: string | undefined = ownerSecret) {
  const configured = typeof ownerSecret === 'string' && ownerSecret.length >= 32;
  const ownerAccessConfigured = typeof ownerAccessToken === 'string' && ownerAccessToken.length >= 32;
  const mac = (value: string) => createHmac('sha256', ownerSecret!).update(`bis-signing-grant-v1:${value}`).digest('base64url');
  return {
    configured,
    connect(scope: Pick<ConnectionScope, 'gameId' | 'network' | 'profileId'>) {
      if (!configured) throw Error('Private owner authorization required.');
      const value = Buffer.from(JSON.stringify({ ...scope, id: randomUUID(), expires: now() + 600000, purpose: 'connection' })).toString('base64url');
      const signature = createHmac('sha256', ownerSecret!).update(`bis-connection-v1:${value}`).digest('base64url');
      return `${value}.${signature}`;
    },
    connection(token: string, expected: Pick<ConnectionScope, 'gameId' | 'network' | 'profileId'>, options: { allowExpiredForCompletedRead?: boolean } = {}): ConnectionScope {
      if (!configured || typeof token !== 'string' || token.length > 4096) throw Error('Connection authorization required.');
      const parts = token.split('.');
      const signature = createHmac('sha256', ownerSecret!).update(`bis-connection-v1:${parts[0]}`).digest('base64url');
      if (parts.length !== 2 || !equal(parts[1], signature)) throw Error('Connection authorization required.');
      const scope = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as ConnectionScope;
      if (scope.purpose !== 'connection' || !/^[a-f0-9-]{36}$/.test(scope.id) || !Number.isSafeInteger(scope.expires) || scope.expires <= 0 ||
        (!options.allowExpiredForCompletedRead && scope.expires <= now()) || scope.expires > now() + 600000 ||
        Object.entries(expected).some(([key, value]) => scope[key as keyof ConnectionScope] !== value)) throw Error('Connection authorization required.');
      return scope;
    },
    assertOwner(authorization: string | null) {
      if (!configured || !ownerAccessConfigured || !equal(authorization ?? '', `Bearer ${ownerAccessToken}`)) throw Error('Private owner authorization required.');
    },
    issue(authorization: string | null, scope: Omit<SigningScope, 'expires' | 'purpose'>) {
      this.assertOwner(authorization);
      if (!/^[0-9a-f]{64}$/.test(scope.digest) || !/^[0-9a-f]{64}$/.test(scope.profileId) || !/^[a-z0-9-]{1,100}$/i.test(scope.operationId) || !['signet', 'mutinynet'].includes(scope.network)) throw Error('Invalid signing scope.');
      const value = Buffer.from(JSON.stringify({ ...scope, expires: now() + 60000, purpose: 'owner-signing' })).toString('base64url');
      return `${value}.${mac(value)}`;
    },
    verify(grant: string, expected: Omit<SigningScope, 'expires' | 'purpose'>): SigningScope {
      if (!configured || typeof grant !== 'string' || grant.length > 4096) throw Error('Signing grant required.');
      const parts = grant.split('.');
      if (parts.length !== 2 || !equal(parts[1], mac(parts[0]))) throw Error('Signing grant invalid.');
      const scope = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as SigningScope;
      if (!Number.isSafeInteger(scope.expires) || scope.expires <= now() || scope.expires > now() + 60000 || scope.purpose !== 'owner-signing' || Object.entries(expected).some(([key, value]) => scope[key as keyof SigningScope] !== value)) throw Error('Signing grant expired or scope changed.');
      return scope;
    },
  };
}
