import type { BisAsset } from './assets';

export type BisAssets = Readonly<{ status: 'idle' | 'loading' | 'unavailable' }>
  | Readonly<{ status: 'ready'; assets: readonly BisAsset[] }>;

export function assetExplorerUrl(assetId: string): string | undefined {
  return /^[a-f0-9]{68}$/i.test(assetId) ? `https://explorer.signet.arkade.sh/asset/${assetId}` : undefined;
}

export function assetDecimals(asset: BisAsset): number | undefined {
  return Number.isInteger(asset.decimals) && asset.decimals! >= 0 && asset.decimals! <= 18 ? asset.decimals : undefined;
}
export function assetMetadata(value: string | undefined): string {
  return typeof value === 'string' && value.trim() ? value : 'Not provided';
}
export function shortAssetId(id: string): string {
  return id.length > 20 ? `${id.slice(0, 8)}…${id.slice(-8)}` : id;
}
export function assetName(asset: BisAsset): string {
  return typeof asset.name === 'string' && asset.name.trim() ? asset.name : `Asset ${shortAssetId(asset.assetId)}`;
}
export function formatAssetQuantity(asset: BisAsset): string {
  const decimals = assetDecimals(asset);
  if (decimals === undefined) return `${asset.quantity} base units`;
  const digits = asset.quantity.padStart(decimals + 1, '0');
  const quantity = decimals ? `${digits.slice(0, -decimals)}.${digits.slice(-decimals)}` : digits;
  return `${quantity}${typeof asset.ticker === 'string' && asset.ticker.trim() ? ` ${asset.ticker}` : ''}`;
}
export function formatAssetDetail(asset: BisAsset): string {
  return [
    `Asset ID: ${asset.assetId}`,
    `Owned quantity: ${formatAssetQuantity(asset)}`,
    `Owned quantity (base units): ${asset.quantity}`,
    formatAssetMetadata(asset),
    `Icon URL: ${assetMetadata(asset.iconUrl)}`,
    `Explorer URL: ${assetExplorerUrl(asset.assetId) ?? 'Not available'}`,
  ].join('\n');
}
export function formatAssetMetadata(asset: BisAsset): string {
  return [
    `Name: ${assetMetadata(asset.name)}`,
    `Ticker: ${assetMetadata(asset.ticker)}`,
    `Decimals: ${assetDecimals(asset) ?? 'Not provided'}`,
  ].join('\n');
}
