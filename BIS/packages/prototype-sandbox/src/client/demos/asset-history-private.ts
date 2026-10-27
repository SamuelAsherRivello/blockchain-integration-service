// Arrange
import { demoResult, demoDisposeWallet, type DemoContext, numberedPreviews, demoTransactionDetails } from '../demo-runtime.ts';
import { getMintedAssetId } from '../demo-asset-selection.ts';
import { demoGetInput } from '../navigation.ts';
import { demoCreateWallet } from '../demo-wallet.ts';

import type { DemoHistoryEntry } from '../demo-runtime.ts';

export async function runDemo({ network }: DemoContext) {
  const assetId = demoGetInput(network, 'asset-id') || '0000';
  const actualAssetId = getMintedAssetId(network, assetId);
  let wallet;

  // Act
  try {
    wallet = await demoCreateWallet(network);
    const activities: DemoHistoryEntry[] = await wallet.getActivityHistory();
    const matching = assetId === 'all' ? activities : activities.filter(activity => activity.assetId === actualAssetId);

    // Assert
    return demoResult([
      `Asset filter: ${assetId}`,
      `Activities: ${matching.length}`,
      ...numberedPreviews(matching, activity => activity.type ?? activity.assetId ?? activity.amount ?? activity.key?.arkTxid ?? 'Activity'),
      `Success: ${Array.isArray(activities)}`,
    ].join('\n'), demoTransactionDetails(network, matching));
  }
  finally {
    await demoDisposeWallet(wallet);
  }
}
