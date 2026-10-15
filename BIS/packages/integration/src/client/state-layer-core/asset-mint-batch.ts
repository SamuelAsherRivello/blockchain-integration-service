import { AssetError, validateMint, type AssetRecord, type BisMintAssetRequest } from './assets.ts';

/** Generation zero keeps deployed IDs. Generation identity is retained by mint journals. */
export async function selectAssetMintBatch(requests: readonly BisMintAssetRequest[], records: readonly AssetRecord[], supply: (assetId: string) => Promise<bigint>): Promise<readonly BisMintAssetRequest[]> {
  const base = requests.map(validateMint);
  if (!base.length || new Set(base.map(request => request.operationId)).size !== base.length) throw new AssetError('invalid-input');
  function generation(id: string): number | undefined {
    for (const request of base) {
      if (id === request.operationId) return 0;
      const prefix = `${request.operationId}-g`;
      if (!id.startsWith(prefix)) continue;
      const suffix = id.slice(prefix.length);
      if (!/^[1-9]\d*$/.test(suffix) || !Number.isSafeInteger(Number(suffix))) throw new AssetError('outcome-unknown');
      return Number(suffix);
    }
  }
  const relevant = records.filter(record => generation(record.request.operationId) !== undefined);
  const latest = Math.max(0, ...relevant.map(record => generation(record.request.operationId)!));
  let selected = latest;
  const pending = records.filter(record => record.status === 'pending');
  if (pending.some(record => generation(record.request.operationId) !== latest) || pending.length > 1) throw new AssetError('outcome-unknown');
  const idFor = (request: BisMintAssetRequest, value: number) => value ? `${request.operationId}-g${value}` : request.operationId;
  const current = base.map(request => relevant.find(record => record.request.operationId === idFor(request, latest)));
  if (!pending.length && current.every(record => record?.status === 'succeeded')) {
    const supplies = await Promise.all(current.map(record => supply(record!.asset!.assetId)));
    if (supplies.some(value => typeof value !== 'bigint' || value < 0n)) throw new AssetError('unavailable');
    if (supplies.every(value => value === 0n)) selected++;
  }
  if (!Number.isSafeInteger(selected)) throw new AssetError('outcome-unknown');
  return base.map(request => validateMint({...request, operationId: idFor(request, selected)}));
}
