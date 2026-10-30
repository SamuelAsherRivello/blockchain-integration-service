import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_NETWORK, DEFAULT_WALLET_1_ADDRESSES, DEMOS, HOME_PATH, NETWORK_STORAGE_KEY, SETUP_PATH, formatSatsAsBitcoin, getActiveDemo, isHomePath, isSetupPath, localStorageGetItem, setupNetworkValue, setupWalletProfileValues, walletCallbackUrl, walletConnectUrl, walletPaymentUrl, walletProfileStorageKey, walletUrl } from '../src/client/navigation.ts';

test('defines twenty-five labeled demo routes', () => {
  assert.equal(DEMOS.length, 25);
  assert.deepEqual(DEMOS.map(demo => demo.path), [
    ...Array.from({ length: 3 }, (_, index) => `/prototype-sandbox/demo-${index + 1}/`),
    '/prototype-sandbox/demo-18/',
    '/prototype-sandbox/demo-19/',
    ...Array.from({ length: 6 }, (_, index) => `/prototype-sandbox/demo-${index + 4}/`),
    '/prototype-sandbox/demo-20/',
    '/prototype-sandbox/demo-10/',
    '/prototype-sandbox/demo-11/',
    '/prototype-sandbox/demo-21/',
    '/prototype-sandbox/demo-14/',
    '/prototype-sandbox/demo-15/',
    '/prototype-sandbox/demo-17/',
    '/prototype-sandbox/demo-22/',
    '/prototype-sandbox/demo-16/',
    '/prototype-sandbox/demo-23/', '/prototype-sandbox/demo-24/', '/prototype-sandbox/demo-25/',
    '/prototype-sandbox/demo-12/', '/prototype-sandbox/demo-13/',
  ]);
  assert.equal(DEMOS[0].subject, 'Create Wallet');
  assert.equal(DEMOS[1].subject, 'Get Balance');
  assert.equal(DEMOS[1].title, 'Private wallet');
  assert.equal(DEMOS[2].title, 'Public address');
  assert.equal(DEMOS[3].subject, 'Boarding');
  assert.equal(DEMOS[3].title, 'On (BTC → Arkade)');
  assert.equal(DEMOS[4].subject, 'Boarding');
  assert.equal(DEMOS[4].title, 'Off (Arkade → BTC)');
  assert.equal(DEMOS[5].subject, 'Send Payment');
  assert.equal(DEMOS[11].subject, 'Upgrade Asset');
  assert.equal(DEMOS[11].title, 'Upgrade Asset');
  assert.equal(DEMOS[12].subject, 'Asset History');
  assert.equal(DEMOS[12].title, 'Private wallet');
  assert.equal(DEMOS[13].title, 'Public address');
  assert.equal(DEMOS[14].subject, 'Events');
  assert.equal(DEMOS[15].subject, 'Conditional Vault');
  assert.equal(DEMOS[15].title, 'Create');
  assert.equal(DEMOS[23].subject, 'External Wallet');
  assert.equal(DEMOS[23].title, 'Send Payment');
  assert.equal(DEMOS[24].title, 'Receive Payment');
});

test('derives active demo from direct paths and defaults safely', () => {
  assert.equal(getActiveDemo('/prototype-sandbox/demo-4/'), 4);
  assert.equal(getActiveDemo('/prototype-sandbox/demo-6/'), 6);
  assert.equal(getActiveDemo('/prototype-sandbox/demo-10/'), 10);
  assert.equal(getActiveDemo('/prototype-sandbox/'), 1);
  assert.equal(getActiveDemo('/prototype-sandbox/demo-11/'), 11);
  assert.equal(getActiveDemo('/prototype-sandbox/demo-12/'), 12);
});

test('recognizes the home route separately from setup', () => {
  assert.equal(HOME_PATH, '/prototype-sandbox/');
  assert.equal(isHomePath('/prototype-sandbox/'), true);
  assert.equal(isHomePath('/prototype-sandbox'), true);
  assert.equal(isHomePath(SETUP_PATH), false);
});

test('each setup and demo route resolves without throwing', () => {
  const paths = [SETUP_PATH, ...DEMOS.map(demo => demo.path)];
  for (const path of paths) assert.doesNotThrow(() => getActiveDemo(path), path);
});

