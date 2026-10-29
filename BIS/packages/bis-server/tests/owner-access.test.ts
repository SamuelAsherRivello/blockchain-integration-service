import test from 'node:test';
import assert from 'node:assert/strict';
import { createSigningAuthorization, signingDigest } from '../src/server/signing-authorization.ts';
import { readPrivateEnvironment } from '../src/server/environment.ts';
import { createHostedHandler } from '../src/server/hosted.ts';

const recoverySecret = 'fixture-recovery-key-'.repeat(3);
const accessSecret = 'fixture-owner-access-'.repeat(3);
const replacementAccess = 'replacement-owner-access-'.repeat(3);
const now = () => 100000;
const binding = { gameId: 'stealth-and-steel', network: 'signet' as const, profileId: 'a'.repeat(64) };
const scope = { ...binding, operationId: 'owner-access-test', digest: signingDigest({ fixture: true }) };

test('separate owner access preserves original connections and grants across credential changes', () => {
  const legacy = createSigningAuthorization(recoverySecret, now);
  const previousConnection = legacy.connect(binding);
  const previousGrant = legacy.issue(`Bearer ${recoverySecret}`, scope);
  const separated = createSigningAuthorization(recoverySecret, now, accessSecret);
  separated.assertOwner(`Bearer ${accessSecret}`);
  assert.throws(() => separated.assertOwner(`Bearer ${recoverySecret}`), /authorization/);
  assert.deepEqual(separated.connection(previousConnection, binding), legacy.connection(previousConnection, binding));
  assert.deepEqual(separated.verify(previousGrant, scope), legacy.verify(previousGrant, scope));
  assert.equal(separated.issue(`Bearer ${accessSecret}`, scope), previousGrant);
  const changed = createSigningAuthorization(recoverySecret, now, replacementAccess);
  changed.assertOwner(`Bearer ${replacementAccess}`);
  assert.throws(() => changed.assertOwner(`Bearer ${accessSecret}`), /authorization/);
  assert.equal(changed.issue(`Bearer ${replacementAccess}`, scope), previousGrant);
  assert.deepEqual(changed.connection(previousConnection, binding), legacy.connection(previousConnection, binding));
});

test('absent access credential retains legacy compatibility; explicit invalid credentials fail closed', () => {
  createSigningAuthorization(recoverySecret, now).assertOwner(`Bearer ${recoverySecret}`);
  for (const invalid of ['', 'short']) {
    const auth = createSigningAuthorization(recoverySecret, now, invalid);
    assert.throws(() => auth.assertOwner(`Bearer ${recoverySecret}`), /authorization/);
    assert.throws(() => auth.assertOwner(`Bearer ${invalid}`), /authorization/);
    assert.equal(auth.configured, true);
  }
  assert.throws(() => createSigningAuthorization(undefined, now, accessSecret).assertOwner(`Bearer ${accessSecret}`), /authorization/);
});

test('Preview never inherits the Production owner-access credential', () => {
  const production = { BIS_OWNER_TOKEN: recoverySecret, BIS_OWNER_ACCESS_TOKEN: accessSecret };
  const isolated = readPrivateEnvironment({ hosted: true, env: { ...production, VERCEL_ENV: 'preview', BIS_PREVIEW_OWNER_TOKEN: 'preview-recovery-'.repeat(3) } });
  assert.equal(isolated.BIS_OWNER_ACCESS_TOKEN, undefined);
  const preview = readPrivateEnvironment({ hosted: true, env: { ...production, VERCEL_ENV: 'preview', BIS_PREVIEW_OWNER_ACCESS_TOKEN: replacementAccess } });
  assert.equal(preview.BIS_OWNER_ACCESS_TOKEN, replacementAccess);
  assert.equal(readPrivateEnvironment({ hosted: true, env: { ...production, VERCEL_ENV: 'production' } }).BIS_OWNER_ACCESS_TOKEN, accessSecret);
});

test('hosted owner authorization accepts the separate credential while returning no credentials', async () => {
  const pool = { original: async () => ({ network: 'signet', profileId: binding.profileId }) } as any;
  const handler = createHostedHandler({ env: { BIS_OWNER_TOKEN: recoverySecret, BIS_OWNER_ACCESS_TOKEN: accessSecret, BIS_PUBLIC_SIGNING_NETWORKS: 'signet' }, now, pool });
  const call = (token: string) => handler(new Request('https://example.test/api/bis/authorize', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ request: { network: binding.network, profileId: binding.profileId, method: 'signMessage' }, operationId: scope.operationId }),
  }));
  const accepted = await call(accessSecret);
  const acceptedText = await accepted.text();
  assert.equal(accepted.status, 200);
  assert.equal(acceptedText.includes(accessSecret), false);
  assert.equal(acceptedText.includes(recoverySecret), false);
  assert.notEqual((await call(recoverySecret)).status, 200);
});
