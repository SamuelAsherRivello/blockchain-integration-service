import { loadPublicAssetInventory } from '../wallet-layer-arkade/public-asset-inventory.ts';
import { assetError, type BisListAssetsResult } from './assets.ts';
import { getSharedAssetInventory, prepareSharedAssetInventory, invalidateSharedAssetInventory, type SharedAssetInventoryRole } from './shared-asset-inventory.ts';
import type { TestNetwork } from './test-network.ts';

export type BisPublicAssetInventoryRequest = Readonly<{
  role: SharedAssetInventoryRole;
  /** Public profile identity, or the public address itself for guest browsing. */
  profileId: string;
  address: string;
  network: TestNetwork;
}>;
const valid=(input:BisPublicAssetInventoryRequest)=>input && ['player','game'].includes(input.role) &&
  typeof input.profileId==='string' && !!input.profileId.trim() && typeof input.address==='string' && !!input.address.trim() &&
  ['signet','mutinynet'].includes(input.network);

/** Internal dependency seam; the public export uses the real read-only adapter. */
export function createPublicAssetInventory(load=loadPublicAssetInventory) {
  return (input:BisPublicAssetInventoryRequest,force=false):Promise<BisListAssetsResult> => {
    if(!valid(input))return Promise.resolve(assetError('invalid-input'));
    return prepareSharedAssetInventory({...input,force,load:signal=>load(input.address,signal,input.network)});
  };
}
export const preparePublicAssetInventory=createPublicAssetInventory();
/** Returns a fresh presentation cache entry without starting a provider read. */
export function getPublicAssetInventory(input: BisPublicAssetInventoryRequest): BisListAssetsResult | undefined {
  return valid(input) ? getSharedAssetInventory(input.role,input.profileId,input.network,input.address) : undefined;
}
/** Evidence/lifecycle invalidation; explicit Refresh uses force and joins live work. */
export function invalidatePublicAssetInventory(input:BisPublicAssetInventoryRequest):void {
  if(valid(input))invalidateSharedAssetInventory(input.profileId,input.network,input.role,input.address);
}
