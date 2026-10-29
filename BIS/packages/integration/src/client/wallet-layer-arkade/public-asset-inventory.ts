import { ArkAddress, RestIndexerProvider, hasTerminalSpend } from '@arkade-os/sdk';
import { normalizeAssetMetadata, type BisAsset } from '../state-layer-core/assets.ts';
import { resolveBisAssetFormat } from '../state-layer-core/asset-format.ts';
import { arkadeReadEndpointForRuntime, type TestNetwork } from '../state-layer-core/test-network.ts';

/** Public-address read only: no wallet construction, storage or signing. */
export async function loadPublicAssetInventory(address: string, signal: AbortSignal, network: TestNetwork): Promise<readonly BisAsset[]> {
  signal.throwIfAborted();
  const script=Array.from(ArkAddress.decode(address).pkScript,byte=>byte.toString(16).padStart(2,'0')).join('');
  const indexer=new RestIndexerProvider(arkadeReadEndpointForRuntime(network));
  const result=await indexer.getVtxos({scripts:[script]});
  signal.throwIfAborted();
  const totals=new Map<string,bigint>();
  for(const coin of result.vtxos) {
    // Ownership includes recoverable/unrolled outputs, as Account Assets does.
    // This address-scoped snapshot never establishes spending capability.
    if(hasTerminalSpend(coin))continue;
    for(const asset of coin.assets ?? []) {
      const amount=BigInt(asset.amount);
      if(!asset.assetId || amount<=0n)throw Error('Invalid public asset holding.');
      totals.set(asset.assetId,(totals.get(asset.assetId)??0n)+amount);
    }
  }
  const assets=await Promise.all([...totals].map(async([assetId,amount])=>{
    const details=await indexer.getAssetDetails(assetId);
    signal.throwIfAborted();
    if(details.assetId!==assetId)throw Error('Asset details mismatch.');
    const metadata=normalizeAssetMetadata(details.metadata,'list'),m=details.metadata;
    const asset={assetId,quantity:amount.toString(),...(typeof m?.name==='string'?{name:m.name}:{}),...(typeof m?.ticker==='string'?{ticker:m.ticker}:{}),...(typeof m?.icon==='string'?{iconUrl:m.icon}:{}),...(Number.isInteger(m?.decimals)&&Number(m?.decimals)>=0?{decimals:Number(m?.decimals)}:{}),...(metadata?{metadata}:{})};
    return metadata ? {...asset,format:resolveBisAssetFormat(asset)} : asset;
  }));
  signal.throwIfAborted();
  return Object.freeze(assets.sort((a,b)=>a.assetId.localeCompare(b.assetId)));
}
