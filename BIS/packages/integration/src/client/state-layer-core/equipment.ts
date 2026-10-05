import type { BisAsset, BisAssetMetadata } from './assets';

export const BIS_STEALTH_AND_STEEL_GAME_ID = 'stealth-and-steel' as const;

export type BisEquipmentFamily = 'Shoes' | 'Dagger' | 'Shield';
export type BisEquipmentTier = 1 | 2 | 3;

export type BisEquipmentDefinition = Readonly<{
  catalogId: string;
  name: string;
  ticker: string;
  family: BisEquipmentFamily;
  tier: BisEquipmentTier;
  priceSats: number;
  effectPercent: 10 | 20 | 30;
  effect: string;
  iconUrl: string;
}>;

export type BisEquipmentItem = BisEquipmentDefinition & Readonly<{
  assetId: string;
  quantity: string;
}>;

const publicAssetRoot = 'https://samuelasherrivello.github.io/blockchain-integration-service/assets/marketplace/v1';
const familyData = [
  ['shoes', 'Shoes', 'SHO', 'increase movement speed', [1000, 2000, 3000]],
  ['dagger', 'Dagger', 'DAG', 'increase player damage', [1100, 2100, 3100]],
  ['shield', 'Shield', 'SHI', 'reduce damage taken', [1200, 2200, 3200]],
] as const;
const roman = ['I', 'II', 'III'] as const;
const effects = [10, 20, 30] as const;

export const bisMarketplaceItems: readonly BisEquipmentDefinition[] = Object.freeze(
  familyData.flatMap(([slug, family, ticker, effect, prices]) => effects.map((effectPercent, index) => Object.freeze({
    catalogId: `stealth-steel-${slug}-${index + 1}`,
    name: `${family} ${roman[index]}`,
    ticker: `${ticker}${index + 1}`,
    family,
    tier: (index + 1) as BisEquipmentTier,
    priceSats: prices[index],
    effectPercent,
    effect: `${effectPercent}% ${effect}.`,
    iconUrl: `${publicAssetRoot}/${slug}-${index + 1}.png`,
  }))),
);

const byCatalogId = new Map(bisMarketplaceItems.map(item => [item.catalogId, item]));

export function marketplaceItemMetadata(item: BisEquipmentDefinition): BisAssetMetadata {
  return Object.freeze({
    bisAssetType: 'item',
    bisCatalogId: item.catalogId,
    bisEquipmentFamily: item.family,
    bisGameId: BIS_STEALTH_AND_STEEL_GAME_ID,
    bisPriceSats: String(item.priceSats),
    bisTier: String(item.tier),
  });
}

function isCredentialFreeHttps(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function classifyBisEquipmentAsset(asset: BisAsset): BisEquipmentItem | null {
  const metadata = asset.metadata;
  if (!metadata
    || metadata.bisSchemaVersion !== '1'
    || metadata.bisGameId !== BIS_STEALTH_AND_STEEL_GAME_ID
    || metadata.bisAssetType !== 'item'
    || typeof metadata.bisCatalogId !== 'string'
    || !isCredentialFreeHttps(asset.iconUrl)) return null;

  const definition = byCatalogId.get(metadata.bisCatalogId);
  if (!definition
    || metadata.bisEquipmentFamily !== definition.family
    || metadata.bisTier !== String(definition.tier)
    || metadata.bisPriceSats !== String(definition.priceSats)) return null;

  try {
    if (BigInt(asset.quantity) <= 0n) return null;
  } catch {
    return null;
  }

  return Object.freeze({ ...definition, assetId: asset.assetId, quantity: asset.quantity, iconUrl: asset.iconUrl });
}
