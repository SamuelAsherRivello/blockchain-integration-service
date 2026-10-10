import test from 'node:test';
import assert from 'node:assert/strict';
import { ArkAddress } from '@arkade-os/sdk';
import { ALLOWED_AMOUNTS, createFaucetService, createRateLimiter, decodeArkadeAddress, validateArkadeAddress, validateAmount } from '../src/shared/faucet-core.mjs';
import { parseArgs, parseSats, requestFunding } from '../scripts/fund-address.mjs';
import { addressScript, parseArgs as parseBalanceArgs, queryBalance } from '../scripts/get-balance.mjs';

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
