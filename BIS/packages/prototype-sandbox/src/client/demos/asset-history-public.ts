// Arrange
import { demoResult, type DemoContext, numberedPreviews, demoTransactionDetails } from '../demo-runtime.ts';
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
    throw new Error(result.message || 'The asset history request failed.');
  const vtxos: DemoHistoryEntry[] = result.vtxos ?? [];
  const actualAssetId = getMintedAssetId(network, assetId);
  const matching = assetId === 'all' ? vtxos : vtxos.filter(vtxo => vtxo.assetId === actualAssetId);

  // Assert
  return demoResult([
    `Address: ${address1}`,
    `Asset filter: ${assetId}`,
    `VTXOs: ${matching.length}`,
    ...numberedPreviews(matching, vtxo => vtxo.assetId ?? vtxo.amount ?? vtxo.txid ?? 'VTXO', 'VTXO'),
    `Success: ${response.ok}`,
  ].join('\n'), demoTransactionDetails(network, matching));
}
