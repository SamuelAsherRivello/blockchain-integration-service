import { classifyBisEquipmentAsset, type BisAsset, type BisBurnAssetRequest, type BisBurnAssetResult, type BisListAssetsResult } from '@bis/integration';
import { marketplaceCatalogItems } from './marketplace-catalog.ts';

export type MarketplaceBurnBatchWallet = Readonly<{
  listAssets(): Promise<BisListAssetsResult>;
  burnAsset(request: BisBurnAssetRequest): Promise<BisBurnAssetResult>;
}>;

export type MarketplaceBurnBatchResult = Readonly<{
  status: 'complete' | 'partial' | 'error';
  eligible: number;
  burned: number;
  unresolved: number;
  skipped: number;
  results: readonly Readonly<{assetId:string;status:string;code?:string}>[];
}>;
export type MarketplaceBurnProgress = Readonly<{stage:'listing';burned:number}>
  | Readonly<{stage:'burning';assetId:string;name?:string;burned:number}>
  | Readonly<{stage:'burned';assetId:string;name?:string;burned:number}>
  | Readonly<{stage:'error';assetId:string;name?:string;code:string;burned:number}>;

export function marketplaceBurnRequest(assetId: string, quantity: string): BisBurnAssetRequest {
  return {operationId:`marketplace-burn-v1-${assetId}`,assetId,quantity};
}

export function marketplaceListingBurnRequest(assetId: string, quantity: string): BisBurnAssetRequest {
  return {operationId:`marketplace-listing-burn-v1-${assetId}`,assetId,quantity};
}

function listingTarget(asset: BisAsset) {
  const metadata = asset.metadata ?? {};
  if (metadata.bisGameId !== 'stealth-and-steel' || metadata.bisAssetType !== 'item') return null;
  const expected = marketplaceCatalogItems.find(item => metadata.bisCatalogId === item.id);
  if (!expected || metadata.bisEquipmentFamily !== expected.family || metadata.bisTier !== String(expected.tier) || metadata.bisPriceSats !== String(expected.priceSats)) return null;
  return { ...expected, assetId: asset.assetId, quantity: asset.quantity };
}

/** Finds exactly the nine known store catalog assets, including legacy metadata. */
export function exactMarketplaceListingTargets(assets: readonly BisAsset[]) {
  const targets = assets.map(listingTarget).filter((item): item is NonNullable<ReturnType<typeof listingTarget>> => item !== null);
  if (targets.length !== marketplaceCatalogItems.length) return null;
  if (new Set(targets.map(item => item.id)).size !== marketplaceCatalogItems.length) return null;
  return marketplaceCatalogItems.map(expected => targets.find(item => item.id === expected.id)!);
}

/** Burns the exact current Marketplace listing before the next catalog mint. */
export async function burnMarketplaceListing(wallet: MarketplaceBurnBatchWallet, isCurrent: () => boolean, onProgress: (progress: MarketplaceBurnProgress) => void = () => {}): Promise<MarketplaceBurnBatchResult> {
  const initial = await wallet.listAssets();
  if (initial.status === 'error' || !isCurrent()) return {status:'error',eligible:0,burned:0,unresolved:0,skipped:0,results:[]};
  const targets = exactMarketplaceListingTargets(initial.assets);
  if (!targets) return {status:'error',eligible:0,burned:0,unresolved:0,skipped:0,results:[]};
  const results: {assetId:string;status:string;code?:string}[] = [];
  let burned = 0;
  for (const target of targets) {
    if (!isCurrent()) return {status:'partial',eligible:targets.length,burned,unresolved:0,skipped:1,results};
    onProgress({stage:'burning',assetId:target.assetId,name:target.name,burned});
    const result = await wallet.burnAsset(marketplaceListingBurnRequest(target.assetId,target.quantity));
    if (result.status === 'burned') { burned++; results.push({assetId:target.assetId,status:'burned'}); onProgress({stage:'burned',assetId:target.assetId,name:target.name,burned}); continue; }
    results.push({assetId:target.assetId,status:'error',code:result.code});
    onProgress({stage:'error',assetId:target.assetId,name:target.name,code:result.code,burned});
    return {status:'partial',eligible:targets.length,burned,unresolved:result.code === 'outcome-unknown' ? 1 : 0,skipped:result.code === 'outcome-unknown' ? 0 : 1,results};
  }
  const remaining = await wallet.listAssets();
  if (remaining.status === 'error' || !isCurrent() || exactMarketplaceListingTargets(remaining.assets) !== null) return {status:'partial',eligible:targets.length,burned,unresolved:1,skipped:0,results};
  return {status:'complete',eligible:targets.length,burned,unresolved:0,skipped:0,results};
}

export async function burnAllMarketplaceItems(wallet: MarketplaceBurnBatchWallet, isCurrent: () => boolean, onProgress: (progress: MarketplaceBurnProgress) => void = () => {}): Promise<MarketplaceBurnBatchResult> {
  const results: {assetId:string;status:string;code?:string}[] = [];
  const attempted = new Set<string>();
  let eligible=0,burned=0,unresolved=0,skipped=0;
  while (isCurrent()) {
    onProgress({stage:'listing',burned});
    const fresh = await wallet.listAssets();
    if (fresh.status === 'error' || !isCurrent()) return results.length ? {status:'partial',eligible,burned,unresolved,skipped,results} : {status:'error',eligible:0,burned:0,unresolved:0,skipped:0,results:[]};
    const item = fresh.assets.map(classifyBisEquipmentAsset).find(item => item !== null && !attempted.has(item.assetId));
    if (!item) break;
    eligible++;
    attempted.add(item.assetId);
    onProgress({stage:'burning',assetId:item.assetId,name:item.name,burned});
    const result = await wallet.burnAsset(marketplaceBurnRequest(item.assetId,item.quantity));
    if (result.status === 'burned') { burned++;results.push({assetId:item.assetId,status:'burned'});onProgress({stage:'burned',assetId:item.assetId,name:item.name,burned});continue; }
    results.push({assetId:item.assetId,status:'error',code:result.code});
    onProgress({stage:'error',assetId:item.assetId,name:item.name,code:result.code,burned});
    if (result.code === 'outcome-unknown') unresolved++; else skipped++;
    if (result.code === 'account-changed') break;
  }
  return {status:unresolved===0&&skipped===0?'complete':'partial',eligible,burned,unresolved,skipped,results};
}
