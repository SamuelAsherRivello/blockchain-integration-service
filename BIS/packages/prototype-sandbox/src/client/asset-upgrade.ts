export type UpgradePhase = 'issuing' | 'replacement-issued' | 'burning' | 'burn-submitted' | 'complete';

export type AssetUpgradeRequest = Readonly<{
  network: string;
  sourceAssetId: string;
  sourceQuantity: string;
  assetLabel: string;
  operationId: string;
  targetMetadata: Readonly<Record<string, string>>;
}>;

export type AssetUpgradeRecord = AssetUpgradeRequest & Readonly<{
  version: 1;
  phase: UpgradePhase;
  replacementAssetId?: string;
  issueTransactionId?: string;
  burnTransactionId?: string;
}>;

export type AssetUpgradeResult = Readonly<{
  status: 'complete' | 'recoverable';
  record: AssetUpgradeRecord;
  message?: string;
}>;

const RECORD_PREFIX = 'prototype-sandbox:asset-upgrade:v1:';
const TXID_PATTERN = /^[a-f0-9]{64}$/i;

function recordKey(network: string, sourceAssetId: string) {
  return `${RECORD_PREFIX}${network}:${sourceAssetId}`;
}

function publicTransactionId(value: unknown) {
  return typeof value === 'string' && TXID_PATTERN.test(value) ? value : undefined;
}

export function createAssetUpgradeRequest(network: string, assetLabel: string, sourceAssetId: string): AssetUpgradeRequest {
  const operationId = `asset-upgrade:${network}:${assetLabel}:${sourceAssetId}`;
  return {
    network,
    sourceAssetId,
    sourceQuantity: '1',
    assetLabel,
    operationId,
    targetMetadata: {
      name: `${assetLabel} Level 2 Sword`,
      ticker: `${assetLabel}-L2`,
      level: '2',
      bisUpgradeOperationId: operationId,
    },
  };
}

export function readAssetUpgradeRecord(
  network: string,
  sourceAssetId: string,
  storage: Storage = globalThis.localStorage,
): AssetUpgradeRecord | undefined {
  try {
    const raw = storage.getItem(recordKey(network, sourceAssetId));
    if (!raw) return undefined;
    const record = JSON.parse(raw);
    return record?.version === 1 && record?.network === network && record?.sourceAssetId === sourceAssetId
      ? record as AssetUpgradeRecord
      : undefined;
  } catch {
    return undefined;
  }
}

export function writeAssetUpgradeRecord(record: AssetUpgradeRecord, storage: Storage = globalThis.localStorage) {
  storage.setItem(recordKey(record.network, record.sourceAssetId), JSON.stringify(record));
  return record;
}

export function assertAssetUpgradeRequestMatches(record: AssetUpgradeRecord, request: AssetUpgradeRequest) {
  if (record.operationId !== request.operationId || record.network !== request.network || record.sourceAssetId !== request.sourceAssetId || record.sourceQuantity !== request.sourceQuantity || JSON.stringify(record.targetMetadata) !== JSON.stringify(request.targetMetadata)) {
    throw new Error('The recorded upgrade request does not match this source asset.');
  }
}

async function ownedQuantity(wallet: any, assetId: string) {
  const vtxos = await wallet.getVtxos();
  return vtxos.flatMap((vtxo: any) => vtxo.assets ?? []).filter((asset: any) => asset.assetId === assetId).reduce((total: bigint, asset: any) => total + BigInt(asset.amount), 0n);
}

async function findRecordedReplacement(wallet: any, operationId: string) {
  const vtxos = await wallet.getVtxos();
  const assetIds = [...new Set(vtxos.flatMap((vtxo: any) => (vtxo.assets ?? []).map((asset: any) => asset.assetId)))];
  for (const assetId of assetIds) {
    try {
      const details = await wallet.assetManager.getAssetDetails(assetId);
      if (details?.metadata?.bisUpgradeOperationId === operationId) return assetId;
    } catch {
      // An unrelated asset may not expose metadata; continue looking for the marker.
    }
  }
  return undefined;
}

function recoverable(record: AssetUpgradeRecord, message: string): AssetUpgradeResult {
  return { status: 'recoverable', record, message };
}

export async function executeAssetUpgrade({
  wallet,
  request,
  storage = globalThis.localStorage,
}: {
  wallet: any;
  request: AssetUpgradeRequest;
  storage?: Storage;
}): Promise<AssetUpgradeResult> {
  let record = readAssetUpgradeRecord(request.network, request.sourceAssetId, storage);
  if (record) assertAssetUpgradeRequestMatches(record, request);
  const hadRecord = Boolean(record);
  if (record?.phase === 'complete') return { status: 'complete', record };
  if (record?.phase === 'burning' || record?.phase === 'burn-submitted') {
    return recoverable(record, 'The burn outcome is unresolved. Refresh the wallet and do not submit another burn.');
  }

  const sourceQuantity = await ownedQuantity(wallet, request.sourceAssetId);
  if (sourceQuantity !== BigInt(request.sourceQuantity)) throw new Error('The level-one source asset is not currently owned in the expected quantity. Mint it first or refresh the wallet.');
  const balance = await wallet.getBalance();
  if (BigInt(balance.available ?? 0) <= 0n) throw new Error('The wallet has no available sats to fund the replacement issuance.');

  if (!record) {
    record = writeAssetUpgradeRecord({ ...request, version: 1, phase: 'issuing' }, storage);
  }

  let replacementAssetId = record.replacementAssetId;
  if (!replacementAssetId) {
    replacementAssetId = await findRecordedReplacement(wallet, request.operationId);
    if (replacementAssetId) record = writeAssetUpgradeRecord({ ...record, phase: 'replacement-issued', replacementAssetId }, storage);
  }

  if (!replacementAssetId && hadRecord && record.phase === 'issuing') {
    return recoverable(record, 'The replacement issuance is unresolved. Refresh the wallet and retry reconciliation.');
  }

  if (!replacementAssetId) {
    const issued = await wallet.assetManager.issue({ amount: 1n, metadata: request.targetMetadata });
    replacementAssetId = issued.assetId;
    record = writeAssetUpgradeRecord({ ...record, phase: 'replacement-issued', replacementAssetId, ...(publicTransactionId(issued.arkTxId) ? { issueTransactionId: issued.arkTxId } : {}) }, storage);
  }

  if (await ownedQuantity(wallet, replacementAssetId) < 1n) return recoverable(record, 'The level-two replacement was issued but its ownership is not yet verified.');
  record = writeAssetUpgradeRecord({ ...record, phase: 'burning' }, storage);
  const burnTransactionId = await wallet.assetManager.burn({ assetId: request.sourceAssetId, amount: 1n });
  record = writeAssetUpgradeRecord({ ...record, phase: 'burn-submitted', ...(publicTransactionId(burnTransactionId) ? { burnTransactionId } : {}) }, storage);
  if (await ownedQuantity(wallet, request.sourceAssetId) !== 0n) return recoverable(record, 'The source burn was submitted but source retirement is not yet verified.');
  record = writeAssetUpgradeRecord({ ...record, phase: 'complete' }, storage);
  return { status: 'complete', record };
}
