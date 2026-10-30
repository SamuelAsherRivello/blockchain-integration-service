import assert from 'node:assert/strict';
import test from 'node:test';
import { ArkAddress, OnchainWallet, RestArkProvider, Wallet, Ramps } from '@arkade-os/sdk';
import { runDemo as balance } from '../src/client/demos/get-balance-private.ts';
import { runDemo as send } from '../src/client/demos/send-payment.ts';
import { runDemo as mint } from '../src/client/demos/mint-asset.ts';
import { runDemo as onboard } from '../src/client/demos/onboard-bitcoin.ts';
import { runDemo as offboard } from '../src/client/demos/offboard-bitcoin.ts';
import { runDemo as externalPayment } from '../src/client/demos/external-wallet-payment.ts';
import { runDemo as publicBalance } from '../src/client/demos/get-balance-public.ts';
import { runDemo as receivePayment } from '../src/client/demos/receive-payment.ts';
import { runDemo as receiveAsset } from '../src/client/demos/receive-asset.ts';
import { runDemo as publicAssets } from '../src/client/demos/asset-history-public.ts';
import { runDemo as privateAssets } from '../src/client/demos/asset-history-private.ts';
import { runDemo as history } from '../src/client/demos/payment-history.ts';
import { runDemo as sendAsset } from '../src/client/demos/send-asset.ts';
import { demoSetInput, DEFAULT_WALLET_1_ADDRESSES } from '../src/client/navigation.ts';

function storage(t) {
  const values = new Map<string, string>();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) } });
  t.after(() => original ? Object.defineProperty(globalThis, 'localStorage', original) : Reflect.deleteProperty(globalThis, 'localStorage'));
  return values;
}

test('public balance, payment receipt and asset reads use the selected network and SDK-decoded script', async t => {
  storage(t);
  const requests: URL[] = [];
  t.mock.method(globalThis, 'fetch', async url => {
    requests.push(new URL(String(url)));
    return new Response(JSON.stringify({ vtxos: [
      { txid: 'ab'.repeat(32), amount: '123', assets: [{ assetId: 'owned', amount: '1' }] },
      { txid: 'cd'.repeat(32), amount: '77', assets: [{ assetId: 'other', amount: '1' }] },
    ] }));
  });
  for (const network of ['signet', 'mutinynet'] as const) {
    demoSetInput(network, 'asset-id', '0001');
    demoSetInput(network, 'asset-id-0001', 'owned');
    const address = DEFAULT_WALLET_1_ADDRESSES[network];
    const balance = await publicBalance({ network });
    assert.match(balance.output, /Available: 200 sats/);
    assert.match(balance.output, /Success: true$/);
    assert.match((await receivePayment({ network })).output, /Total: 200 sats/);
    assert.match((await receiveAsset({ network })).output, /VTXOs: 1/);
    const assets = await publicAssets({ network });
    assert.match(assets.output, /owned/);
    assert.doesNotMatch(assets.output, /other/);
    const script = Buffer.from(ArkAddress.decode(address).pkScript).toString('hex');
    for (const url of requests.splice(0)) {
      assert.equal(url.origin, `https://${network}.arkade.sh`);
      assert.equal(url.searchParams.get('scripts'), script);
    }
  }
});

