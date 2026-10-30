
//////////////////////////////////////////
// Arrange
//////////////////////////////////////////
import {
  demoResult,
  type DemoContext,
  demoTransactionDetails,
  demoMatchesAsset,
  getMintedAssetId,
  demoGetInput,
  demoGetVtxosUrl,
  type DemoHistoryEntry,
} from '../sandbox-shared.ts';
import { ArkAddress } from '@arkade-os/sdk';

export async function runDemo({ network }: DemoContext) {
  const address1 = demoGetInput(network, 'wallet-1-address');
  const assetId = demoGetInput(network, 'asset-id') || '0000';

  //////////////////////////////////////////
  // Act
  //////////////////////////////////////////
  const response = await fetch(`${demoGetVtxosUrl(network, ArkAddress.decode(address1))}&spendableOnly=true`);
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.message || 'The receive request failed.');
  const vtxos: DemoHistoryEntry[] = result.vtxos ?? [];
  const actualAssetId = getMintedAssetId(network, assetId);
  const matching = vtxos.filter(vtxo => demoMatchesAsset(vtxo.assets, actualAssetId));
  if (matching.length === 0)
    throw new Error('Use Send Asset demo first.');

  //////////////////////////////////////////
  // Assert
  //////////////////////////////////////////
  return demoResult([`Address: ${address1}`, `Asset filter: ${assetId}`, `VTXOs: ${matching.length}`, `Success: ${response.ok}`].join('\n'), demoTransactionDetails(network, matching));
}
