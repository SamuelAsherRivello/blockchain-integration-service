import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ADDRESS, DEFAULT_NETWORK, DEMOS, HOME_PATH, NETWORK_STORAGE_KEY, SETUP_PATH, formatSatsAsBitcoin, getActiveDemo, isHomePath, isSetupPath, setupMnemonicValues, setupNetworkValue, setupStorageValues, walletCallbackUrl, walletPaymentUrl, walletUrl } from '../src/client/navigation.ts';

test('defines twelve labeled demo routes', () => {
  assert.equal(DEMOS.length, 12);
  assert.deepEqual(DEMOS.map(demo => demo.path), Array.from({ length: 12 }, (_, index) => `/prototype-interactive-docs/demo-${index + 1}/`));
  assert.equal(DEMOS[0].subject, 'Get Wallet');
  assert.equal(DEMOS[1].subject, 'Get Balance');
  assert.equal(DEMOS[1].title, 'Private Wallet');
  assert.equal(DEMOS[2].title, 'Public Address');
  assert.equal(DEMOS[3].subject, 'Send Payment');
  assert.equal(DEMOS[9].subject, 'Asset History');
  assert.equal(DEMOS[9].title, 'Private Wallet');
  assert.equal(DEMOS[10].title, 'Public Address');
  assert.equal(DEMOS[11].subject, 'External Wallet');
  assert.equal(DEMOS[11].title, 'Approve Payment');
});

test('derives active demo from direct paths and defaults safely', () => {
  assert.equal(getActiveDemo('/prototype-interactive-docs/demo-4/'), 4);
  assert.equal(getActiveDemo('/prototype-interactive-docs/demo-6/'), 6);
  assert.equal(getActiveDemo('/prototype-interactive-docs/demo-10/'), 10);
  assert.equal(getActiveDemo('/prototype-interactive-docs/'), 1);
  assert.equal(getActiveDemo('/prototype-interactive-docs/demo-11/'), 11);
  assert.equal(getActiveDemo('/prototype-interactive-docs/demo-12/'), 12);
});

test('recognizes the home route separately from setup', () => {
  assert.equal(HOME_PATH, '/prototype-interactive-docs/');
  assert.equal(isHomePath('/prototype-interactive-docs/'), true);
  assert.equal(isHomePath('/prototype-interactive-docs'), true);
  assert.equal(isHomePath(SETUP_PATH), false);
});

test('each setup and demo route resolves without throwing', () => {
  const paths = [SETUP_PATH, ...DEMOS.map(demo => demo.path)];
  for (const path of paths) assert.doesNotThrow(() => getActiveDemo(path), path);
});

test('setup defaults both public address slots and persists them', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.deepEqual(setupStorageValues(storage), { address1: DEFAULT_ADDRESS, address2: DEFAULT_ADDRESS });
  assert.equal(values.get('address-1'), DEFAULT_ADDRESS);
  assert.equal(values.get('address-2'), DEFAULT_ADDRESS);
  assert.equal(SETUP_PATH, '/prototype-interactive-docs/setup/');
  assert.equal(isSetupPath('/prototype-interactive-docs/setup/'), true);
});

test('setup initializes the network storage value', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.equal(setupNetworkValue(storage), DEFAULT_NETWORK);
  assert.equal(values.get(NETWORK_STORAGE_KEY), DEFAULT_NETWORK);
});

test('setup initializes mnemonic slots without default values', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.deepEqual(setupMnemonicValues(storage), { mnemonic3: '', mnemonic4: '' });
  assert.equal(values.get('mnemonic-3'), '');
  assert.equal(values.get('mnemonic-4'), '');
});

test('builds a network-specific Arkade Wallet payment link with an encoded BIP21 request', () => {
  const callback = walletCallbackUrl('http://127.0.0.1:5174/prototype-interactive-docs/demo-12/?status=sent#ignored');
  const link = new URL(walletPaymentUrl({ network: 'signet', address: 'tark1recipient', amountSats: 100, callback }));
  assert.equal(walletUrl('signet'), 'https://signet.arkade.money/');
  assert.equal(walletUrl('mutinynet'), 'https://mutinynet.arkade.money/');
  assert.equal(callback, 'http://127.0.0.1:5174/prototype-interactive-docs/demo-12/');
  assert.equal(link.origin, 'https://signet.arkade.money');
  assert.equal(link.searchParams.get('action'), 'send');
  assert.equal(link.searchParams.get('request'), 'bitcoin:tark1recipient?amount=0.000001');
  assert.equal(link.searchParams.get('callback'), callback);
  assert.equal(formatSatsAsBitcoin(100_000_000), '1');
  assert.throws(() => walletCallbackUrl('http://example.test/demo-12/'), /HTTPS or localhost/);
});

