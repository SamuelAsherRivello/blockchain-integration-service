export const DEMOS = Object.freeze([
  { number: 1, subject: 'Get Wallet', title: 'Get Wallet', path: '/prototype-sandbox/demo-1/' },
  { number: 2, subject: 'Get Balance', title: 'Private Wallet', path: '/prototype-sandbox/demo-2/' },
  { number: 3, subject: 'Get Balance', title: 'Public Address', path: '/prototype-sandbox/demo-3/' },
  { number: 4, subject: 'Send Payment', title: 'Send Payment', path: '/prototype-sandbox/demo-4/' },
  { number: 5, subject: 'Receive Payment', title: 'Receive Payment', path: '/prototype-sandbox/demo-5/' },
  { number: 6, subject: 'Payment History', title: 'Payment History', path: '/prototype-sandbox/demo-6/' },
  { number: 7, subject: 'Mint Asset', title: 'Mint Asset', path: '/prototype-sandbox/demo-7/' },
  { number: 8, subject: 'Send Asset', title: 'Send Asset', path: '/prototype-sandbox/demo-8/' },
  { number: 9, subject: 'Receive Asset', title: 'Receive Asset', path: '/prototype-sandbox/demo-9/' },
  { number: 10, subject: 'Asset History', title: 'Private Wallet', path: '/prototype-sandbox/demo-10/' },
  { number: 11, subject: 'Asset History', title: 'Public Address', path: '/prototype-sandbox/demo-11/' },
]);

export const SETUP_PATH = '/prototype-sandbox/setup/';
export const DEFAULT_ADDRESS = 'tark1qz9l2ctqalrkjyftxcw7gytm83cm3r9pdudmna4v0gncry56h30x4yp2v8xdrmv5xwjpk25whlrlrqj8fsv360vezp9jz3ufyzldv4an4md0qf';
export const NETWORK_STORAGE_KEY = 'network';
export const DEFAULT_NETWORK = 'signet';

export function setupStorageValues(storage = globalThis.localStorage) {
  const values = {
    address1: storage.getItem('address-1') || DEFAULT_ADDRESS,
    address2: storage.getItem('address-2') || DEFAULT_ADDRESS,
  };
  storage.setItem('address-1', values.address1);
  storage.setItem('address-2', values.address2);
  return values;
}

export function setupNetworkValue(storage = globalThis.localStorage) {
  const value = storage.getItem(NETWORK_STORAGE_KEY) || DEFAULT_NETWORK;
  storage.setItem(NETWORK_STORAGE_KEY, value);
  return value;
}

export function setupMnemonicValues(storage = globalThis.localStorage) {
  const values = {
    mnemonic3: storage.getItem('mnemonic-3') ?? '',
    mnemonic4: storage.getItem('mnemonic-4') ?? '',
  };
  storage.setItem('mnemonic-3', values.mnemonic3);
  storage.setItem('mnemonic-4', values.mnemonic4);
  return values;
}

export function getActiveDemo(pathname = '') {
  const match = String(pathname).match(/\/prototype-sandbox\/demo-(\d+)(?:\/|$)/i);
  const number = Number(match?.[1]);
  return DEMOS.some(demo => demo.number === number) ? number : 1;
}

export function isSetupPath(pathname = '') {
  return String(pathname).replace(/\/+$/, '/') === SETUP_PATH;
}
