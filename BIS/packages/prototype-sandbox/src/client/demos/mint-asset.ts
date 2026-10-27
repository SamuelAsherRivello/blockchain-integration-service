// Arrange
import { demoGetInput, demoSetInput } from '../navigation.ts';
import { demoResult, type DemoContext } from '../demo-runtime.ts';
import { LEVEL_ONE_ICON, LEVEL_ONE_TITLE } from '../asset-upgrade.ts';
import { demoWithFreshWallet } from '../demo-wallet.ts';

export async function runDemo({ network }: DemoContext) {
  const assetId = demoGetInput(network, 'asset-id') || '0000';

  // Act
  const result = await demoWithFreshWallet(network, wallet => wallet.assetManager.issue({ amount: 1n, metadata: {
    ticker: assetId, name: LEVEL_ONE_TITLE, title: LEVEL_ONE_TITLE, level: '1', icon: LEVEL_ONE_ICON,
    upgradeable: 'true', upgradePath: 'sword', nextLevel: '2',
  } }), { freshContracts: true });
  demoSetInput(network, 'asset-id-' + assetId, result.assetId);
  demoSetInput(network, 'asset-id-' + assetId + '-level', '1');

  // Assert
  return demoResult([`Asset label: ${assetId}`, `Asset ID: ${result.assetId}`, `Display title: ${LEVEL_ONE_TITLE}`,
    'Metadata level: 1', `Icon: ${LEVEL_ONE_ICON}`, `Success: ${Boolean(result.assetId)}`].join('\n'), {
    explorer: { network, kind: 'asset', identifier: result.assetId },
  });
}
