// Arrange
import { demoGetInput, demoSetInput } from '../navigation.ts';
import { demoResult, demoDisposeWallet, type DemoContext } from '../demo-runtime.ts';
import { getMintedAssetId } from '../demo-asset-selection.ts';
import { LEVEL_ONE_TITLE, LEVEL_TWO_TITLE, createAssetUpgradeRequest as demoCreateAssetUpgradeRequest, executeAssetUpgrade as demoExecuteAssetUpgrade } from '../asset-upgrade.ts';
import { demoCreateWallet } from '../demo-wallet.ts';

export async function runDemo({ network }: DemoContext) {
  const assetId = demoGetInput(network, 'asset-id') || '0000';
  const sourceLevel = demoGetInput(network, 'asset-id-' + assetId + '-level') || '1';
  const sourceAssetId = getMintedAssetId(network, assetId);
  let wallet;

  // Act
  try {
    if (!sourceAssetId)
      throw new Error('Use Mint Asset demo first so this wallet owns the level-one source asset.');
    wallet = await demoCreateWallet(network, { freshContracts: true });
    const result = await demoExecuteAssetUpgrade({ wallet, request: demoCreateAssetUpgradeRequest(network, assetId, sourceAssetId, sourceLevel) });
    const record = result.record;
    if (result.status === 'complete' && record.replacementAssetId) {
      demoSetInput(network, 'asset-id-' + assetId, record.replacementAssetId);
      demoSetInput(network, 'asset-id-' + assetId + '-level', record.replacementLevel ?? '2');
    }

    // Assert
    return demoResult([
      `Source Asset ID: ${record.sourceAssetId}`,
      `Source Display Title: ${record.sourceTitle ?? LEVEL_ONE_TITLE}`,
      `Source Metadata Level: ${record.sourceLevel ?? '1'}`,
      `Replacement Asset ID: ${record.replacementAssetId ?? 'unresolved'}`,
      `Replacement Display Title: ${record.replacementTitle ?? LEVEL_TWO_TITLE}`,
      `Replacement Metadata Level: ${record.replacementLevel ?? '2'}`,
      `Phase: ${record.phase}`,
      ...(record.issueTransactionId ? [`Issue Transaction ID: ${record.issueTransactionId}`] : []),
      ...(record.burnTransactionId ? [`Burn Transaction ID: ${record.burnTransactionId}`] : []),
      ...(result.message ? [`Recovery: ${result.message}`] : []),
      `Success: ${result.status === 'complete'}`,
    ].join('\n'), result.status === 'complete' && record.replacementAssetId ? {
      explorers: [
        { label: 'Open On Explorer (Previous Item)', target: { network, kind: 'asset', identifier: record.sourceAssetId } },
        { label: 'Open On Explorer (Current Item)', target: { network, kind: 'asset', identifier: record.replacementAssetId } },
      ],
    } : record.burnTransactionId ? { explorer: { network, kind: 'ark-transaction', identifier: record.burnTransactionId } } : undefined);
  }
  finally {
    await demoDisposeWallet(wallet);
  }
}
