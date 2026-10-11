import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ADDRESS, DEFAULT_NETWORK, DEMOS, NETWORK_STORAGE_KEY, SETUP_PATH, getActiveDemo, isSetupPath, setupMnemonicValues, setupNetworkValue, setupStorageValues } from '../src/client/navigation.mjs';

test('defines eleven labeled demo routes', () => {
  assert.equal(DEMOS.length, 11);
  assert.deepEqual(DEMOS.map(demo => demo.path), Array.from({ length: 11 }, (_, index) => `/prototype-sandbox/demo-${index + 1}/`));
  assert.equal(DEMOS[0].subject, 'Get Wallet');
  assert.equal(DEMOS[1].subject, 'Get Balance');
  assert.equal(DEMOS[1].title, 'Private Wallet');
  assert.equal(DEMOS[2].title, 'Public Address');
  assert.equal(DEMOS[3].subject, 'Send Payment');
  assert.equal(DEMOS[9].subject, 'Asset History');
  assert.equal(DEMOS[9].title, 'Private Wallet');
  assert.equal(DEMOS[10].title, 'Public Address');
});

test('derives active demo from direct paths and defaults safely', () => {
  assert.equal(getActiveDemo('/prototype-sandbox/demo-4/'), 4);
  assert.equal(getActiveDemo('/prototype-sandbox/demo-6/'), 6);
  assert.equal(getActiveDemo('/prototype-sandbox/demo-10/'), 10);
  assert.equal(getActiveDemo('/prototype-sandbox/'), 1);
  assert.equal(getActiveDemo('/prototype-sandbox/demo-11/'), 11);
});

test('setup defaults both public address slots and persists them', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.deepEqual(setupStorageValues(storage), { address1: DEFAULT_ADDRESS, address2: DEFAULT_ADDRESS });
  assert.equal(values.get('address-1'), DEFAULT_ADDRESS);
  assert.equal(values.get('address-2'), DEFAULT_ADDRESS);
  assert.equal(SETUP_PATH, '/prototype-sandbox/setup/');
  assert.equal(isSetupPath('/prototype-sandbox/setup/'), true);
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
