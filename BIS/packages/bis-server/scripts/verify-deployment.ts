import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { schnorr } from '@noble/curves/secp256k1.js';

const cli = process.argv[2], deployment = process.argv[3];
if (!cli || !deployment || !/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(deployment)) throw Error('Pass the installed Vercel CLI entry path and exact deployment HTTPS URL.');
const cwd = fileURLToPath(new URL('..', import.meta.url));
function call(path: string, body?: unknown) {
  const args = [cli, 'curl', path, '--deployment', deployment, '--scope', 'ashers-projects-d3be6036'];
  if (body) args.push('--', '--request', 'POST', '--header', 'Content-Type: application/json', '--data-raw', JSON.stringify(body));
  // Never forward verbose CLI stderr: deployment-access credentials may be in it.
  const result = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', windowsHide: true, timeout: 60000, maxBuffer: 1024 * 1024 });
  if (result.status !== 0) throw Error('Protected deployment verification request failed.');
  try { return JSON.parse(result.stdout); } catch { throw Error('Deployment did not return API JSON.'); }
}
const health = call('/api/bis/health');
if (health.storage !== 'ready' || health.service !== 'bis-server' || health.publicSigning !== false) throw Error('Unexpected readiness state.');
const networks = [];
for (const network of ['signet', 'mutinynet']) {
  const identity = call(`/api/bis/identity?network=${network}`);
  const proof = call('/api/bis/proof', { network });
  if (proof.network !== network || proof.profileId !== identity.profileId || proof.publicKey !== identity.publicKey || !schnorr.verify(Buffer.from(proof.signature, 'hex'), Buffer.from(proof.message, 'hex'), Buffer.from(proof.publicKey.slice(2), 'hex'))) throw Error('Deployed signature verification failed.');
  const denied = call('/api/bis/connect', { network, gameId: 'stealth-and-steel' });
  if (!denied.error) throw Error('Anonymous signing unexpectedly enabled.');
  networks.push({ network, slot: identity.slot, profileId: identity.profileId, publicKey: identity.publicKey, proofVerified: true, anonymousSigningDenied: true });
}
const report = { deployment, verifiedAt: new Date().toISOString(), health, networks, scope: 'Real deployed domain-separated message signatures and Redis availability only; no financial transactions, funded workflow acceptance or public signing parity.' };
const directory = fileURLToPath(new URL('../../../../output/reports/bis-server/milestone-1/', import.meta.url));
await mkdir(directory, { recursive: true });
await writeFile(resolve(directory, 'hosted-verification.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ deployment, storage: health.storage, validatedWallets: health.networks, verifiedSignatures: networks.length, publicSigning: false }));
