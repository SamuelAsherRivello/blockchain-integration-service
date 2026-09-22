import { RestArkProvider } from '@arkade-os/sdk';
import { inspectWalletNetworkPolicy, type WalletNetworkPolicy } from '../core/wallet-network-policy.ts';
import { operatorFor } from './account.ts';
import type { TestNetwork } from '../core/test-network.ts';

export async function readWalletNetworkPolicy(network: TestNetwork, provider: Pick<RestArkProvider, 'getInfo'> = new RestArkProvider(operatorFor(network))): Promise<Readonly<{ info: Awaited<ReturnType<RestArkProvider['getInfo']>>; policy: WalletNetworkPolicy }>> {
  const info = await provider.getInfo();
  return Object.freeze({ info, policy: inspectWalletNetworkPolicy(network, info) });
}
