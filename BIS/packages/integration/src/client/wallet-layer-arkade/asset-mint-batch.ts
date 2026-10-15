import { RestIndexerProvider } from '@arkade-os/sdk';
import { AssetError, readAssetRecords, type BisMintAssetRequest } from '../state-layer-core/assets.ts';
import { selectAssetMintBatch } from '../state-layer-core/asset-mint-batch.ts';
import { testNetwork, type TestNetwork } from '../state-layer-core/test-network.ts';

/** Read-only batch preparation; never creates a wallet, signs, or clears recovery records. */
export async function prepareAssetMintBatch(profileId: string, network: TestNetwork, requests: readonly BisMintAssetRequest[]): Promise<readonly BisMintAssetRequest[]> {
  const records = readAssetRecords(profileId, network);
  const fingerprint = JSON.stringify(records);
  const provider = new RestIndexerProvider(testNetwork(network).operator);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const prepared = await Promise.race([
      selectAssetMintBatch(requests, records, async assetId => {
        const details = await provider.getAssetDetails(assetId);
        if (details.assetId !== assetId || !/^\d+$/.test(String(details.supply))) throw new AssetError('unavailable');
        return BigInt(details.supply);
      }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new AssetError('unavailable')), 15000); }),
    ]);
    if (JSON.stringify(readAssetRecords(profileId, network)) !== fingerprint) throw new AssetError('outcome-unknown');
    return prepared;
  } finally { if (timer) clearTimeout(timer); }
}
