import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkDeploymentPreflight } from './deployment-preflight.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const bundle = resolve(root, 'dist/deployment/api/index.mjs');
const input = process.argv[2];
if (!input) throw Error('Pass a sanitized read-only Vercel/Redis inspection snapshot; credentials and environment values are forbidden.');
const snapshotBytes = await readFile(resolve(input));
if (snapshotBytes.byteLength > 1_000_000) throw Error('Inspection snapshot exceeds the size limit.');
const bundleBytes = await readFile(bundle);
let snapshot: unknown;
try { snapshot = JSON.parse(snapshotBytes.toString('utf8')); }
catch { throw Error('Inspection snapshot is not valid JSON.'); }
const bundleSha256 = createHash('sha256').update(bundleBytes).digest('hex');
const failures = checkDeploymentPreflight(snapshot, bundleSha256);
const result = {
  schemaVersion: 1,
  checkedAt: new Date().toISOString(),
  result: failures.length ? 'blocked' : 'passed',
  sourceBundleSha256: bundleSha256,
  snapshotSha256: createHash('sha256').update(snapshotBytes).digest('hex'),
  checks: failures.length ? { failed: failures } : { passed: 15 },
  scope: 'Sanitized read-only configuration evidence only; does not deploy, inspect secrets, test live signing or qualify funded workflows.',
};
const reportDirectory = resolve(root, '../../../output/reports/bis-server/milestone-1');
await mkdir(reportDirectory, { recursive: true });
const reportPath = resolve(reportDirectory, `deployment-preflight-${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}.json`);
await writeFile(reportPath, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(result));
assert.equal(failures.length, 0, `Deployment preflight blocked: ${failures.join(', ')}`);
