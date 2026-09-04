export type BisAsset = Readonly<{ assetId: string; name?: string; ticker?: string; quantity: string; decimals?: number; iconUrl?: string }>;
export type BisMintAssetRequest = Readonly<{ operationId: string; name: string; ticker: string; amount: string; decimals: number; iconUrl?: string }>;
export type BisAssetErrorCode = 'account-required' | 'invalid-input' | 'insufficient-funds' | 'unavailable' | 'outcome-unknown' | 'account-changed' | 'disposed' | 'unsupported-environment' | 'busy';
export type BisAssetError = Readonly<{ status: 'error'; code: BisAssetErrorCode; message: string; profileId?: string; operationId?: string }>;
export type BisMintAssetResult = Readonly<{ status: 'minted' | 'already-minted'; profileId: string; operationId: string; asset: BisAsset; transactionId?: string }> | BisAssetError;
export type BisListAssetsResult = Readonly<{ status: 'success'; profileId: string; assets: readonly BisAsset[] }> | BisAssetError;
export type BisPendingMintResult = Readonly<{ status: 'success'; profileId: string; request: BisMintAssetRequest | null }> | BisAssetError;
const messages: Record<BisAssetErrorCode, string> = {
  'account-required': 'An active account is required.', 'invalid-input': 'Check the asset fields and operation ID. Amount must be positive and exactly representable.',
  'insufficient-funds': 'Insufficient spendable funds to mint an asset.', unavailable: 'Assets are unavailable. Try again.',
  'outcome-unknown': 'The mint is unresolved. Retry the same request to reconcile it; no new mint will be submitted.',
  'account-changed': 'The account changed during the request.', disposed: 'This client has been disposed.',
  'unsupported-environment': 'This browser cannot safely coordinate asset operations.', busy: 'Another wallet operation is in progress.',
};
export class AssetError extends Error {
  code: BisAssetErrorCode;
  constructor(code: BisAssetErrorCode) { super(messages[code]); this.code = code; }
}
export function assetError(code: BisAssetErrorCode, profileId?: string, operationId?: string): BisAssetError {
  return { status: 'error', code, message: messages[code], ...(profileId ? { profileId } : {}), ...(operationId ? { operationId } : {}) };
}
export function assetBaseUnits(amount: string, decimals: number): bigint {
  if (typeof amount !== 'string' || amount.length > 100 || !/^\d+(\.\d+)?$/.test(amount) || !Number.isInteger(decimals) || decimals < 0 || decimals > 18) throw new AssetError('invalid-input');
  const [whole, fraction = ''] = amount.split('.');
  if (fraction.length > decimals) throw new AssetError('invalid-input');
  const value = BigInt(whole + fraction.padEnd(decimals, '0'));
  if (value <= 0n || value > 18446744073709551615n) throw new AssetError('invalid-input');
  return value;
}
export function validateMint(input: BisMintAssetRequest): BisMintAssetRequest {
  const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
  if (!input || !text(input.operationId, 128) || !/^[\w-]+$/.test(input.operationId) || !text(input.name, 128) || !text(input.ticker, 16) || 'controlAssetId' in input) throw new AssetError('invalid-input');
  assetBaseUnits(input.amount, input.decimals);
  if (input.iconUrl !== undefined && input.iconUrl !== '') {
    try { const url = new URL(input.iconUrl); if (url.protocol !== 'https:' || url.username || url.password || input.iconUrl.length > 2048) throw Error(); }
    catch { throw new AssetError('invalid-input'); }
  }
  return Object.freeze({operationId: input.operationId, name: input.name, ticker: input.ticker, amount: input.amount, decimals: input.decimals, ...(input.iconUrl ? {iconUrl: input.iconUrl} : {})});
}
export type AssetRecord = { request: BisMintAssetRequest; status: 'pending' | 'succeeded'; asset?: BisAsset; transactionId?: string };
const recordKey = (profileId: string) => `bis-signet-mints-v1:${encodeURIComponent(profileId)}`;
export function readAssetRecords(profileId: string): AssetRecord[] {
  try {
    const raw = localStorage.getItem(recordKey(profileId));
    if (raw === null) return [];
    const r = JSON.parse(raw);
    if (r.version !== 1 || !Array.isArray(r.operations)) throw Error();
    const ids = new Set();
    for (const op of r.operations) {
      validateMint(op.request);
      if (ids.has(op.request.operationId) || !['pending', 'succeeded'].includes(op.status) || (op.status === 'succeeded' && (!op.asset || typeof op.asset.assetId !== 'string' || typeof op.asset.quantity !== 'string'))) throw Error();
      ids.add(op.request.operationId);
    }
    return r.operations;
  } catch { throw new AssetError('outcome-unknown'); }
}
export function checkMintRecord(profileId: string, request: BisMintAssetRequest): AssetRecord | undefined {
  const records = readAssetRecords(profileId);
  const existing = records.find(r => r.request.operationId === request.operationId);
  if (existing && JSON.stringify(validateMint(existing.request)) !== JSON.stringify(validateMint(request))) throw new AssetError('invalid-input');
  if (records.some(r => r.status === 'pending' && r.request.operationId !== request.operationId)) throw new AssetError('outcome-unknown');
  return existing;
}
export function writeAssetRecord(profileId: string, record: AssetRecord) {
  const records = readAssetRecords(profileId);
  const i = records.findIndex(r => r.request.operationId === record.request.operationId);
  if (i >= 0) records[i] = record; else records.push(record);
  try {
    const key = recordKey(profileId), value = JSON.stringify({version: 1, operations: records});
    localStorage.setItem(key, value);
    if (localStorage.getItem(key) !== value) throw Error();
  } catch { throw new AssetError('unavailable'); }
}
