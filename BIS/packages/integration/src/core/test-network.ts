export const TEST_NETWORK_PREFERENCE_KEY = 'bis:test-network:v1';

export type TestNetwork = 'signet' | 'mutinynet';

export type TestNetworkDefinition = Readonly<{
  id: TestNetwork;
  label: string;
  operator: string;
  explorerApiUrl: string;
  faucetUrls: readonly string[];
  faucetUrl: string;
  bitcoinExplorerAddressUrl(address: string): string;
  bitcoinExplorerTransactionUrl(transactionId: string): string;
  arkExplorerAssetUrl?(assetId: string): string;
  arkExplorerTransactionUrl?(transactionId: string): string;
  fundingCommand(address: string): string;
  fundingHelp: string;
}>;

const definitions: Record<TestNetwork, TestNetworkDefinition> = Object.freeze({
  signet: Object.freeze({
    id: 'signet',
    label: 'Signet',
    operator: 'https://signet.arkade.sh',
    explorerApiUrl: 'https://mempool.space/signet/api',
    faucetUrls: Object.freeze(['https://signetfaucet.com/', 'https://signet.2nd.dev/']),
    faucetUrl: 'https://signet.2nd.dev/',
    bitcoinExplorerAddressUrl: (address: string) => `https://mempool.space/signet/address/${encodeURIComponent(address)}`,
    bitcoinExplorerTransactionUrl: (transactionId: string) => `https://mempool.space/signet/tx/${encodeURIComponent(transactionId)}`,
    arkExplorerAssetUrl: (assetId: string) => `https://explorer.signet.arkade.sh/asset/${encodeURIComponent(assetId)}`,
    arkExplorerTransactionUrl: (transactionId: string) => `https://explorer.signet.arkade.sh/tx/${encodeURIComponent(transactionId)}`,
    fundingCommand: (address: string) => `contrib/signet/getcoins.py --addr ${address}`,
    fundingHelp: 'Run this Bitcoin Core helper yourself and complete its interactive terminal CAPTCHA. Or use the Signet faucet manually.',
  }),
  mutinynet: Object.freeze({
    id: 'mutinynet',
    label: 'Mutinynet',
    operator: 'https://mutinynet.arkade.sh',
    explorerApiUrl: 'https://mempool.mutinynet.arkade.sh/api',
    faucetUrls: Object.freeze(['https://faucet.mutinynet.com/']),
    faucetUrl: 'https://faucet.mutinynet.com/',
    bitcoinExplorerAddressUrl: (address: string) => `https://mempool.mutinynet.arkade.sh/address/${encodeURIComponent(address)}`,
    bitcoinExplorerTransactionUrl: (transactionId: string) => `https://mempool.mutinynet.arkade.sh/tx/${encodeURIComponent(transactionId)}`,
    arkExplorerAssetUrl: (assetId: string) => `https://explorer.mutinynet.arkade.sh/asset/${encodeURIComponent(assetId)}`,
    arkExplorerTransactionUrl: (transactionId: string) => `https://explorer.mutinynet.arkade.sh/tx/${encodeURIComponent(transactionId)}`,
    fundingCommand: (address: string) => `mutinynet-cli onchain ${address} [sats]`,
    fundingHelp: 'Run mutinynet-cli login yourself to complete GitHub device login before funding. Or use the Mutinynet faucet manually.',
  }),
});

export const testNetworks = Object.freeze([definitions.signet, definitions.mutinynet] as const);

export function isTestNetwork(value: unknown): value is TestNetwork {
  return value === 'signet' || value === 'mutinynet';
}

export function testNetwork(network: TestNetwork): TestNetworkDefinition {
  return definitions[network];
}

export function networkLabel(network: TestNetwork | undefined): string {
  return network ? testNetwork(network).label : 'Choose a test network';
}

/** Returns no link rather than a link to the wrong network when no asset explorer is configured. */
export function arkExplorerAssetUrl(network: TestNetwork | undefined, assetId: string): string | undefined {
  return network ? testNetwork(network).arkExplorerAssetUrl?.(assetId) : undefined;
}

export function arkExplorerTransactionUrl(network: TestNetwork | undefined, transactionId: string): string | undefined {
  return network ? testNetwork(network).arkExplorerTransactionUrl?.(transactionId) : undefined;
}

type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Stores only the non-sensitive network choice. Wallet material never belongs here. */
export function createTestNetworkSession(storage: PreferenceStorage | undefined = globalThis.localStorage) {
  const selected = () => {
    const value = storage?.getItem(TEST_NETWORK_PREFERENCE_KEY);
    return isTestNetwork(value) ? value : undefined;
  };
  return Object.freeze({
    getSelected: selected,
    select(network: unknown): TestNetwork {
      if (!isTestNetwork(network)) throw Error('Choose Signet or Mutinynet.');
      if (!storage) throw Error('Network preference storage is unavailable.');
      storage.setItem(TEST_NETWORK_PREFERENCE_KEY, network);
      return network;
    },
  });
}
