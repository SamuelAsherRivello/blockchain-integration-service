import { testNetwork, type TestNetwork } from '../../../integration/src/client/state-layer-core/test-network.ts';

export type DemoExplorerTarget = Readonly<{
  network: TestNetwork;
  kind: 'ark-transaction' | 'bitcoin-transaction' | 'asset' | 'bitcoin-address';
  identifier: string;
}>;
const supportedDemos = new Set([...Array.from({ length: 18 }, (_, index) => index + 2), 20]);
export function demoSupportsExplorer(scope: string) {
  const [network, demo] = scope.split(':');
  return ['signet', 'mutinynet'].includes(network) && supportedDemos.has(Number(demo));
}
export function demoExplorerUrl(scope: string, target?: DemoExplorerTarget | null): string | undefined {
  if (!demoSupportsExplorer(scope) || !target || target.network !== scope.split(':')[0]) return;
  const config = testNetwork(target.network), id = target.identifier;
  if (typeof id !== 'string') return;
  if (target.kind === 'asset' && /^[a-f0-9]{68}$/i.test(id)) return config.arkExplorerAssetUrl?.(id);
  if (target.kind === 'bitcoin-address' && /^tb1[ac-hj-np-z02-9]{20,90}$/.test(id)) return config.bitcoinExplorerAddressUrl(id);
  if (!/^[a-f0-9]{64}$/i.test(id)) return;
  if (target.kind === 'ark-transaction') return config.arkExplorerTransactionUrl?.(id);
  if (target.kind === 'bitcoin-transaction') return config.bitcoinExplorerTransactionUrl(id);
}
export function firstArkTransaction(values: unknown): string | undefined {
  if (!Array.isArray(values)) return;
  for (const item of values) {
    const candidate = item?.key?.arkTxid ?? item?.arkTxId ?? item?.txid;
    if (typeof candidate === 'string' && /^[a-f0-9]{64}$/i.test(candidate)) return candidate;
  }
}

