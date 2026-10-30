import { Ramps } from '@arkade-os/sdk';
import type { Wallet, SettleParams } from '@arkade-os/sdk';
import { demoErrorMessage } from './demo-runtime.ts';

const MATCHING_BATCH_WAIT_MS = 5 * 60 * 1000;
type EventStream = Wallet['arkProvider']['getEventStream'];
type SettlementEvent = ReturnType<EventStream> extends AsyncIterable<infer Event> ? Event : never;
type BatchFailure = Extract<SettlementEvent, { type: 'batch_failed' }>;

function watchSettlementStream(open: EventStream, signal: AbortSignal, topics: string[], getIntentId: () => string | undefined, onMatchingFailure: (event: BatchFailure) => void) {
  const controller = new AbortController();
  let timeout: ReturnType<typeof window.setTimeout> | undefined;
  let deadline!: Promise<never>;
  let expired = false;
  let source: ReturnType<EventStream> | undefined;
  let selectedBatch: string | undefined;

  const abort = () => controller.abort();
  const arm = () => {
    clearTimeout(timeout);
    deadline = new Promise((_, reject) => {
      timeout = window.setTimeout(() => {
        expired = true;
        const error = new Error('No matching Arkade batch response arrived within five minutes.');
        error.name = 'SettlementWaitTimeoutError';
        reject(error);
        abort();
      }, MATCHING_BATCH_WAIT_MS);
    });
  };

  const iterator = (async function* () {
    if (signal?.aborted) return;
    signal?.addEventListener('abort', abort, { once: true });
    try {
      source = open(controller.signal, topics);
      arm();
      while (true) {
        const next = await Promise.race([source.next(), deadline]);
        if (expired) throw Object.assign(new Error('No matching Arkade batch response arrived within five minutes.'), { name: 'SettlementWaitTimeoutError' });
        if (next.done) return;

        const event = next.value;
        if (!getIntentId || (selectedBatch && event.id === selectedBatch && event.type !== 'batch_started')) arm();
        if (event.type === 'batch_failed' && (!selectedBatch || event.id !== selectedBatch)) continue;
        if (event.type === 'batch_failed') onMatchingFailure(event);

        yield event;

        if (event.type === 'batch_started') {
          const intentId = getIntentId();
          if (!intentId) continue;
          const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(intentId));
          const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
          if (event.intentIdHashes?.includes(hash)) {
            selectedBatch = event.id;
            arm();
          }
        }
      }
    } finally {
      clearTimeout(timeout);
      abort();
      signal?.removeEventListener('abort', abort);
      await source?.return?.();
    }
  })();

  const finish = iterator.return.bind(iterator);
  iterator.return = value => {
    abort();
    return finish(value);
  };
  return iterator;
}

export async function demoOnboardBitcoin(wallet: Wallet, fees: Parameters<Ramps['onboard']>[0]) {
  let params: SettleParams | undefined;
  // Preserve the full SDK wallet interface and method receivers while the
  // preparation step captures settlement terms without submitting them.
  const preparationWallet = new Proxy(wallet, {
    get(target, property) {
      if (property === 'settle') return async (value: SettleParams) => {
        params = value;
        return 'prepared';
      };
      const member = Reflect.get(target, property, target);
      return typeof member === 'function' ? member.bind(target) : member;
    },
  });

  await new Ramps(preparationWallet).onboard(fees);
  if (!params) throw new Error('The SDK did not prepare an onboarding settlement.');

  const provider = wallet.arkProvider;
  const originalGetEventStream = provider.getEventStream;
  const originalRegisterIntent = provider.registerIntent;
  const openEventStream = originalGetEventStream.bind(provider);
  const registerIntent = originalRegisterIntent.bind(provider);
  let intentId: string | undefined;
  let registrationAttempted = false;
  let matchingFailure: BatchFailure | undefined;

  provider.getEventStream = (signal, topics) => watchSettlementStream(
    openEventStream,
    signal,
    topics,
    () => intentId,
    event => { matchingFailure = event; },
  );
  provider.registerIntent = async intent => {
    registrationAttempted = true;
    intentId = await registerIntent(intent);
    return intentId;
  };

  try {
    const txid = await wallet.settle(params);
    if (!txid) return { status: 'pending', message: 'The matching settlement returned no transaction ID.' };
    return { status: 'settled', txid };
  } catch (error) {
    if (matchingFailure) {
      return {
        status: 'failed',
        batchId: matchingFailure.id,
        message: matchingFailure.reason || demoErrorMessage(error),
      };
    }
    if (registrationAttempted || intentId) {
      return { status: 'pending', message: demoErrorMessage(error) };
    }
    throw error;
  } finally {
    provider.getEventStream = originalGetEventStream;
    provider.registerIntent = originalRegisterIntent;
  }
}
