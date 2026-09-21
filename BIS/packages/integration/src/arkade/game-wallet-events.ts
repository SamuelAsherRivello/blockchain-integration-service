import { ArkAddress, RestIndexerProvider } from '@arkade-os/sdk';
import { operatorFor } from './account.ts';
import type { TestNetwork } from '../core/test-network.ts';

/** Arkade receipt/spend events only: no balance polling or onchain polling fallback. */
export async function watchGameWalletEvents(address: string, signal: AbortSignal, changed: () => Promise<void>, provider?: RestIndexerProvider, network:TestNetwork='signet'): Promise<void> {
  provider ??= new RestIndexerProvider(operatorFor(network));
  signal.throwIfAborted();
  const script = Array.from(ArkAddress.decode(address).pkScript, byte => byte.toString(16).padStart(2, '0')).join('');
  const id = await provider.subscribeForScripts([script]);
  try {
    signal.throwIfAborted();
    const stream = provider.getSubscription(id, signal);
    for await (const _event of stream) {
      if (signal.aborted) return;
      await changed();
    }
    if (!signal.aborted) throw Error('Game wallet event stream closed.');
  } finally { await provider.unsubscribeForScripts(id).catch(() => {}); }
}
