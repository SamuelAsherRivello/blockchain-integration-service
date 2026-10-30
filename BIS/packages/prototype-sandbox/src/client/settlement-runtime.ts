import { Ramps } from '@arkade-os/sdk';
import { demoErrorMessage } from './demo-runtime.ts';

const MATCHING_BATCH_WAIT_MS = 5 * 60 * 1000;

function watchSettlementStream(open, signal, topics, getIntentId, onMatchingFailure) {
  const controller = new AbortController();
  let timeout;
  let deadline;
  let expired = false;
  let source;
  let selectedBatch;

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

export async function demoOnboardBitcoin(wallet, fees) {
  let params;
  const preparationWallet = {
    getAddress: () => wallet.getAddress(),
    getBoardingAddress: () => wallet.getBoardingAddress(),
    getBoardingUtxos: () => wallet.getBoardingUtxos(),
    dustAmount: wallet.dustAmount,
    settle: async value => {
      params = value;
      return 'prepared';
    },
  };

  await new Ramps(preparationWallet).onboard(fees);
  if (!params) throw new Error('The SDK did not prepare an onboarding settlement.');

  const provider = wallet.arkProvider;
  const originalGetEventStream = provider.getEventStream;
  const originalRegisterIntent = provider.registerIntent;
  const openEventStream = originalGetEventStream.bind(provider);
  const registerIntent = originalRegisterIntent.bind(provider);
  let intentId;
  let registrationAttempted = false;
  let matchingFailure;

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
