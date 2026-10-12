import { isNetwork } from '../shared/network-config.ts';

const DEFAULT_NETWORK = 'mutinynet';

export function selectedNetwork(search: string) {
  const network = new URLSearchParams(search).get('network');
  return isNetwork(network) ? network : DEFAULT_NETWORK;
}

export function addressSubmissionUrl(href: string, address: string, network: string) {
  const url = new URL(href);
  url.searchParams.set('address', address.trim());
  url.searchParams.set('network', isNetwork(network) ? network : DEFAULT_NETWORK);
  return url.toString();
}

export function clearAddressUrl(href: string, network: string) {
  const url = new URL(href);
  url.searchParams.delete('address');
  url.searchParams.set('network', isNetwork(network) ? network : DEFAULT_NETWORK);
  return `${url.pathname}${url.search}${url.hash}`;
}
