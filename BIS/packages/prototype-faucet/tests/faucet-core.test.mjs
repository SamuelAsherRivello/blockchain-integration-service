import test from 'node:test';
import assert from 'node:assert/strict';
import { ArkAddress } from '@arkade-os/sdk';
import { ALLOWED_AMOUNTS, createFaucetService, createRateLimiter, decodeArkadeAddress, safeError, validateArkadeAddress, validateAmount } from '../src/shared/faucet-core.mjs';
import { parseArgs, parseSats, requestFunding } from '../scripts/fund-address.mjs';
import { addressScript, parseArgs as parseBalanceArgs, queryBalance } from '../scripts/get-balance.mjs';
import { createFaucetApiLifecycle } from '../src/shared/faucet-api-lifecycle.mjs';
import { readFaucetBalance } from '../src/shared/faucet-wallet-state.mjs';

const serverKey = new Uint8Array(32).fill(3);
const destinationKey = new Uint8Array(32).fill(7);
const address = new ArkAddress(serverKey, destinationKey, 'tark').encode();
const info = { network: 'signet', signerPubkey: `02${Buffer.from(serverKey).toString('hex')}` };

test('decodes a test-network Arkade address and rejects malformed input', () => {
  assert.equal(decodeArkadeAddress(address).hrp, 'tark');
  assert.throws(() => decodeArkadeAddress('tark1not-an-address'), /valid Arkade/);
});

test('validates the selected operator identity, not only the tark prefix', () => {
  assert.equal(validateArkadeAddress(address, info, 'signet').network, 'signet');
  assert.throws(() => validateArkadeAddress(address, { ...info, network: 'mutinynet' }, 'signet'), /operator/);
  assert.throws(() => validateArkadeAddress(address, { ...info, signerPubkey: '04'.padEnd(66, 'a') }, 'signet'), /not a signet/);
});

test('accepts only the bounded prototype amounts', () => {
  assert.deepEqual(ALLOWED_AMOUNTS, [50_000, 100_000, 200_000]);
  assert.equal(validateAmount(100_000, 200_000), 100_000);
  for (const value of [0, -1, 1, 300_000, '100000.5']) assert.throws(() => validateAmount(value, 200_000));
});

test('sanitizes fee-estimation failures into an actionable onboarding message', () => {
  assert.deepEqual(safeError(new Error('failed to estimate fee rate: fee-estimation-unavailable')), { code: 'UNAVAILABLE', message: 'Arkade operator fee estimation is unavailable. Try again later.' });
});

test('server service validates, idempotently sends, and returns pending status', async () => {
  let sends = 0;
  const service = createFaucetService({
    infos: { signet: async () => info },
    wallets: { signet: { send: async request => { sends += 1; assert.equal(request.amount, 100_000); return { operationId: 'ark-tx-1', status: 'pending' }; } } },
    limits: { signet: 200_000 },
    limiter: createRateLimiter({ max: 5 }),
  });
  const input = { network: 'signet', address, amount: 100_000, idempotencyKey: 'same-request' };
  assert.equal((await service.request(input)).status, 'pending');
  assert.equal((await service.request(input)).operationId, 'ark-tx-1');
  assert.equal(sends, 1);
  await assert.rejects(() => service.request({ ...input, amount: 50_000 }), /already used/);
});

test('rate limits repeated destination requests', async () => {
  const service = createFaucetService({ infos: { signet: async () => info }, wallets: { signet: { send: async () => ({ operationId: crypto.randomUUID() }) } }, limiter: createRateLimiter({ max: 1 }) });
  await service.request({ network: 'signet', address, amount: 50_000, idempotencyKey: 'one' });
  await assert.rejects(() => service.request({ network: 'signet', address, amount: 50_000, idempotencyKey: 'two' }), /rate limit/);
});

