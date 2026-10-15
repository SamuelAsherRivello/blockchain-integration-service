import type { RestIndexerProvider } from '@arkade-os/sdk';
import { normalizedQuery } from '../state-layer-core/read-coordinator.ts';

type Query = Parameters<RestIndexerProvider['getVtxos']>;
type Result = Awaited<ReturnType<RestIndexerProvider['getVtxos']>>;
const pending = new Map<string, Promise<Result>>();

/** Share only simultaneous identical live reads, never completed ownership data.
 * Temporary balance/assets SDK wallets otherwise have separate in-flight maps.
 * Each caller retains its own failure latch and lifecycle signal checks.
 */
export function shareIndexerReads(provider: RestIndexerProvider, operator: string) {
  const read = provider.getVtxos.bind(provider);
  provider.getVtxos = (...args: Query) => {
    const key=normalizedQuery([operator,args]);
    const existing=pending.get(key);
    if(existing)return existing;
    let timer:ReturnType<typeof setTimeout>;
    const work=Promise.race([
      Promise.resolve().then(()=>read(...args)),
      new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Indexer read timed out.')),25000);}),
    ]).finally(()=>{clearTimeout(timer);if(pending.get(key)===work)pending.delete(key);});
    pending.set(key,work);
    return work;
  };
  return provider;
}