test('borrowed wallet setup preserves payment history, asset filtering and the actual asset send request', async t => {
  storage(t);
  const network = 'signet';
  demoSetInput(network, 'wallet-2-mnemonic', 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
  demoSetInput(network, 'asset-id', '0001');
  demoSetInput(network, 'asset-id-0001', 'owned');
  demoSetInput(network, 'asset-payment-sats', '100');
  let disposed = 0, sent;
  t.mock.method(Wallet, 'create', async () => ({
    getContractManager: async () => ({ refreshVtxos: async () => {} }), getVtxos: async () => [],
    getActivityHistory: async () => [
      { type: 'owned activity', txs: [{ assets: [{ assetId: 'owned' }] }] },
      { type: 'other activity', txs: [{ assets: [{ assetId: 'other' }] }] },
    ],
    send: async value => { sent = value; return 'ef'.repeat(32); },
    dispose: async () => { disposed++; },
  }) as never);
  assert.match((await history({ network })).output, /Activities: 2/);
  const assets = await privateAssets({ network });
  assert.match(assets.output, /Activities: 1/);
  assert.match(assets.output, /owned activity/);
  assert.doesNotMatch(assets.output, /other activity/);
  assert.match((await sendAsset({ network })).output, /Success: true$/);
  assert.deepEqual(sent, { address: DEFAULT_WALLET_1_ADDRESSES.signet, amount: 330, assets: [{ assetId: 'owned', amount: 1n }] });
  assert.equal(disposed, 3);
});

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

test('mint keeps its selected AssetID and reports a failed prerequisite without writing a mapping', async t => {
  const values = storage(t);
  demoSetInput('signet', 'asset-id', '0007');
  const result = await mint({ network: 'signet' });
  assert.match(result.output, /^AssetID: 0007\nError: Enter Wallet 2 Mnemonic/);
  assert.match(result.output, /Success: false$/);
  assert.equal(values.has('signet-asset-id-0007'), false);
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
    getAddress: async () => 'fixture-arkade-address',
    arkProvider: { getInfo: async () => ({ fees }) },
    dispose: async () => { disposed++; },
  } as any));
  t.mock.method(Ramps.prototype, 'onboard', async function (actualFees) {
    assert.deepEqual(actualFees, fees);
    throw new Error('fixture boarding not funded');
  });
  const result = await onboard({ network: 'signet' });
  assert.match(result.output, /^Boarding from address: fixture-boarding-address\nBoarding to address: fixture-arkade-address\nNext: check the Onboarding page before retrying\./);
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
    getAddress: async () => 'fixture-arkade-address',
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
  assert.match(result.output, /Offboarding from address: fixture-arkade-address\nOffboarding to address: fixture-bitcoin-destination/);
  assert.match(result.output, /Offboarding Transaction ID: fixture-offboard-receipt\nSuccess: true$/);
  assert.equal(disposed, 1);
});

test('external payment links use each entered amount and await approval', async t => {
  storage(t);
  const listeners = new Map<string, (event: any) => void>();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const origin = 'http://127.0.0.1:5174';
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    location: { href: `${origin}/prototype-sandbox/demo-12/?old=callback#fragment`, origin },
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: type => listeners.delete(type),
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  } });
  t.after(() => original ? Object.defineProperty(globalThis, 'window', original) : Reflect.deleteProperty(globalThis, 'window'));
  t.mock.method(RestArkProvider.prototype, 'getInfo', async function () {
    return { network: 'signet', signerPubkey: Buffer.from(ArkAddress.decode(DEFAULT_WALLET_1_ADDRESSES.signet).serverPubKey).toString('hex') } as any;
  });
  for (const [amount, bitcoin] of [['1234', '0.00001234'], ['250', '0.0000025']]) {
    const popup = { closed: false, location: { href: 'about:blank' }, close() { this.closed = true; } };
    const pending = externalPayment({ network: 'signet', amount, externalWalletWindow: popup });
    await new Promise(resolve => setImmediate(resolve));
    const wallet = new URL(popup.location.href);
    const request = new URL(wallet.searchParams.get('request')!);
    assert.equal(request.searchParams.get('amount'), bitcoin);
    assert.equal(request.searchParams.get('ark'), DEFAULT_WALLET_1_ADDRESSES.signet);
    assert.equal(wallet.searchParams.get('callback'), 'http://127.0.0.1:5174/prototype-sandbox/demo-12/');
    listeners.get('message')!({ origin, source: popup, data: { source: 'bis-external-wallet', search: `?status=sent&txid=${'ab'.repeat(32)}` } });
    const result = await pending;
    assert.match(result.output, new RegExp(`Transaction ID: ${'ab'.repeat(32)}`));
    assert.match(result.output, /Success: true$/);
    assert.equal(popup.closed, true);
  }
  await assert.rejects(externalPayment({ network: 'signet', amount: '0', externalWalletWindow: { closed: false, location: { href: 'about:blank' }, close() {} } }), /whole-satoshi amount/);
});
