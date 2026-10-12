import type { BisAsset, BisAssetMetadata } from './assets.ts';
import { migrateMarketplaceAssetFormat001 } from './equipment.ts';

export const BIS_LATEST_ASSET_FORMAT_VERSION = '0.0.2' as const;
export type BisAssetFormatDefinition = Readonly<{
  version: string;
  compatiblePredecessors: readonly string[];
  autoUpgrade: boolean;
  predecessorMigrations: Readonly<Record<string, BisAssetFormatMigrator>>;
}>;
export type BisAssetFormatRegistration = Readonly<{
  version: string;
  /** `false` is an explicit opt-out; a mapper describes the immutable
   * replacement to mint for each predecessor holding. */
  predecessors?: Readonly<Record<string, false | BisAssetFormatMigrator>>;
  autoUpgrade?: boolean;
}>;
export type BisAssetFormatMigrationPlan = Readonly<{name:string;ticker:string;amount:string;decimals:number;metadata:BisAssetMetadata;iconUrl?:string}>;
export type BisAssetFormatMigrator = (source: BisAsset) => BisAssetFormatMigrationPlan;
const versionPattern=/^\d+\.\d+\.\d+$/;
export function createBisAssetFormatRegistry(entries: readonly BisAssetFormatRegistration[]): readonly BisAssetFormatDefinition[] {
  const versions=new Set<string>();
  return Object.freeze(entries.map((entry,index)=>{
    if(!versionPattern.test(entry.version)||versions.has(entry.version))throw Error('Asset format versions must be unique semantic versions.');
    versions.add(entry.version);
    const predecessors=entry.predecessors??{};
    if(index>0&&Object.keys(predecessors).length===0)throw Error('A successor format must explicitly decide every predecessor migration.');
    for(const [version,decision] of Object.entries(predecessors))if(!versions.has(version)||(decision!==false&&typeof decision!=='function'))throw Error('An asset-format predecessor must already be registered with an explicit migration decision.');
    const predecessorMigrations=Object.freeze(Object.fromEntries(Object.entries(predecessors).filter(([,decision])=>typeof decision==='function')) as Record<string,BisAssetFormatMigrator>);
    return Object.freeze({version:entry.version,compatiblePredecessors:Object.freeze(Object.keys(predecessorMigrations)),predecessorMigrations,autoUpgrade:entry.autoUpgrade??true});
  }));
}
/** 0.0.2 completes the structured item envelope.  0.0.1 holdings were
 * issued before descriptions and attribute deltas were immutable chain data,
 * so Admin replaces them before retiring the source holding. */
export const bisAssetFormats = createBisAssetFormatRegistry([
  {version:'0.0.1'},
  {version:BIS_LATEST_ASSET_FORMAT_VERSION,predecessors:{'0.0.1':migrateMarketplaceAssetFormat001}},
]);

export function assetFormatDefinition(version: string): BisAssetFormatDefinition | undefined {
  return bisAssetFormats.find(entry=>entry.version===version);
}
/** Adds a registered format marker to metadata constructed by a BIS format
 * handler. Callers cannot silently mint an unregistered future envelope. */
export function formatAssetMetadata(metadata:BisAssetMetadata,version:string=BIS_LATEST_ASSET_FORMAT_VERSION):BisAssetMetadata {
  if(!assetFormatDefinition(version))throw Error('The requested asset format is not registered.');
  return Object.freeze({...metadata,bisAssetFormatVersion:version});
}
export function assetFormatMigrator(targetVersion:string,sourceVersion:string):BisAssetFormatMigrator|undefined {
  return assetFormatDefinition(targetVersion)?.predecessorMigrations[sourceVersion];
}
export type BisAssetFormatResolution = Readonly<
  | { status: 'supported'; version: string; explicit: boolean }
  | { status: 'unknown-version'; version: string }
  | { status: 'malformed-version' }
  | { status: 'not-bis-format' }
>;

/** Version 0.0.1's legacy recognition is deliberately strict enough to avoid
 * promoting an arbitrary third-party holding from its display fields. */
function isLegacy001(metadata: BisAssetMetadata): boolean {
  return metadata.bisSchemaVersion === '1' && typeof metadata.bisGameId === 'string'
    && typeof metadata.bisAssetType === 'string' && typeof metadata.bisCatalogId === 'string';
}

export function resolveBisAssetFormat(asset: Pick<BisAsset, 'metadata'>): BisAssetFormatResolution {
  const metadata = asset.metadata;
  if (!metadata) return Object.freeze({ status: 'not-bis-format' });
  const version = metadata.bisAssetFormatVersion;
  if (version === undefined) return Object.freeze(isLegacy001(metadata)
    ? { status: 'supported', version: '0.0.1', explicit: false }
    : { status: 'not-bis-format' });
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) return Object.freeze({ status: 'malformed-version' });
  if (assetFormatDefinition(version)) return Object.freeze({ status: 'supported', version, explicit: true });
  return Object.freeze({ status: 'unknown-version', version });
}

export function isLatestBisAssetFormat(asset: Pick<BisAsset, 'metadata'|'format'>): boolean {
  const format = asset.format ?? resolveBisAssetFormat(asset);
  return format.status === 'supported' && format.version === BIS_LATEST_ASSET_FORMAT_VERSION;
}
