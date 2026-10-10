import type { BisAsset, BisAssetMetadata, BisAttributeDelta } from './assets';

export const BIS_STEALTH_AND_STEEL_GAME_ID = 'stealth-and-steel' as const;

export type BisEquipmentFamily = 'Shoes' | 'Dagger' | 'Shield';
export type BisEquipmentTier = 1 | 2 | 3;
export type BisEquipmentAttribute = 'movementSpeed' | 'playerDamage' | 'damageTaken';

export type BisEquipmentDefinition = Readonly<{
  catalogId: string;
  name: string;
  ticker: string;
  family: BisEquipmentFamily;
  tier: BisEquipmentTier;
  priceSats: number;
  description: string;
  attributeDeltas: readonly BisAttributeDelta[];
  iconUrl: string;
}>;

export type BisEquipmentItem = BisEquipmentDefinition & Readonly<{
  assetId: string;
  quantity: string;
}>;
export type BisEquipmentClassificationStatus = 'ready' | 'generic' | 'migration-required' | 'invalid-metadata';

const publicAssetRoot = 'https://samuelasherrivello.github.io/blockchain-integration-service/assets/marketplace/v1';
const familyData = [
  ['shoes', 'Shoes', 'SHO', 'movementSpeed', 'movement speed', [1000, 2000, 3000]],
  ['dagger', 'Dagger', 'DAG', 'playerDamage', 'player damage', [1100, 2100, 3100]],
  ['shield', 'Shield', 'SHI', 'damageTaken', 'damage taken', [1200, 2200, 3200]],
] as const;
const roman = ['I', 'II', 'III'] as const;
const effects = [10, 20, 30] as const;

export const bisMarketplaceItems: readonly BisEquipmentDefinition[] = Object.freeze(
  familyData.flatMap(([slug, family, ticker, attribute, effectLabel, prices]) => effects.map((attributeDelta, index) => Object.freeze({
    catalogId: `stealth-steel-${slug}-${index + 1}`,
    name: `${family} ${roman[index]}`,
    ticker: `${ticker}${index + 1}`,
    family,
    tier: (index + 1) as BisEquipmentTier,
    priceSats: prices[index],
    description: `${family === 'Shield' ? 'Reduces' : 'Increases'} ${effectLabel} by ${attributeDelta}%.`,
    attributeDeltas: Object.freeze([{bisAttribute: attribute, bisAttributeDelta: family === 'Shield' ? -attributeDelta : attributeDelta}]),
    iconUrl: `${publicAssetRoot}/${slug}-${index + 1}.png`,
  }))),
);

const byCatalogId = new Map(bisMarketplaceItems.map(item => [item.catalogId, item]));
const allowedAttributes = new Set<BisEquipmentAttribute>(['movementSpeed', 'playerDamage', 'damageTaken']);

export function marketplaceItemMetadata(item: BisEquipmentDefinition): BisAssetMetadata {
  return Object.freeze({
    bisAssetType: 'item',
    bisCatalogId: item.catalogId,
    bisEquipmentFamily: item.family,
    bisDescription: item.description,
    bisAttributeDeltas: item.attributeDeltas,
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

function readAttributeDeltas(value: unknown): readonly BisAttributeDelta[] | null {
  if (!Array.isArray(value) || !value.length) return null;
  const attributes = new Set<string>();
  const deltas: BisAttributeDelta[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)
      || typeof entry.bisAttribute !== 'string' || !allowedAttributes.has(entry.bisAttribute as BisEquipmentAttribute)
      || typeof entry.bisAttributeDelta !== 'number' || !Number.isSafeInteger(entry.bisAttributeDelta)
      || entry.bisAttributeDelta < -100 || entry.bisAttributeDelta > 100
      || attributes.has(entry.bisAttribute)) return null;
    attributes.add(entry.bisAttribute);
    deltas.push(Object.freeze({bisAttribute: entry.bisAttribute, bisAttributeDelta: entry.bisAttributeDelta}));
  }
  return Object.freeze(deltas);
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

  // Chain metadata is the only gameplay authority. A legacy holding may still
  // appear in generic inventory, but it is not classified/equippable until
  // both its presentation and structured gameplay fields are present.
  const description = typeof metadata.bisDescription === 'string' && metadata.bisDescription.trim()
    ? metadata.bisDescription
    : undefined;
  const attributeDeltas = readAttributeDeltas(metadata.bisAttributeDeltas);
  if (!description || !attributeDeltas) return null;

  try {
    if (BigInt(asset.quantity) <= 0n) return null;
  } catch {
    return null;
  }

  return Object.freeze({ ...definition, description, attributeDeltas, assetId: asset.assetId, quantity: asset.quantity, iconUrl: asset.iconUrl });
}

/**
 * Reports why a positive generic holding is not a Marketplace item. This is
 * intentionally separate from classification so generic inventory remains
 * visible and no presentation field is promoted into gameplay authority.
 */
export function inspectBisEquipmentAsset(asset: BisAsset): BisEquipmentClassificationStatus {
  if (!asset.metadata) return 'generic';
  const metadata = asset.metadata;
  const hasMarketplaceEnvelope = metadata.bisGameId !== undefined || metadata.bisAssetType !== undefined
    || metadata.bisCatalogId !== undefined || metadata.bisEquipmentFamily !== undefined;
  if (!hasMarketplaceEnvelope) return 'generic';
  if (metadata.bisGameId !== BIS_STEALTH_AND_STEEL_GAME_ID || metadata.bisAssetType !== 'item'
    || typeof metadata.bisCatalogId !== 'string' || !byCatalogId.has(metadata.bisCatalogId)) return 'invalid-metadata';
  if (metadata.bisDescription === undefined || metadata.bisAttributeDeltas === undefined) return 'migration-required';
  return classifyBisEquipmentAsset(asset) ? 'ready' : 'invalid-metadata';
}
