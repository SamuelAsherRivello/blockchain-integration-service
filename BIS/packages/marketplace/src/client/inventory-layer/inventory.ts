import { preparePublicAssetInventory, type BisAsset, type BisPublicAssetInventoryRequest } from '@bis/integration';

/** Marketplace consumes BIS presentation reads; provider/cache ownership stays in BIS. */
export async function readPublicInventory(request: BisPublicAssetInventoryRequest, force = false): Promise<readonly BisAsset[]> {
  const result=await preparePublicAssetInventory(request,force);
  if(result.status!=='success' || result.profileId!==request.profileId)throw Error('Public inventory unavailable.');
  return result.assets;
}
