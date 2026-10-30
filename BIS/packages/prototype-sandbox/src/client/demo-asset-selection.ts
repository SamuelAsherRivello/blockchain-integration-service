import type { TestNetwork } from '../../../integration/src/client/state-layer-core/test-network.ts';
import type { Asset } from '@arkade-os/sdk';
import { demoGetInput } from './navigation.ts';

export function getMintedAssetId(network: TestNetwork, assetLabel: string) {
  return assetLabel === 'all' ? 'all' : demoGetInput(network, 'asset-id-' + assetLabel) || '';
}

export function demoMatchesAsset(assets: readonly Pick<Asset, 'assetId'>[] | undefined, assetId: string) {
  return assets?.some(asset => Boolean(asset.assetId) && (assetId === 'all' || asset.assetId === assetId)) ?? false;
}
