export type UpgradePhase = 'issuing' | 'replacement-issued' | 'burning' | 'burn-submitted' | 'complete';

export type AssetUpgradeRequest = Readonly<{
  network: string;
  sourceAssetId: string;
  sourceQuantity: string;
  assetLabel: string;
  operationId: string;
  sourceLevel: string;
  targetMetadata: Readonly<Record<string, string>>;
}>;

export type AssetUpgradeRecord = AssetUpgradeRequest & Readonly<{
  version: 1;
  phase: UpgradePhase;
  replacementAssetId?: string;
  sourceTitle?: string;
  sourceLevel?: string;
  replacementTitle?: string;
  replacementLevel?: string;
  issueTransactionId?: string;
  burnTransactionId?: string;
}>;

export type AssetUpgradeResult = Readonly<{
  status: 'complete' | 'recoverable';
  record: AssetUpgradeRecord;
  message?: string;
}>;

const RECORD_PREFIX = 'prototype-sandbox:asset-upgrade:v1:';
export const LEVEL_ONE_TITLE = 'Sword Level 1';
export const LEVEL_TWO_TITLE = 'Sword Level 2';
export const LEVEL_ONE_ICON = 'https://samuelasherrivello.github.io/blockchain-integration-service/assets/marketplace/v1/sword-1.png';
export const LEVEL_TWO_ICON = 'https://samuelasherrivello.github.io/blockchain-integration-service/assets/marketplace/v1/sword-2.png';
export const LEVEL_THREE_TITLE = 'Sword Level 3';
export const LEVEL_THREE_ICON = 'https://samuelasherrivello.github.io/blockchain-integration-service/assets/marketplace/v1/sword-3.png';



function recordKey(network: string, sourceAssetId: string) {
  return `${RECORD_PREFIX}${network}:${sourceAssetId}`;
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

// The Upgrade Asset page owns the executable upgrade sequence.
export { demoCreateAssetUpgradeRequest, demoExecuteAssetUpgrade } from './demos/upgrade-asset.ts';
