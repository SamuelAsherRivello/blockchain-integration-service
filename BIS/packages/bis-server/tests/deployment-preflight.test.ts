import assert from 'node:assert/strict';
import test from 'node:test';
import { checkDeploymentPreflight, type DeploymentPreflightSnapshot } from '../scripts/deployment-preflight.ts';

const productionNames = ['BIS_GAME_ID', 'BIS_OWNER_TOKEN', 'BIS_SIGNING_DAILY_CAP_SATS', 'BIS_SIGNING_OPERATION_CAP_SATS',
  'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN',
  ...(['SIGNET', 'MUTINYNET'] as const).flatMap(network => ['01', '02', '03'].map(slot => `BIS_GAME_WALLET_${network}_${slot}_MNEMONIC`))];
const previewNames = productionNames.map(name => name.startsWith('BIS_') ? `BIS_PREVIEW_${name.slice(4)}` : `BIS_PREVIEW_${name}`);
const snapshot: DeploymentPreflightSnapshot = {
  schemaVersion: 1,
  project: { id: 'prj_fB8jmOumMbfEabORTxeVxTysjXVx', organizationId: 'team_WmJXbDRfQvVbFiB3uUicIoIR', name: 'bis-server', plan: 'hobby', rootDirectory: 'BIS/packages/bis-server',
    withinFreeTier: true, functionInvocationsUsed: 10, functionInvocationsLimit: 100_000, quotaExceeded: false },
  preview: { url: 'https://bis-server-preview-123.vercel.app', target: 'preview', state: 'READY', runtime: 'nodejs24.x', protectionEnabled: true,
    bundleSha256: 'a'.repeat(64), environmentNames: [...previewNames], identities: { signet: 'b'.repeat(64), mutinynet: 'c'.repeat(64) },
    operationCapSats: 5_000, dailyCapSats: 10_000, publicSigning: false },
  production: { environmentNames: [...productionNames], identities: { signet: 'd'.repeat(64), mutinynet: 'e'.repeat(64) } },
  storage: { provider: 'upstash-redis', plan: 'free', status: 'ready', autoUpgrade: false, prodPack: false, eviction: false,
    monthlyCommandsUsed: 12_000, freeMonthlyCommandLimit: 500_000, quotaExceeded: false },
};

test('accepts a matching protected Node 24 Preview on free infrastructure with isolated wallet identities', () => {
  assert.deepEqual(checkDeploymentPreflight(snapshot, 'a'.repeat(64)), []);
});

test('accepts the deployed KV REST aliases and the documented default game ID', () => {
  const compatible = structuredClone(snapshot);
  for (const environment of [compatible.preview.environmentNames, compatible.production.environmentNames]) {
    const prefix = environment === compatible.preview.environmentNames ? 'BIS_PREVIEW_' : '';
    environment.splice(environment.indexOf(prefix ? `${prefix}GAME_ID` : 'BIS_GAME_ID'), 1);
    environment.splice(environment.indexOf(`${prefix}UPSTASH_REDIS_REST_URL`), 1, `${prefix}KV_REST_API_URL`);
    environment.splice(environment.indexOf(`${prefix}UPSTASH_REDIS_REST_TOKEN`), 1, `${prefix}KV_REST_API_TOKEN`);
  }
  assert.deepEqual(checkDeploymentPreflight(compatible, 'a'.repeat(64)), []);
});

test('rejects mismatched artifact, incomplete environment names, shared identities, raised caps, paid upgrades and enabled public signing', () => {
  const unsafe = structuredClone(snapshot);
  unsafe.preview.bundleSha256 = 'f'.repeat(64);
  unsafe.preview.environmentNames.pop();
  unsafe.production.identities.signet = unsafe.preview.identities.signet;
  unsafe.preview.operationCapSats = 5_001;
  unsafe.preview.dailyCapSats = 10_001;
  unsafe.preview.publicSigning = true;
  unsafe.storage.autoUpgrade = true;
  unsafe.storage.eviction = true;
  unsafe.project.functionInvocationsUsed = 100_001;
  unsafe.storage.monthlyCommandsUsed = 500_001;
  const failures = checkDeploymentPreflight(unsafe, 'a'.repeat(64));
  assert.deepEqual(failures, ['within-free-vercel-quota', 'reviewed-bundle', 'required-preview-environment-names', 'separate-test-identities',
    'approved-test-caps', 'public-signing-remains-disabled', 'free-redis-no-upgrade', 'within-free-redis-quota']);
  assert.ok(!JSON.stringify(failures).includes('f'.repeat(64)));
});

test('does not echo untrusted values from malformed inspection data', () => {
  const failures = checkDeploymentPreflight({ project: { id: 'private-project-token-do-not-print' }, preview: { environmentValues: { BIS_OWNER_TOKEN: 'sentinel-only' } } }, 'a'.repeat(64));
  assert.ok(failures.length > 0);
  assert.ok(failures.includes('no-credential-fields'));
  assert.ok(!JSON.stringify(failures).includes('private'));
  assert.ok(!JSON.stringify(failures).includes('sentinel'));
});
