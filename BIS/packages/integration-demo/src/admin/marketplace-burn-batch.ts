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

export function marketplaceBurnRequest(assetId: string, quantity: string): BisBurnAssetRequest {
  return {operationId:`marketplace-burn-v1-${assetId}`,assetId,quantity};
}

export async function burnAllMarketplaceItems(wallet: MarketplaceBurnBatchWallet, isCurrent: () => boolean): Promise<MarketplaceBurnBatchResult> {
  const fresh = await wallet.listAssets();
  if (fresh.status === 'error' || !isCurrent()) return {status:'error',eligible:0,burned:0,unresolved:0,skipped:0,results:[]};
  const items = fresh.assets.map(classifyBisEquipmentAsset).filter(item => item !== null);
  const results: {assetId:string;status:string;code?:string}[] = [];
  let burned=0,unresolved=0,skipped=0;
  for (const item of items) {
    if (!isCurrent()) { skipped += items.length-results.length; break; }
    const result = await wallet.burnAsset(marketplaceBurnRequest(item.assetId,item.quantity));
    if (result.status === 'burned') { burned++;results.push({assetId:item.assetId,status:'burned'});continue; }
    results.push({assetId:item.assetId,status:'error',code:result.code});
    if (result.code === 'outcome-unknown') unresolved++; else skipped++;
    if (result.code === 'account-changed') { skipped += items.length-results.length;break; }
  }
  return {status:burned===items.length?'complete':'partial',eligible:items.length,burned,unresolved,skipped,results};
}
