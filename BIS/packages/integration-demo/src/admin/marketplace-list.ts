import { classifyBisEquipmentAsset, type BisEquipmentItem, type BisListAssetsResult } from '@bis/integration';

export type MarketplaceListWallet = Readonly<{listAssets(): Promise<BisListAssetsResult>}>;

export type MarketplaceListResult =
  | Readonly<{status:'success';profileId:string;items:readonly BisEquipmentItem[]}>
  | Readonly<{status:'error';code:string;message:string;profileId?:string}>;

/** Reads the current wallet once and retains only recognized marketplace equipment. */
export async function listMarketplaceItems(wallet: MarketplaceListWallet, isCurrent: () => boolean): Promise<MarketplaceListResult> {
  const result = await wallet.listAssets();
  if (result.status === 'error') return result;
  if (!isCurrent()) return {status:'error',code:'account-changed',message:'The game wallet changed while listing items.'};
  return {status:'success',profileId:result.profileId,items:result.assets.map(classifyBisEquipmentAsset).filter((item): item is BisEquipmentItem => item !== null)};
}
