import { ArkAddress, RestIndexerProvider } from '@arkade-os/sdk';

const operator = 'https://signet.arkade.sh';
const hex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');

/** Reads public Signet inventory only. It creates no wallet and cannot sign. */
export async function readPublicInventory(address: string, signal: AbortSignal): Promise<ReadonlyMap<string, bigint>> {
  const script = hex(ArkAddress.decode(address).pkScript);
  const result = await new RestIndexerProvider(operator).getVtxos({scripts:[script]});
  signal.throwIfAborted();
  const totals = new Map<string, bigint>();
  for (const coin of result.vtxos) {
    if (coin.isSpent || coin.isSwept || coin.isUnrolled) continue;
    for (const asset of coin.assets ?? []) totals.set(asset.assetId, (totals.get(asset.assetId) ?? 0n) + BigInt(asset.amount));
  }
  return totals;
}
