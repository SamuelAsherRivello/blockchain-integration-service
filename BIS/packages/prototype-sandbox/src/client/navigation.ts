import type { TestNetwork } from '../../../integration/src/client/state-layer-core/test-network.ts';

export function sandboxBasePath(base = import.meta.env?.BASE_URL ?? '/') {
  const normalized = `/${base.replace(/^\/+|\/+$/g, '')}/`.replace(/\/+/g, '/');
  return normalized.endsWith('/prototype-sandbox/') ? normalized : '/prototype-sandbox/';
}

export const HOME_PATH = sandboxBasePath();
export const DEMOS = Object.freeze([
  { number: 1, subject: 'Create Wallet', title: 'Create Wallet', access: 'W', path: '/prototype-sandbox/demo-1/' },
  { number: 2, subject: 'Get Balance', title: 'Private wallet', access: 'R', path: '/prototype-sandbox/demo-2/' },
  { number: 3, subject: 'Get Balance', title: 'Public address', access: 'R', path: '/prototype-sandbox/demo-3/' },
  { number: 18, subject: 'Boarding', title: 'On (BTC → Arkade)', nested: true, access: 'W', path: '/prototype-sandbox/demo-18/' },
  { number: 19, subject: 'Boarding', title: 'Off (Arkade → BTC)', access: 'W', path: '/prototype-sandbox/demo-19/' },
  { number: 4, subject: 'Send Payment', title: 'Send Payment', access: 'W', path: '/prototype-sandbox/demo-4/' },
  { number: 5, subject: 'Receive Payment', title: 'Receive Payment', access: 'R', path: '/prototype-sandbox/demo-5/' },
  { number: 6, subject: 'Payment History', title: 'Payment History', access: 'R', path: '/prototype-sandbox/demo-6/' },
  { number: 7, subject: 'Mint Asset', title: 'Mint Asset', access: 'W', path: '/prototype-sandbox/demo-7/' },
  { number: 8, subject: 'Send Asset', title: 'Send Asset', access: 'W', path: '/prototype-sandbox/demo-8/' },
  { number: 9, subject: 'Receive Asset', title: 'Receive Asset', access: 'R', path: '/prototype-sandbox/demo-9/' },
  { number: 20, subject: 'Upgrade Asset', title: 'Upgrade Asset', access: 'W', path: '/prototype-sandbox/demo-20/' },
  { number: 10, subject: 'Asset History', title: 'Private wallet', access: 'R', path: '/prototype-sandbox/demo-10/' },
  { number: 11, subject: 'Asset History', title: 'Public address', access: 'R', path: '/prototype-sandbox/demo-11/' },
  { number: 21, subject: 'Events', title: 'Events', access: 'R', path: '/prototype-sandbox/demo-21/' },
  { number: 14, subject: 'Conditional Vault', title: 'Create', access: 'W', path: '/prototype-sandbox/demo-14/' },
  { number: 15, subject: 'Conditional Vault', title: 'Increment', access: 'R', path: '/prototype-sandbox/demo-15/' },
  { number: 17, subject: 'Conditional Vault', title: 'Check', access: 'R', path: '/prototype-sandbox/demo-17/' },
  { number: 22, subject: 'Treasure Hunt', title: 'Create', access: 'W', path: '/prototype-sandbox/demo-22/' },
  { number: 16, subject: 'Conditional Vault', title: 'Claim', access: 'W', path: '/prototype-sandbox/demo-16/' },
  { number: 23, subject: 'Treasure Hunt', title: 'Check', access: 'R', path: '/prototype-sandbox/demo-23/' },
  { number: 24, subject: 'Treasure Hunt', title: 'Claim', access: 'W', path: '/prototype-sandbox/demo-24/' },
  { number: 25, subject: 'Treasure Hunt', title: 'Reject', access: 'W', path: '/prototype-sandbox/demo-25/' },
  { number: 12, subject: 'External Wallet', title: 'Send Payment', access: 'R', path: '/prototype-sandbox/demo-12/' },
  { number: 13, subject: 'External Wallet', title: 'Receive Payment', access: 'W', path: '/prototype-sandbox/demo-13/' },
].map(demo => ({ ...demo, path: `${HOME_PATH}demo-${demo.number}/` })));

export const SETUP_PATH = `${HOME_PATH}setup/`;
export const LANDING_VISITED_STORAGE_KEY = 'prototype-sandbox-visited';
export const NETWORK_STORAGE_KEY = 'network';
export const DEFAULT_NETWORK = 'signet';
export const DEFAULT_WALLET_1_ADDRESSES = Object.freeze({
  signet: 'tark1qz9l2ctqalrkjyftxcw7gytm83cm3r9pdudmna4v0gncry56h30x5ed2dhy7mznkeslw938rjntn48qgyecc54hus9n4hdnjemw3qygmxk6ghu',
  mutinynet: 'tark1qqcpq7yq3e8hhsx6ml3fud93m7827qggaurtzu3zwsr4a0qs0gf84ml7mvm4kmfds2kluhkpem2c68jdc3klmt5kmuw70nfesdwqxy8jmcttk9',
});

