export const NETWORKS = Object.freeze({
  signet: Object.freeze({ id: 'signet', label: 'Signet', operator: 'https://signet.arkade.sh' }),
  mutinynet: Object.freeze({ id: 'mutinynet', label: 'Mutinynet', operator: 'https://mutinynet.arkade.sh' }),
});

export type NetworkId = keyof typeof NETWORKS;

export const NETWORK_IDS = Object.freeze(Object.keys(NETWORKS) as NetworkId[]);

export function isNetwork(value: unknown): value is NetworkId {
  return typeof value === 'string' && Object.hasOwn(NETWORKS, value);
}

export function networkDefinition(value: unknown) {
  if (!isNetwork(value)) throw new Error('Choose Signet or Mutinynet.');
  return NETWORKS[value];
}
