import type { ContractManager, RestIndexerProvider, VirtualCoin, ReadonlyWallet } from '@arkade-os/sdk';

/** Attempt-local complete live evidence, never a display cache. Read every
 * registered contract (including inactive/recoverable), from time zero, and
 * validate all pagination. Project ONLY these outputs, not the repository's
 * upsert-only union. A vanished old output must not survive a successful read.
 * SDK aggregate methods retain their own boarding/spendability validation.
 */
export async function readCompleteContracts(
  manager: Pick<ContractManager, 'getContracts' | 'annotateVtxos'>,
  provider: Pick<RestIndexerProvider, 'getVtxos'>,
  signal: AbortSignal,
) {
  const contracts = await manager.getContracts();
  const all: VirtualCoin[] = [];
  const seen = new Set<string>();
  const scripts = [...new Set(contracts.map(contract => contract.script))];
  // Bound request size without SDK's fixed inter-page pause. Requests remain
  // sequential and have the caller's original deadline, not a new page budget.
  for (let offset = 0; offset < scripts.length; offset += 50) {
    const chunk = scripts.slice(offset, offset + 50);
    let pageIndex = 0, expectedTotal: number | undefined;
    while (true) {
      signal.throwIfAborted();
      const response = await provider.getVtxos({scripts:chunk,after:0,pageIndex,pageSize:500});
      signal.throwIfAborted();
      if (!Array.isArray(response.vtxos)) throw Error('Incomplete ownership response.');
      for (const coin of response.vtxos) {
        const key = `${coin.txid}:${coin.vout}`;
        if (!chunk.includes(coin.script) || seen.has(key)) throw Error('Inconsistent ownership response.');
        seen.add(key); all.push(coin);
      }
      const page = response.page;
      if (!page) {
        if (response.vtxos.length >= 500) throw Error('Missing ownership pagination.');
        break;
      }
      // Wire `current` is the one-based page number; request `pageIndex` and
      // `next` are zero-based indexes (SDK RestIndexerProvider follows this).
      if (![page.current,page.next,page.total].every(Number.isSafeInteger) || page.current !== pageIndex+1 ||
          page.total < 0 || (expectedTotal !== undefined && expectedTotal !== page.total)) throw Error('Inconsistent ownership pagination.');
      expectedTotal = page.total;
      if (page.total === 0) { if(response.vtxos.length)throw Error('Incomplete ownership pagination.'); break; }
      if (page.current > page.total) throw Error('Inconsistent ownership pagination.');
      if (page.current === page.total) break;
      if (page.next !== pageIndex + 1 || response.vtxos.length === 0) throw Error('Incomplete ownership pagination.');
      pageIndex = page.next;
    }
  }
  const annotated = await manager.annotateVtxos(all);
  signal.throwIfAborted();
  if (annotated.length !== all.length) throw Error('Incomplete ownership annotation.');
  return contracts.map(contract => ({contract, vtxos:annotated.filter(coin => coin.script === contract.script).map(coin => ({...coin,contractScript:contract.script}))}));
}

/** SDK aggregation otherwise catches retryable sync failures and returns its
 * repository. A per-attempt read view overrides the public snapshot seam,
 * without mutating the retained manager or holding the submission lane.
 * History, metadata and settlement are never prerequisites for fresh reads.
 */
export async function withCompleteSnapshot<T>(wallet: ReadonlyWallet, signal: AbortSignal, use: (wallet: ReadonlyWallet) => Promise<T>) {
  const manager = await wallet.getContractManager();
  const snapshot = await readCompleteContracts(manager, wallet.indexerProvider, signal);
  const contracts=Object.create(manager) as typeof manager;
  contracts.getContractsWithVtxos = async filter => snapshot.filter(({contract}) => !filter ||
    Object.entries(filter).every(([key,value]) => value === undefined ||
      (Array.isArray(value) ? value.includes(Reflect.get(contract,key)) : Reflect.get(contract,key) === value)));
  const view=Object.create(wallet) as ReadonlyWallet;
  view.getContractManager=async()=>contracts;
  const result = await use(view);
  signal.throwIfAborted();
  return result;
}
