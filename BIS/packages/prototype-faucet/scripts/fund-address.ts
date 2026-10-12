import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readSharedEnvironment } from '../../shared/src/server/environment.ts';

export const DEFAULT_API = 'http://127.0.0.1:5190';
export const MIN_AMOUNT_SATS = 1;
export const MAX_AMOUNT_SATS = 100_000;

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

  if (!Number.isSafeInteger(amount) || amount < MIN_AMOUNT_SATS || amount > MAX_AMOUNT_SATS) {
    throw usageError('--amount must be a whole-satoshi value from 1 to 100000 (for example 25000 or 25k).');
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
    api: String(values.get('api') ?? (() => {
      const port = readSharedEnvironment({ keys: ['FAUCET_PORT'], legacyFaucetFallback: true }).values.FAUCET_PORT;
      if (port && (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)) throw usageError('FAUCET_PORT must be a valid local port.');
      return port ? `http://127.0.0.1:${Number(port)}` : DEFAULT_API;
    })()).replace(/\/$/, ''),
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
  const serverPath = path.join(packageRoot, 'src', 'server', 'server.ts');
  await access(serverPath, fsConstants.R_OK);
  const server = spawn(process.execPath, ['--experimental-eventsource', serverPath], {
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

