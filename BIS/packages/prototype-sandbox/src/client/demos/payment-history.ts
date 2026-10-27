// Arrange
import { demoResult, demoDisposeWallet, type DemoContext, numberedPreviews, demoTransactionDetails } from '../demo-runtime.ts';
import { demoCreateWallet } from '../demo-wallet.ts';

import type { DemoHistoryEntry } from '../demo-runtime.ts';

export async function runDemo({ network }: DemoContext) {
  let wallet;

  // Act
  try {
    wallet = await demoCreateWallet(network);
    const activities: DemoHistoryEntry[] = await wallet.getActivityHistory();

    // Assert
    return demoResult([
      `Activities: ${activities.length}`,
      ...numberedPreviews(activities, activity => activity.type ?? activity.amount ?? activity.key?.arkTxid ?? 'Activity'),
      `Success: ${Array.isArray(activities)}`,
    ].join('\n'), demoTransactionDetails(network, activities));
  }
  finally {
    await demoDisposeWallet(wallet);
  }
}
