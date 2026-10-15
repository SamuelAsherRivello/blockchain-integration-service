import { BIS_LATEST_ASSET_FORMAT_VERSION, classifyBisEquipmentAsset, resolveBisAssetFormat, type BisEquipmentItem, type BisListAssetsResult } from '@bis/integration';

export type MarketplaceListWallet = Readonly<{listAssets(): Promise<BisListAssetsResult>}>;

export type MarketplaceListResult =
  | Readonly<{status:'success';profileId:string;items:readonly BisEquipmentItem[]}>
  | Readonly<{status:'error';code:string;message:string;profileId?:string}>;

/** Reads the current wallet once and retains only recognized marketplace equipment. */
export async function listMarketplaceItems(wallet: MarketplaceListWallet, isCurrent: () => boolean, onProgress: (progress: Readonly<{stage:'listing'}|{stage:'classifying';total:number}>) => void = () => {}, formatVersion: string = BIS_LATEST_ASSET_FORMAT_VERSION): Promise<MarketplaceListResult> {
  onProgress({stage:'listing'});
  const result = await wallet.listAssets();
  if (result.status === 'error') return result;
  if (!isCurrent()) return {status:'error',code:'account-changed',message:'The game wallet changed while listing items.'};
  onProgress({stage:'classifying',total:result.assets.length});
  const items=result.assets.filter(asset=>{
    const format=resolveBisAssetFormat(asset);
    return format.status==='supported'&&format.version===formatVersion;
  }).map(asset=>classifyBisEquipmentAsset(asset,formatVersion)).filter((item): item is BisEquipmentItem => item !== null);
  return {status:'success',profileId:result.profileId,items};
}
