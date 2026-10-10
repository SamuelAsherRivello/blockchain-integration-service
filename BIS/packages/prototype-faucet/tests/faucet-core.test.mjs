import test from 'node:test';
import assert from 'node:assert/strict';
import { ArkAddress } from '@arkade-os/sdk';
import { ALLOWED_AMOUNTS, createFaucetService, createRateLimiter, decodeArkadeAddress, validateArkadeAddress, validateAmount } from '../src/shared/faucet-core.mjs';

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
