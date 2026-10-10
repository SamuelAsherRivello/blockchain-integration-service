import { bisMarketplaceItems, classifyBisEquipmentAsset, type BisListAssetsResult, type BisMintAssetRequest, type BisMintAssetResult } from '@bis/integration';
import { marketplaceCatalogItems, marketplaceMintRequest, verifiedMarketplaceRecordsFromAssets, type MintedMarketplaceCatalogItem } from './marketplace-catalog.ts';

export type MarketplaceMintBatchWallet = Readonly<{
  mint(request: BisMintAssetRequest): Promise<BisMintAssetResult>;
  listAssets(): Promise<BisListAssetsResult>;
}>;

export type MarketplaceMintBatchResult =
  | Readonly<{ status: 'verified'; records: readonly MintedMarketplaceCatalogItem[] }>
  | Readonly<{ status: 'error'; itemName?: string; operationId?: string; code: string; submissionBoundary?: 'preflight'|'submitted'|'unknown' }>;
export type MarketplaceMintProgress = Readonly<{stage:'minting';itemName:string;operationId:string;attempt:number;submissionBoundary:'preflight'|'submitted'|'unknown'}>
  | Readonly<{stage:'retrying';itemName:string;operationId:string;attempt:number;delayMs:number;code:string;submissionBoundary:'preflight'}>
  | Readonly<{stage:'minted';itemName:string;operationId:string;status:string;submissionBoundary:'submitted'}>
  | Readonly<{stage:'verifying'}>;

const transientRetryCount = 8;
const transientRetryDelayMs = 1000;
const pause = (milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, milliseconds));

export async function mintAndVerifyMarketplaceCatalog(wallet: MarketplaceMintBatchWallet, isCurrent: () => boolean, onProgress: (progress: MarketplaceMintProgress) => void = () => {}, operationVersion = 'v2'): Promise<MarketplaceMintBatchResult> {
  const completedCatalogIds = new Set<string>();
  try {
    const existing = await wallet.listAssets();
    if (existing.status === 'success') {
      const counts = new Map<string, number>();
      for (const asset of existing.assets) {
        const item = classifyBisEquipmentAsset(asset);
        if (item) counts.set(item.catalogId, (counts.get(item.catalogId) ?? 0) + 1);
      }
      for (const item of bisMarketplaceItems) if (counts.get(item.catalogId) === 1) completedCatalogIds.add(item.catalogId);
    }
  } catch {
    // A failed warm listing must not manufacture completion or change the
    // operation IDs. The per-item mint call remains the recovery boundary.
  }
  for (const item of marketplaceCatalogItems) {
    const request = marketplaceMintRequest(item, operationVersion);
    if (completedCatalogIds.has(item.id)) {
      onProgress({stage:'minted',itemName:item.name,operationId:request.operationId,status:'already-minted',submissionBoundary:'submitted'});
      continue;
    }
    let result: BisMintAssetResult;
    for (let attempt = 0; ; attempt++) {
      if (!isCurrent()) return { status: 'error', code: 'account-changed' };
      onProgress({stage:'minting',itemName:item.name,operationId:request.operationId,attempt:attempt+1,submissionBoundary:'preflight'});
      result = await wallet.mint(request);
      // The asset API reports any post-submission uncertainty as outcome-unknown.
      // Only a pre-submission unavailable result is safe to retry while its
      // replacement VTXO becomes spendable after the preceding catalog mint.
      if (result.status !== 'error' || result.code !== 'unavailable' || attempt === transientRetryCount - 1) break;
      onProgress({stage:'retrying',itemName:item.name,operationId:request.operationId,attempt:attempt+1,delayMs:transientRetryDelayMs,code:result.code,submissionBoundary:'preflight'});
      await pause(transientRetryDelayMs);
    }
    if (result.status === 'error') return { status: 'error', itemName: item.name, operationId: request.operationId, code: result.code, submissionBoundary: result.code === 'outcome-unknown' ? 'unknown' : 'preflight' };
    onProgress({stage:'minted',itemName:item.name,operationId:result.operationId,status:result.status,submissionBoundary:'submitted'});
    const itemRead = await wallet.listAssets();
    if (itemRead.status === 'error') return { status: 'error', itemName: item.name, operationId: request.operationId, code: itemRead.code, submissionBoundary: 'submitted' };
    if (!isCurrent()) return { status: 'error', itemName: item.name, operationId: request.operationId, code: 'account-changed', submissionBoundary: 'submitted' };
    const itemMatches = itemRead.assets.filter(asset => classifyBisEquipmentAsset(asset)?.catalogId === item.id);
    if (itemMatches.length !== 1) return { status: 'error', itemName: item.name, operationId: request.operationId, code: 'verification-failed', submissionBoundary: 'submitted' };
  }
  if (!isCurrent()) return { status: 'error', code: 'account-changed' };
  onProgress({stage:'verifying'});
  const fresh = await wallet.listAssets();
  if (fresh.status === 'error') return { status: 'error', code: fresh.code };
  if (!isCurrent()) return { status: 'error', code: 'account-changed' };
  const records = verifiedMarketplaceRecordsFromAssets(fresh.assets);
  return records ? { status: 'verified', records } : { status: 'error', code: 'verification-failed' };
}
