import { classifyBisEquipmentAsset, type BisBurnAssetRequest, type BisBurnAssetResult, type BisListAssetsResult } from '@bis/integration';

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