test('funding CLI requires an explicit amount and accepts sats or k notation', () => {
  assert.equal(parseSats('50000'), 50_000);
  assert.equal(parseSats('50k'), 50_000);
  assert.throws(() => parseArgs(['--address', 'tark1example', '--network', 'signet']), /--amount is required/);
  assert.throws(() => parseSats('25k'), /one of 50000/);
});

test('funding CLI serializes the selected network, address, amount, and idempotency key', async () => {
  let request;
  const result = await requestFunding(
    parseArgs(['--address', 'tark1example', '--network', 'signet', '--amount', '100k', '--idempotency-key', 'test-request']),
    async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify({ operationId: 'op-1', status: 'pending' }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  );
  assert.deepEqual(result, { operationId: 'op-1', status: 'pending' });
  assert.equal(request.url, 'http://127.0.0.1:5190/api/faucet/request');
  assert.deepEqual(JSON.parse(request.init.body), { network: 'signet', address: 'tark1example', amount: 100_000, idempotencyKey: 'test-request' });
});

test('balance CLI requires network and address and reports indexed sats', async () => {
  assert.throws(() => parseBalanceArgs(['--network', 'signet']), /--address is required/);
  assert.throws(() => parseBalanceArgs(['--address', address]), /--network is required/);
  const result = await queryBalance(parseBalanceArgs(['--address', address, '--network', 'signet']), {
    arkProvider: { getInfo: async () => info },
    indexerProvider: { getVtxos: async ({ scripts }) => {
      assert.deepEqual(scripts, [addressScript(address)]);
      return { vtxos: [{ amount: 50_000 }, { amount: 25_000 }] };
    } },
  });
  assert.deepEqual(result, { network: 'signet', address, balanceSats: 75_000, vtxoCount: 2 });
});

test('faucet balance reads do not prepare or settle the wallet', async () => {
  let prepared = false;
  const result = await readFaucetBalance({
    getBalance: async () => ({ total: 300_000n, available: 0n, settled: 0n, preconfirmed: 0n, recoverable: 0n }),
    prepare: async () => { prepared = true; throw new Error('fee-estimation-unavailable'); },
  });
  assert.deepEqual(result, { total: 300_000, available: 0, settled: 0, preconfirmed: 0, recoverable: 0 });
  assert.equal(prepared, false);
});

test('faucet API lifecycle reuses a healthy API and starts one child only when needed', async () => {
  let fetchCalls = 0;
  let spawns = 0;
  let killed = 0;
  const lifecycle = createFaucetApiLifecycle({
    apiPort: 5190,
    packageRoot: 'package-root',
    processPath: 'node',
    env: {},
    fetchImpl: async () => { fetchCalls += 1; return new Response('', { status: fetchCalls === 1 ? 503 : 200 }); },
    spawnImpl: (...args) => { spawns += 1; return { args, kill: () => { killed += 1; } }; },
    waitMs: 0,
    attempts: 3,
  });
  assert.deepEqual(await lifecycle.start(), { started: true });
  assert.equal(spawns, 1);
  lifecycle.close();
  assert.equal(killed, 1);
});

test('faucet API lifecycle does not own or kill an already healthy API', async () => {
  let spawns = 0;
  const lifecycle = createFaucetApiLifecycle({
    fetchImpl: async () => new Response('', { status: 200 }),
    spawnImpl: () => { spawns += 1; return { kill() {} }; },
  });
  assert.deepEqual(await lifecycle.start(), { started: false });
  lifecycle.close();
  assert.equal(spawns, 0);
});

test('faucet API lifecycle fails boundedly when startup never becomes healthy', async () => {
  let killed = 0;
  const lifecycle = createFaucetApiLifecycle({
    fetchImpl: async () => new Response('', { status: 503 }),
    spawnImpl: () => ({ kill: () => { killed += 1; } }),
    waitMs: 0,
    attempts: 2,
  });
  await assert.rejects(() => lifecycle.start(), /could not be started or reached/);
  assert.equal(killed, 1);
});
