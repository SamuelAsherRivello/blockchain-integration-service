import type { BisAsset } from './assets.ts';
import {writeAssetMigrationRecord,type BisAssetMigrationRecord} from './asset-migration-record.ts';

export type BisAssetMigrationResult = Readonly<{assetId:string;status:'completed'|'pending'|'failed';message:string}>;
export type BisAssetMigrationDependencies = Readonly<{
  isCurrent(): boolean;
  mintAndDeliver(asset: BisAsset): Promise<'delivered'|'pending'>;
  retire(asset: BisAsset): Promise<'retired'|'pending'>;
}>;

/** Runs independent replacement-first migrations. This intentionally contains
 * no polling or wallet construction: callers bind it to the currently active
 * Admin Game Wallet and Player Wallet scope. */
export async function migrateAssets(assets: readonly BisAsset[], deps: BisAssetMigrationDependencies): Promise<readonly BisAssetMigrationResult[]> {
  const results: BisAssetMigrationResult[]=[];
  for (const asset of assets) {
    if (!deps.isCurrent()) {results.push({assetId:asset.assetId,status:'failed',message:'The selected wallet changed.'});break;}
    try {
      const delivery=await deps.mintAndDeliver(asset);
      if (delivery!=='delivered') {results.push({assetId:asset.assetId,status:'pending',message:'Replacement delivery needs recovery.'});continue;}
      if (!deps.isCurrent()) {results.push({assetId:asset.assetId,status:'pending',message:'Replacement delivered; retirement needs recovery.'});continue;}
      const retirement=await deps.retire(asset);
      results.push(retirement==='retired'?{assetId:asset.assetId,status:'completed',message:'Replacement delivered and prior asset retired.'}:{assetId:asset.assetId,status:'pending',message:'Replacement delivered; retirement needs recovery.'});
    } catch {results.push({assetId:asset.assetId,status:'failed',message:'Migration could not start safely.'});}
  }
  return Object.freeze(results.map(result=>Object.freeze(result)));
}

export type BisRecordedAssetMigrationDependencies = Readonly<{
  isCurrent():boolean;
  mintAndDeliver(asset:BisAsset,record:BisAssetMigrationRecord):Promise<Readonly<{status:'delivered'|'pending';replacementAssetId?:string}>>;
  retire(asset:BisAsset,record:BisAssetMigrationRecord):Promise<'retired'|'pending'>;
}>;
/** Reconciles exactly one journaled source item. The record moves forward only:
 * a delivered replacement is never minted again, even after reload. */
export async function reconcileAssetMigration(asset:BisAsset,record:BisAssetMigrationRecord,deps:BisRecordedAssetMigrationDependencies):Promise<BisAssetMigrationRecord> {
  let current=record;
  if(!deps.isCurrent())return current;
  if(current.status==='prepared'||current.status==='replacement-pending') {
    current=writeAssetMigrationRecord({...current,status:'replacement-pending'});
    const replacement=await deps.mintAndDeliver(asset,current);
    if(replacement.status!=='delivered'||!replacement.replacementAssetId)return current;
    current=writeAssetMigrationRecord({...current,status:'replacement-delivered',replacementAssetId:replacement.replacementAssetId});
  }
  if(!deps.isCurrent()||current.status==='completed')return current;
  current=writeAssetMigrationRecord({...current,status:'retirement-pending'});
  const retired=await deps.retire(asset,current);
  return retired==='retired'?writeAssetMigrationRecord({...current,status:'completed'}):current;
}
