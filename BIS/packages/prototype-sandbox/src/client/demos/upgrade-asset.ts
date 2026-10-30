
//////////////////////////////////////////
// Arrange
//////////////////////////////////////////
import {
  demoRecoveryStorage,
  demoGetInput,
  demoSetInput,
  demoGetMnemonic,
  demoResult,
  demoDisposeWallet,
  getMintedAssetId,
  LEVEL_ONE_TITLE,
  LEVEL_TWO_TITLE,
  LEVEL_ONE_ICON,
  LEVEL_TWO_ICON,
  LEVEL_THREE_ICON,
  demoCreateWallet,
  decodeListedMetadataValue,
  readAssetUpgradeRecord,
  writeAssetUpgradeRecord,
  assertAssetUpgradeRequestMatches,
  type AssetUpgradeRequest,
  type AssetUpgradeRecord,
  type AssetUpgradeResult,
  type DemoContext,
} from '../sandbox-shared.ts';
import { MnemonicIdentity } from '@arkade-os/sdk';

const TXID_PATTERN = /^[a-f0-9]{64}$/i;
function swordTitle(level: string) {
  return `Sword Level ${level}`;
}
function swordIcon(level: string) {
  return {
    '1': LEVEL_ONE_ICON,
    '2': LEVEL_TWO_ICON,
    '3': LEVEL_THREE_ICON,
  }[level];
}
function publicTransactionId(value: unknown) {
  return typeof value === 'string' && TXID_PATTERN.test(value) ? value : undefined;
}
export function demoCreateAssetUpgradeRequest(network: string, assetLabel: string, sourceAssetId: string, sourceLevel = '1'): AssetUpgradeRequest {
  const targetLevel = String(Number(sourceLevel) + 1);
  const targetTitle = swordTitle(targetLevel);
  const targetIcon = swordIcon(targetLevel);
  if (!targetIcon)
    throw new Error(`No sword artwork is configured for level ${targetLevel}.`);
  const operationId = `asset-upgrade:${network}:${assetLabel}:${sourceAssetId}`;
  return {
    network,
    sourceAssetId,
    sourceQuantity: '1',
    assetLabel,
    operationId,
    sourceLevel,
    targetMetadata: {
      name: targetTitle,
      title: targetTitle,
      ticker: `${assetLabel}-L${targetLevel}`,
      level: targetLevel,
      icon: targetIcon,
      upgradeable: targetLevel === '1' || targetLevel === '2' ? 'true' : 'false',
      upgradePath: 'sword',
      ...(targetLevel === '1' || targetLevel === '2' ? { nextLevel: String(Number(targetLevel) + 1) } : {}),
      bisUpgradeOperationId: operationId,
    },
  };
}
async function ownedQuantity(wallet: any, assetId: string) {
  const vtxos = await wallet.getVtxos();
  return vtxos.flatMap((vtxo: any) => vtxo.assets ?? []).filter((asset: any) => asset.assetId === assetId).reduce((total: bigint, asset: any) => total + BigInt(asset.amount), 0n);
}
async function findRecordedReplacement(wallet: any, operationId: string): Promise<string | undefined> {
  const vtxos = await wallet.getVtxos();
  const assetIds = [...new Set<string>(vtxos.flatMap((vtxo: any) => (vtxo.assets ?? []).map((asset: any) => asset.assetId)))];
  for (const assetId of assetIds) {
    try {
      const details = await wallet.assetManager.getAssetDetails(assetId);
      if (decodeListedMetadataValue(details?.metadata?.bisUpgradeOperationId) === operationId)
        return assetId;
    }
    catch {
      // An unrelated asset may not expose metadata; continue looking for the marker.
    }
  }
  return undefined;
}
function decodedMetadata(metadata: Record<string, unknown> | undefined) {
  return Object.fromEntries(Object.entries(metadata ?? {}).map(([key, value]) => [key, decodeListedMetadataValue(value)]));
}
function recoverable(record: AssetUpgradeRecord, message: string): AssetUpgradeResult {
  return { status: 'recoverable', record, message };
}
export async function demoExecuteAssetUpgrade({ wallet, request, storage = demoRecoveryStorage(), }: {
  wallet: any;
  request: AssetUpgradeRequest;
  storage?: Storage;
}): Promise<AssetUpgradeResult> {
  let record = readAssetUpgradeRecord(request.network, request.sourceAssetId, storage);
  if (record)
    assertAssetUpgradeRequestMatches(record, request);
  const hadRecord = Boolean(record);
  if (record?.phase === 'complete')
    return { status: 'complete', record };
  if (record?.phase === 'burning' || record?.phase === 'burn-submitted') {
    return recoverable(record, 'The burn outcome is unresolved. Refresh the wallet and do not submit another burn.');
  }
  const sourceQuantity = await ownedQuantity(wallet, request.sourceAssetId);
  if (sourceQuantity !== BigInt(request.sourceQuantity))
    throw new Error('The level-one source asset is not currently owned in the expected quantity. Mint it first or refresh the wallet.');
  const sourceDetails = await wallet.assetManager.getAssetDetails(request.sourceAssetId);
  const sourceMetadata = decodedMetadata(sourceDetails?.metadata);
  const sourceLevel = String(sourceMetadata.level ?? '');
  if (sourceMetadata.upgradePath !== 'sword' || sourceMetadata.upgradeable !== 'true' || sourceLevel !== request.sourceLevel || sourceMetadata.title !== swordTitle(sourceLevel)) {
    throw new Error(`The source asset is not an upgradeable ${swordTitle(request.sourceLevel)} with the expected metadata.`);
  }
  const targetLevel = String(Number(sourceLevel) + 1);
  if (request.targetMetadata.level !== targetLevel)
    throw new Error('The upgrade request does not target the next sword level.');
  const balance = await wallet.getBalance();
  if (BigInt(balance.available ?? 0) <= 0n)
    throw new Error('The wallet has no available sats to fund the replacement issuance.');
  if (!record) {
    record = writeAssetUpgradeRecord({ ...request, version: 1, phase: 'issuing', sourceTitle: String(sourceMetadata.title), sourceLevel, replacementTitle: request.targetMetadata.title, replacementLevel: targetLevel }, storage);
  }
  let replacementAssetId = record.replacementAssetId;
  if (!replacementAssetId) {
    replacementAssetId = await findRecordedReplacement(wallet, request.operationId);
    if (replacementAssetId)
      record = writeAssetUpgradeRecord({ ...record, phase: 'replacement-issued', replacementAssetId }, storage);
  }
  if (!replacementAssetId && hadRecord && record.phase === 'issuing') {
    return recoverable(record, 'The replacement issuance is unresolved. Refresh the wallet and retry reconciliation.');
  }
  if (!replacementAssetId) {
    const issued = await wallet.assetManager.issue({ amount: 1n, metadata: request.targetMetadata });
    const issuedAssetId: unknown = issued.assetId;
    if (typeof issuedAssetId !== 'string' || !issuedAssetId)
      throw new Error('The replacement issuance did not return an asset ID. Its outcome is unresolved.');
    replacementAssetId = issuedAssetId;
    record = writeAssetUpgradeRecord({ ...record, phase: 'replacement-issued', replacementAssetId, replacementTitle: request.targetMetadata.title, replacementLevel: targetLevel, ...(publicTransactionId(issued.arkTxId) ? { issueTransactionId: issued.arkTxId } : {}) }, storage);
  }
  if (await ownedQuantity(wallet, replacementAssetId) < 1n)
    return recoverable(record, 'The level-two replacement was issued but its ownership is not yet verified.');
  record = writeAssetUpgradeRecord({ ...record, phase: 'burning' }, storage);
  const burnTransactionId = await wallet.assetManager.burn({ assetId: request.sourceAssetId, amount: 1n });
  record = writeAssetUpgradeRecord({ ...record, phase: 'burn-submitted', ...(publicTransactionId(burnTransactionId) ? { burnTransactionId } : {}) }, storage);
  if (await ownedQuantity(wallet, request.sourceAssetId) !== 0n)
    return recoverable(record, 'The source burn was submitted but source retirement is not yet verified.');
  record = writeAssetUpgradeRecord({ ...record, phase: 'complete' }, storage);
  return { status: 'complete', record };
}
export async function runDemo({ network }: DemoContext) {
  const assetId = demoGetInput(network, 'asset-id') || '0000';
  const sourceLevel = demoGetInput(network, 'asset-id-' + assetId + '-level') || '1';
  const sourceAssetId = getMintedAssetId(network, assetId);
  let wallet;

  //////////////////////////////////////////
  // Act
  //////////////////////////////////////////
  try {
    if (!sourceAssetId)
      throw new Error('Use Mint Asset demo first so this wallet owns the level-one source asset.');
    wallet = await demoCreateWallet(network, { identity: MnemonicIdentity.fromMnemonic(demoGetMnemonic(network), { isMainnet: false }), freshContracts: true });
    const result = await demoExecuteAssetUpgrade({ wallet, request: demoCreateAssetUpgradeRequest(network, assetId, sourceAssetId, sourceLevel) });
    const record = result.record;
    if (result.status === 'complete' && record.replacementAssetId) {
      demoSetInput(network, 'asset-id-' + assetId, record.replacementAssetId);
      demoSetInput(network, 'asset-id-' + assetId + '-level', record.replacementLevel ?? '2');
    }

    //////////////////////////////////////////
    // Assert
    //////////////////////////////////////////
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