export const WALLET_URLS = Object.freeze({
  signet: 'https://signet.arkade.money/',
  mutinynet: 'https://mutinynet.arkade.money/',
});

export const FAUCET_URLS = Object.freeze({
  signet: 'https://signet.2nd.dev/',
  mutinynet: 'https://faucet.mutinynet.com/',
});

export function walletUrl(network) {
  const value = WALLET_URLS[network];
  if (!value) throw new Error('Choose Signet or Mutinynet.');
  return value;
}

export function faucetUrl(network) {
  const value = FAUCET_URLS[network];
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
  const request = `bitcoin:?ark=${encodeURIComponent(recipient)}&amount=${formatSatsAsBitcoin(amountSats)}`;
  const wallet = new URL(walletUrl(network));
  wallet.search = new URLSearchParams({ action: 'send', request, callback: callbackUrl.toString() }).toString();
  return wallet.toString();
}

export function walletConnectUrl({ network, callback }) {
  const callbackUrl = new URL(callback);
  const wallet = new URL(walletUrl(network));
  wallet.search = new URLSearchParams({ action: 'connect', callback: callbackUrl.toString() }).toString();
  return wallet.toString();
}

export function walletProfileStorageKey(network, field) {
  if (!['signet', 'mutinynet'].includes(network)) throw new Error('Choose Signet or Mutinynet.');
  if (!['wallet-1-address', 'wallet-2-mnemonic'].includes(field)) throw new Error('Choose a wallet profile field.');
  return `${network}-${field}`;
}

export function setupWalletProfileValues(network, storage = globalThis.localStorage) {
  const addressKey = walletProfileStorageKey(network, 'wallet-1-address');
  const mnemonicKey = walletProfileStorageKey(network, 'wallet-2-mnemonic');
  const values = {
    address1: storage.getItem(addressKey) ?? DEFAULT_WALLET_1_ADDRESSES[network],
    mnemonic2: storage.getItem(mnemonicKey) ?? '',
  };
  storage.setItem(addressKey, values.address1);
  storage.setItem(mnemonicKey, values.mnemonic2);
  return values;
}

export function setupNetworkValue(storage = globalThis.localStorage) {
  const value = storage.getItem(NETWORK_STORAGE_KEY) || DEFAULT_NETWORK;
  storage.setItem(NETWORK_STORAGE_KEY, value);
  return value;
}

export function localStorageGetItem(field, storage = globalThis.localStorage) {
  const network = setupNetworkValue(storage);
  if (field === 'network') return network;
  if (field === 'wallet-1-address') return setupWalletProfileValues(network, storage).address1;
  if (field === 'wallet-2-mnemonic') return setupWalletProfileValues(network, storage).mnemonic2;
  return storage.getItem(`${network}-${field}`) ?? '';
}

export function getActiveDemo(pathname = '') {
  const match = String(pathname).match(/\/prototype-sandbox\/demo-(\d+)(?:\/|$)/i);
  const number = Number(match?.[1]);
  return DEMOS.some(demo => demo.number === number) ? number : 1;
}

export function isSetupPath(pathname = '') {
  return String(pathname).replace(/\/+$/, '/') === SETUP_PATH;
}

export function isHomePath(pathname = '') {
  return `${String(pathname).replace(/\/+$/, '')}/` === HOME_PATH;
}

/** Network-scoped demo fields retain their established localStorage keys. */
function demoInputKey(network: TestNetwork, field: string) {
  if (!['signet', 'mutinynet'].includes(network)) throw new Error('Choose Signet or Mutinynet.');
  if (typeof field !== 'string' || !field || field === NETWORK_STORAGE_KEY) throw new Error('Choose a network-specific demo input.');
  return `${network}-${field}`;
}

export function demoGetInput(network: TestNetwork, field: string, storage = globalThis.localStorage) {
  const key = demoInputKey(network, field);
  if (field === 'wallet-1-address') return setupWalletProfileValues(network, storage).address1;
  if (field === 'wallet-2-mnemonic') return setupWalletProfileValues(network, storage).mnemonic2;
  return storage.getItem(key) ?? '';
}

export function demoSetInput(network: TestNetwork, field: string, value: string | number | bigint | boolean, storage = globalThis.localStorage) {
  storage.setItem(demoInputKey(network, field), String(value));
}
