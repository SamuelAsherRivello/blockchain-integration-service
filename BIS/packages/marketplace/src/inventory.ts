import { ArkAddress, RestIndexerProvider } from '@arkade-os/sdk';
import { normalizeAssetMetadata, type BisAsset } from '@bis/integration';

const operator = 'https://signet.arkade.sh';
const hex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');

/** Reads public Signet inventory only. It creates no wallet and cannot sign. */
export async function readPublicInventory(address: string, signal: AbortSignal): Promise<readonly BisAsset[]> {
  const script = hex(ArkAddress.decode(address).pkScript);
  const indexer=new RestIndexerProvider(operator);
  const result = await indexer.getVtxos({scripts:[script]});
  signal.throwIfAborted();
  const totals = new Map<string, bigint>();
  for (const coin of result.vtxos) {
    if (coin.isSpent || coin.isSwept || coin.isUnrolled) continue;
    for (const asset of coin.assets ?? []) totals.set(asset.assetId, (totals.get(asset.assetId) ?? 0n) + BigInt(asset.amount));
  }
  const assets:BisAsset[]=[];
  for(const [assetId,amount] of totals){
    const details=await indexer.getAssetDetails(assetId);signal.throwIfAborted();
    if(details.assetId!==assetId)throw Error('Asset details mismatch.');
    const metadata=normalizeAssetMetadata(details.metadata,'list'),m=details.metadata;
    assets.push({assetId,quantity:amount.toString(),...(typeof m?.name==='string'?{name:m.name}:{}),...(typeof m?.ticker==='string'?{ticker:m.ticker}:{}),...(typeof m?.icon==='string'?{iconUrl:m.icon}:{}),...(Number.isInteger(m?.decimals)&&Number(m?.decimals)>=0?{decimals:Number(m?.decimals)}:{}),...(metadata?{metadata}:{})});
  }
  return Object.freeze(assets.sort((a,b)=>a.assetId.localeCompare(b.assetId)));
}
