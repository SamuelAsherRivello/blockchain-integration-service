
//////////////////////////////////////////
// Arrange
//////////////////////////////////////////
import {
  demoResult,
  demoDisposeWallet,
  type DemoContext,
  numberedPreviews,
  demoTransactionDetails,
  demoMatchesAsset,
  getMintedAssetId,
  demoGetInput,
  demoCreateWallet,
  type DemoHistoryEntry,
  demoGetMnemonic,
} from '../sandbox-shared.ts';
import { MnemonicIdentity } from '@arkade-os/sdk';

export async function runDemo({ network }: DemoContext) {
  const assetId = demoGetInput(network, 'asset-id') || '0000';
  const actualAssetId = getMintedAssetId(network, assetId);
  let wallet;

  //////////////////////////////////////////
  // Act
  //////////////////////////////////////////
  try {
    wallet = await demoCreateWallet(network, { identity: MnemonicIdentity.fromMnemonic(demoGetMnemonic(network), { isMainnet: false }) });
    const activities: DemoHistoryEntry[] = await wallet.getActivityHistory();
    const matching = activities.filter(activity => activity.txs?.some(tx => demoMatchesAsset(tx.assets, actualAssetId)));

    //////////////////////////////////////////
    // Assert
    //////////////////////////////////////////
    return demoResult([
      `Asset filter: ${assetId}`,
      `Activities: ${matching.length}`,
      ...numberedPreviews(matching, activity => activity.type ?? activity.amount ?? activity.key?.arkTxid ?? 'Activity'),
      `Success: ${Array.isArray(activities)}`,
    ].join('\n'), demoTransactionDetails(network, matching));
  }
  finally {
    await demoDisposeWallet(wallet);
  }
}
