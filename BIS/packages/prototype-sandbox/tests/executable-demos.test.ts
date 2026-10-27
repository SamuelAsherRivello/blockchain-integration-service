import assert from 'node:assert/strict';
import test from 'node:test';
import { ArkAddress, OnchainWallet, RestArkProvider, Wallet, Ramps } from '@arkade-os/sdk';
import { runDemo as balance } from '../src/client/demos/get-balance-private.ts';
import { runDemo as send } from '../src/client/demos/send-payment.ts';
import { runDemo as onboard } from '../src/client/demos/onboard-bitcoin.ts';
import { runDemo as offboard } from '../src/client/demos/offboard-bitcoin.ts';
import { runDemo as externalPayment } from '../src/client/demos/external-wallet-payment.ts';
import { demoSetInput, DEFAULT_WALLET_1_ADDRESSES } from '../src/client/navigation.ts';

function storage(t) {
  const values = new Map<string, string>();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) } });
  t.after(() => original ? Object.defineProperty(globalThis, 'localStorage', original) : Reflect.deleteProperty(globalThis, 'localStorage'));
  return values;
}

test('executable balance reads current inputs on each call and disposes on SDK failure', async t => {
  storage(t);
  await assert.rejects(balance({ network: 'signet' }), /Enter Wallet 2 Mnemonic/);
  // Public deterministic test identity only. No network request is allowed.
  demoSetInput('signet', 'wallet-2-mnemonic', 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
  let disposed = 0;
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected network request'); });
  const sdk = t.mock.method(Wallet, 'create', async () => ({
    getBalance: async () => { throw new Error('fixture read failure'); },
    dispose: async () => { disposed++; },
  } as any));
  await assert.rejects(balance({ network: 'signet' }), /fixture read failure/);
  assert.equal(sdk.mock.callCount(), 1);
  assert.equal(disposed, 1);
  demoSetInput('signet', 'wallet-2-mnemonic', '');
  await assert.rejects(balance({ network: 'signet' }), /Enter Wallet 2 Mnemonic/);
  assert.equal(sdk.mock.callCount(), 1);
});

test('the executable send returns the actual SDK result and explorer target', async t => {
  storage(t);
  demoSetInput('mutinynet', 'wallet-2-mnemonic', 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
  let request, disposed = 0;
  t.mock.method(Wallet, 'create', async () => ({
    getContractManager: async () => ({ refreshVtxos: async () => {} }),
    getVtxos: async () => [],
    send: async value => { request = value; return 'fixture-sdk-receipt'; },
    dispose: async () => { disposed++; },
  } as any));
  const result = await send({ network: 'mutinynet' });
  assert.deepEqual(request, { address: DEFAULT_WALLET_1_ADDRESSES.mutinynet, amount: 100 });
  assert.match(result.output, /Transaction ID: fixture-sdk-receipt\nSuccess: true$/);
  assert.deepEqual(result.details?.explorer, { network: 'mutinynet', kind: 'ark-transaction', identifier: 'fixture-sdk-receipt' });
  assert.equal(disposed, 1);
});

test('onboarding supplies operator fees to the SDK and preserves the boarding address on failure', async t => {
  storage(t);
  demoSetInput('signet', 'wallet-2-mnemonic', 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
  const fees = { fixture: 'operator fee policy' };
  let disposed = 0;
  t.mock.method(Wallet, 'create', async () => ({
    getContractManager: async () => ({ refreshVtxos: async () => {} }),
    getVtxos: async () => [],
    getBoardingAddress: async () => 'fixture-boarding-address',
    arkProvider: { getInfo: async () => ({ fees }) },
    dispose: async () => { disposed++; },
  } as any));
  t.mock.method(Ramps.prototype, 'onboard', async function (actualFees) {
    assert.deepEqual(actualFees, fees);
    throw new Error('fixture boarding not funded');
  });
  const result = await onboard({ network: 'signet' });
  assert.match(result.output, /^Boarding Address: fixture-boarding-address\nNext: fund/);
  assert.match(result.output, /fixture boarding not funded\nSuccess: false$/);
  assert.equal(result.details?.explorer?.kind, 'bitcoin-address');
  assert.equal(disposed, 1);
});

test('offboarding reuses the created wallet identity and disposes it after submitting', async t => {
  storage(t);
  demoSetInput('signet', 'wallet-2-mnemonic', 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
  const identity = { fixture: 'existing wallet identity' };
  const fees = { fixture: 'operator fee policy' };
  let disposed = 0;
  t.mock.method(Wallet, 'create', async () => ({
    identity,
    getContractManager: async () => ({ refreshVtxos: async () => {} }),
    getVtxos: async () => [],
    arkProvider: { getInfo: async () => ({ fees }) },
    dispose: async () => { disposed++; },
  } as any));
  t.mock.method(OnchainWallet, 'create', async (actualIdentity, network) => {
    assert.equal(actualIdentity, identity);
    assert.equal(network, 'signet');
    return { address: 'fixture-bitcoin-destination' } as any;
  });
  t.mock.method(Ramps.prototype, 'offboard', async (destination, actualFees) => {
    assert.equal(destination, 'fixture-bitcoin-destination');
    assert.equal(actualFees, fees);
    return 'fixture-offboard-receipt';
  });
  const result = await offboard({ network: 'signet' });
  assert.match(result.output, /Bitcoin Destination: fixture-bitcoin-destination/);
  assert.match(result.output, /Offboarding Transaction ID: fixture-offboard-receipt\nSuccess: true$/);
  assert.equal(disposed, 1);
});

test('external payment links use each entered amount and await approval', async t => {
  storage(t);
  const opened: string[] = [];
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    location: { href: 'http://127.0.0.1:5174/prototype-sandbox/demo-12/?old=callback#fragment' },
    open: link => { opened.push(link); return {}; },
  } });
  t.after(() => original ? Object.defineProperty(globalThis, 'window', original) : Reflect.deleteProperty(globalThis, 'window'));
  t.mock.method(RestArkProvider.prototype, 'getInfo', async function () {
    return { network: 'signet', signerPubkey: Buffer.from(ArkAddress.decode(DEFAULT_WALLET_1_ADDRESSES.signet).serverPubKey).toString('hex') } as any;
  });
  for (const [amount, bitcoin] of [['1234', '0.00001234'], ['250', '0.0000025']]) {
    const result = await externalPayment({ network: 'signet', amount });
    const wallet = new URL(opened.at(-1)!);
    const request = new URL(wallet.searchParams.get('request')!);
    assert.equal(request.searchParams.get('amount'), bitcoin);
    assert.equal(request.searchParams.get('ark'), DEFAULT_WALLET_1_ADDRESSES.signet);
    assert.equal(wallet.searchParams.get('callback'), 'http://127.0.0.1:5174/prototype-sandbox/demo-12/');
    assert.deepEqual(result, { output: '', pending: true });
  }
  await assert.rejects(externalPayment({ network: 'signet', amount: '0' }), /whole-satoshi amount/);
  assert.equal(opened.length, 2);
});
