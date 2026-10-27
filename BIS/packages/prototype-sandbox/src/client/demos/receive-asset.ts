// Arrange
import { demoResult, type DemoContext, demoTransactionDetails } from '../demo-runtime.ts';
import { getMintedAssetId } from '../demo-asset-selection.ts';
import { demoGetInput } from '../navigation.ts';
import { demoGetVtxosUrl } from '../demo-utils.ts';

import type { DemoHistoryEntry } from '../demo-runtime.ts';

export async function runDemo({ network }: DemoContext) {
  const address1 = demoGetInput(network, 'wallet-1-address');
  const assetId = demoGetInput(network, 'asset-id') || '0000';

  // Act
  const response = await fetch(`${demoGetVtxosUrl(network, address1)}&spendableOnly=true`);
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.message || 'The receive request failed.');
  const vtxos: DemoHistoryEntry[] = result.vtxos ?? [];
  const actualAssetId = getMintedAssetId(network, assetId);
  const matching = assetId === 'all' ? vtxos : vtxos.filter(vtxo => vtxo.assetId === actualAssetId);
  if (matching.length === 0)
    throw new Error('Use Send Asset demo first.');

  // Assert
  return demoResult([`Address: ${address1}`, `Asset filter: ${assetId}`, `VTXOs: ${matching.length}`, `Success: ${response.ok}`].join('\n'), demoTransactionDetails(network, matching));
}
