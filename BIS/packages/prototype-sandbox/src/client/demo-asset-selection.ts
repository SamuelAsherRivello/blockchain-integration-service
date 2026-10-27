import type { TestNetwork } from '../../../integration/src/client/state-layer-core/test-network.ts';
import { demoGetInput } from './navigation.ts';

export function getMintedAssetId(network: TestNetwork, assetLabel: string) {
  return assetLabel === 'all' ? 'all' : demoGetInput(network, 'asset-id-' + assetLabel) || '';
}
