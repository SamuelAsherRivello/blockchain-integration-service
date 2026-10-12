import { readFileSync, lstatSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';

// Node-only, explicitly consumed by local server/runner entry points. No Vite_ exports.
export const sharedEnvironmentPath = fileURLToPath(new URL('../../.env.local', import.meta.url));
export const legacyFaucetEnvironmentPath = fileURLToPath(new URL('../../../prototype-faucet/.env.local', import.meta.url));
export const faucetEnvironmentKeys = Object.freeze([
  'FAUCET_SIGNET_MNEMONIC', 'FAUCET_MUTINYNET_MNEMONIC', 'FAUCET_SIGNET_MAX_SATS',
  'FAUCET_MUTINYNET_MAX_SATS', 'FAUCET_PORT', 'FAUCET_STATE_DIR',
]);
export const testAccountEnvironmentKeys = Object.freeze(Array.from({ length: 4 }, (_, i) => `BIS_TEST_ACCOUNT_${i + 1}_MNEMONIC`));
const allowed = new Set([...faucetEnvironmentKeys, ...testAccountEnvironmentKeys]);
export class SharedEnvironmentError extends Error {
  constructor(code) { super(code); this.code = code; }
}
function readPrivateEnvironment(path) {
  try {
    const info = lstatSync(path);
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size > 65536) throw new SharedEnvironmentError('shared-environment-invalid');
    return readFileSync(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    throw new SharedEnvironmentError('shared-environment-unavailable');
  }
}
export function readSharedEnvironment({ keys, env = process.env, read = readPrivateEnvironment, legacyFaucetFallback = false } = {}) {
  if (!Array.isArray(keys) || keys.some(key => !allowed.has(key))) throw new SharedEnvironmentError('shared-environment-invalid-keys');
  // Legacy fallback applies only while the canonical file is absent, never to
  // fill blank entries in an intentionally configured shared file.
  let input = read(sharedEnvironmentPath), source = 'shared';
  if (input === undefined && legacyFaucetFallback) {
    if (keys.some(key => !faucetEnvironmentKeys.includes(key))) throw new SharedEnvironmentError('shared-environment-invalid-fallback');
    input = read(legacyFaucetEnvironmentPath); source = 'legacy-faucet';
  }
  let parsed = {};
  try { if (input !== undefined) parsed = parseEnv(input); }
  catch { throw new SharedEnvironmentError('shared-environment-invalid'); }
  if (input === undefined) source = 'environment-only';
  const values = {};
  for (const key of keys) {
    const value = env[key] ?? parsed[key];
    if (value !== undefined) values[key] = value;
  }
  return { values, source };
}
export function loadFaucetEnvironment() {
  const { values, source } = readSharedEnvironment({ keys: faucetEnvironmentKeys, legacyFaucetFallback: true });
  for (const [key, value] of Object.entries(values)) if (process.env[key] === undefined) process.env[key] = value;
  return { source }; // Never return secret values to logging callers.
}