test('setup keeps independent Wallet 1 and Wallet 2 values for each network', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  values.set('signet-wallet-1-address', 'signet-address');
  values.set('signet-wallet-2-mnemonic', 'signet-mnemonic');
  values.set('mutinynet-wallet-1-address', 'mutinynet-address');
  values.set('mutinynet-wallet-2-mnemonic', 'mutinynet-mnemonic');
  assert.deepEqual(setupWalletProfileValues('signet', storage), { address1: 'signet-address', mnemonic2: 'signet-mnemonic' });
  assert.deepEqual(setupWalletProfileValues('mutinynet', storage), { address1: 'mutinynet-address', mnemonic2: 'mutinynet-mnemonic' });
  assert.equal(walletProfileStorageKey('signet', 'wallet-1-address'), 'signet-wallet-1-address');
  assert.equal(walletProfileStorageKey('mutinynet', 'wallet-2-mnemonic'), 'mutinynet-wallet-2-mnemonic');
  assert.equal(SETUP_PATH, '/prototype-sandbox/setup/');
  assert.equal(isSetupPath('/prototype-sandbox/setup/'), true);
});

test('setup initializes the network storage value', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.equal(setupNetworkValue(storage), DEFAULT_NETWORK);
  assert.equal(values.get(NETWORK_STORAGE_KEY), DEFAULT_NETWORK);
});

test('setup initializes each new network profile with its Wallet 1 default without using legacy storage keys', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.deepEqual(setupWalletProfileValues('signet', storage), { address1: DEFAULT_WALLET_1_ADDRESSES.signet, mnemonic2: '' });
  assert.deepEqual(setupWalletProfileValues('mutinynet', storage), { address1: DEFAULT_WALLET_1_ADDRESSES.mutinynet, mnemonic2: '' });
  assert.equal(values.get('signet-wallet-1-address'), DEFAULT_WALLET_1_ADDRESSES.signet);
  assert.equal(values.get('mutinynet-wallet-1-address'), DEFAULT_WALLET_1_ADDRESSES.mutinynet);
  assert.equal(values.get('signet-wallet-2-mnemonic'), '');
  assert.equal(values.has('address-1'), false);
  assert.equal(values.has('mnemonic-3'), false);
});

test('setup preserves a user-cleared Wallet 1 value', () => {
  const values = new Map([['signet-wallet-1-address', '']]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.deepEqual(setupWalletProfileValues('signet', storage), { address1: '', mnemonic2: '' });
});

test('localStorageGetItem resolves selected-network setup values', () => {
  const values = new Map([[NETWORK_STORAGE_KEY, 'mutinynet'], ['mutinynet-wallet-2-mnemonic', 'words']]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.equal(localStorageGetItem('network', storage), 'mutinynet');
  assert.equal(localStorageGetItem('wallet-1-address', storage), DEFAULT_WALLET_1_ADDRESSES.mutinynet);
  assert.equal(localStorageGetItem('wallet-2-mnemonic', storage), 'words');
});

test('builds a network-specific Arkade Wallet payment link with an Arkade BIP21 recipient', () => {
  const callback = walletCallbackUrl('http://127.0.0.1:5174/prototype-sandbox/demo-12/?status=sent#ignored');
  const link = new URL(walletPaymentUrl({ network: 'signet', address: 'tark1recipient', amountSats: 100, callback }));
  assert.equal(walletUrl('signet'), 'https://signet.arkade.money/');
  assert.equal(walletUrl('mutinynet'), 'https://mutinynet.arkade.money/');
  assert.equal(callback, 'http://127.0.0.1:5174/prototype-sandbox/demo-12/');
  assert.equal(link.origin, 'https://signet.arkade.money');
  assert.equal(link.searchParams.get('action'), 'send');
  assert.equal(link.searchParams.get('request'), 'bitcoin:?ark=tark1recipient&amount=0.000001');
  assert.equal(link.searchParams.get('callback'), callback);
  const connect = new URL(walletConnectUrl({ network: 'mutinynet', callback }));
  assert.equal(connect.origin, 'https://mutinynet.arkade.money');
  assert.equal(connect.searchParams.get('action'), 'connect');
  assert.equal(connect.searchParams.get('callback'), callback);
  assert.equal(formatSatsAsBitcoin(100_000_000), '1');
  assert.throws(() => walletCallbackUrl('http://example.test/demo-12/'), /HTTPS or localhost/);
});

