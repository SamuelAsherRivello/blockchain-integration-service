
//////////////////////////////////////////
// Arrange
//////////////////////////////////////////
import {
  demoResult,
  type DemoContext,
  numberedPreviews,
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
    throw new Error(result.message || 'The asset history request failed.');
  const vtxos: DemoHistoryEntry[] = result.vtxos ?? [];
  const actualAssetId = getMintedAssetId(network, assetId);
  const matching = vtxos.filter(vtxo => demoMatchesAsset(vtxo.assets, actualAssetId));

  //////////////////////////////////////////
  // Assert
  //////////////////////////////////////////
  return demoResult([
    `Address: ${address1}`,
    `Asset filter: ${assetId}`,
    `VTXOs: ${matching.length}`,
    ...numberedPreviews(matching, vtxo => vtxo.assets?.map(asset => asset.assetId).join(', ') || vtxo.txid || 'VTXO', 'VTXO'),
    `Success: ${response.ok}`,
  ].join('\n'), demoTransactionDetails(network, matching));
}
