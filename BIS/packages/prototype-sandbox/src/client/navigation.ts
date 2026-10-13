export const DEMOS = Object.freeze([
  { number: 1, subject: 'Get Wallet', title: 'Get Wallet', path: '/prototype-interactive-docs/demo-1/' },
  { number: 2, subject: 'Get Balance', title: 'Private Wallet', path: '/prototype-interactive-docs/demo-2/' },
  { number: 3, subject: 'Get Balance', title: 'Public Address', path: '/prototype-interactive-docs/demo-3/' },
  { number: 4, subject: 'Send Payment', title: 'Send Payment', path: '/prototype-interactive-docs/demo-4/' },
  { number: 5, subject: 'Receive Payment', title: 'Receive Payment', path: '/prototype-interactive-docs/demo-5/' },
  { number: 6, subject: 'Payment History', title: 'Payment History', path: '/prototype-interactive-docs/demo-6/' },
  { number: 7, subject: 'Mint Asset', title: 'Mint Asset', path: '/prototype-interactive-docs/demo-7/' },
  { number: 8, subject: 'Send Asset', title: 'Send Asset', path: '/prototype-interactive-docs/demo-8/' },
  { number: 9, subject: 'Receive Asset', title: 'Receive Asset', path: '/prototype-interactive-docs/demo-9/' },
  { number: 10, subject: 'Asset History', title: 'Private Wallet', path: '/prototype-interactive-docs/demo-10/' },
  { number: 11, subject: 'Asset History', title: 'Public Address', path: '/prototype-interactive-docs/demo-11/' },
  { number: 12, subject: 'External Wallet', title: 'Approve Payment', path: '/prototype-interactive-docs/demo-12/' },
]);

export const SETUP_PATH = '/prototype-interactive-docs/setup/';
export const HOME_PATH = '/prototype-interactive-docs/';
export const LANDING_VISITED_STORAGE_KEY = 'prototype-interactive-docs-visited';
export const DEFAULT_ADDRESS = 'tark1qz9l2ctqalrkjyftxcw7gytm83cm3r9pdudmna4v0gncry56h30x4yp2v8xdrmv5xwjpk25whlrlrqj8fsv360vezp9jz3ufyzldv4an4md0qf';
export const NETWORK_STORAGE_KEY = 'network';
export const DEFAULT_NETWORK = 'signet';

export const WALLET_URLS = Object.freeze({
  signet: 'https://signet.arkade.money/',
  mutinynet: 'https://mutinynet.arkade.money/',
});

export function walletUrl(network) {
  const value = WALLET_URLS[network];
  if (!value) throw new Error('Choose Signet or Mutinynet.');
  return value;
}

export function walletCallbackUrl(locationHref) {
  const callback = new URL(locationHref);
  callback.search = '';
  callback.hash = '';
  const localhost = ['localhost', '127.0.0.1', '[::1]'].includes(callback.hostname);
  if (callback.protocol !== 'https:' && !(callback.protocol === 'http:' && localhost)) {
    throw new Error('Open this demo on HTTPS or localhost before requesting wallet approval.');
  }
  return callback.toString();
}

export function formatSatsAsBitcoin(amountSats) {
  const amount = Number(amountSats);
  if (!Number.isSafeInteger(amount) || amount < 1) throw new Error('Enter a whole-satoshi amount of at least 1.');
  const whole = Math.floor(amount / 100_000_000);
  const fraction = String(amount % 100_000_000).padStart(8, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : String(whole);
}

export function walletPaymentUrl({ network, address, amountSats, callback }) {
  const recipient = String(address ?? '').trim();
  if (!recipient) throw new Error('Enter an Arkade recipient address on Setup Input first.');
  const callbackUrl = new URL(callback);
  const request = `bitcoin:${recipient}?amount=${formatSatsAsBitcoin(amountSats)}`;
  const wallet = new URL(walletUrl(network));
  wallet.search = new URLSearchParams({ action: 'send', request, callback: callbackUrl.toString() }).toString();
  return wallet.toString();
}

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
  const match = String(pathname).match(/\/prototype-interactive-docs\/demo-(\d+)(?:\/|$)/i);
  const number = Number(match?.[1]);
  return DEMOS.some(demo => demo.number === number) ? number : 1;
}

export function isSetupPath(pathname = '') {
  return String(pathname).replace(/\/+$/, '/') === SETUP_PATH;
}

export function isHomePath(pathname = '') {
  return `${String(pathname).replace(/\/+$/, '')}/` === HOME_PATH;
}
