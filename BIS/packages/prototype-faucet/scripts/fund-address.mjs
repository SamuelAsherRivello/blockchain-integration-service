import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const DEFAULT_API = 'http://127.0.0.1:5190';
export const ALLOWED_AMOUNTS = Object.freeze([50_000, 100_000, 200_000]);

function usageError(message) {
  const error = new Error(message);
  error.code = 'USAGE';
  return error;
}

export function parseSats(value) {
  const text = String(value ?? '').trim().toLowerCase().replaceAll(',', '');
  if (!text) throw usageError('--amount is required; use sats such as 50000 or 50k.');

  const amount = /^\d+k$/.test(text)
    ? Number.parseInt(text.slice(0, -1), 10) * 1_000
    : /^\d+$/.test(text)
      ? Number.parseInt(text, 10)
      : Number.NaN;

  if (!Number.isSafeInteger(amount) || !ALLOWED_AMOUNTS.includes(amount)) {
    throw usageError('--amount must be one of 50000, 100000, or 200000 sats (also written 50k, 100k, or 200k).');
  }
  return amount;
}

export function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw usageError(`Unexpected argument: ${token}`);
    const name = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw usageError(`Missing value for --${name}.`);
    values.set(name, value);
    index += 1;
  }

  const address = String(values.get('address') ?? '').trim();
  const network = String(values.get('network') ?? '').trim().toLowerCase();
  if (!address) throw usageError('--address is required.');
  if (!['signet', 'mutinynet'].includes(network)) throw usageError('--network must be signet or mutinynet.');

  return Object.freeze({
    address,
    network,
    amount: parseSats(values.get('amount')),
    api: String(values.get('api') ?? DEFAULT_API).replace(/\/$/, ''),
    idempotencyKey: String(values.get('idempotency-key') ?? randomUUID()),
  });
}

export async function requestFunding(options, fetchImpl = fetch) {
  const response = await fetchImpl(`${options.api}/api/faucet/request`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      network: options.network,
      address: options.address,
      amount: options.amount,
      idempotencyKey: options.idempotencyKey,
    }),
  });

  const body = await response.json().catch(() => ({ code: 'UNAVAILABLE', message: 'The faucet returned an invalid response.' }));
  if (!response.ok) {
    const error = new Error(body.message ?? 'The faucet request was rejected.');
    error.code = body.code ?? 'UNAVAILABLE';
    error.status = response.status;
    throw error;
  }
  return body;
}

async function isApiAvailable(api, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(`${api}/api/faucet/health`, { signal: AbortSignal.timeout(750) });
    return response.ok;
  } catch {
    return false;
  }
}

export async function ensureApi(options, fetchImpl = fetch) {
  if (await isApiAvailable(options.api, fetchImpl)) return false;
  if (!options.api.startsWith('http://127.0.0.1:') && !options.api.startsWith('http://localhost:')) return false;

  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const serverPath = path.join(packageRoot, 'src', 'server', 'server.mjs');
  await access(serverPath, fsConstants.R_OK);
  const server = spawn(process.execPath, ['--env-file-if-exists=.env.local', serverPath], {
    cwd: packageRoot,
    env: { ...process.env, FAUCET_PORT: new URL(options.api).port || '5190' },
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  server.unref();

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 250));
    if (await isApiAvailable(options.api, fetchImpl)) return true;
  }
  throw new Error('The local faucet API could not be started or reached.');
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    await ensureApi(options);
    const result = await requestFunding(options);
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(`${error.code ?? 'UNAVAILABLE'}: ${error.message}`);
    process.exitCode = error.code === 'USAGE' ? 2 : 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
