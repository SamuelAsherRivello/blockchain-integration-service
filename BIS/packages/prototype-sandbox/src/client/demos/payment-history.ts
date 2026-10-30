
//////////////////////////////////////////
// Arrange
//////////////////////////////////////////
import {
  demoResult,
  demoDisposeWallet,
  type DemoContext,
  numberedPreviews,
  demoTransactionDetails,
  demoCreateWallet,
  type DemoHistoryEntry,
  demoGetMnemonic,
} from '../sandbox-shared.ts';
import { MnemonicIdentity } from '@arkade-os/sdk';

export async function runDemo({ network }: DemoContext) {
  let wallet;

  //////////////////////////////////////////
  // Act
  //////////////////////////////////////////
  try {
    wallet = await demoCreateWallet(network, { identity: MnemonicIdentity.fromMnemonic(demoGetMnemonic(network), { isMainnet: false }) });
    const activities: DemoHistoryEntry[] = await wallet.getActivityHistory();

    //////////////////////////////////////////
    // Assert
    //////////////////////////////////////////
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
