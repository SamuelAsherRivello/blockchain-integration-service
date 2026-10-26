import { fail } from './errors.ts';

export function readinessTarget(options = {}) {
  if (options.expect === undefined) {
    if (options.bitcoin !== undefined || options.arkade !== undefined) fail('readiness-target-required');
    return undefined;
  }
  if (!['empty', 'funded'].includes(options.expect)) fail('invalid-readiness-target');
  if (options.expect === 'empty') {
    if (options.bitcoin !== undefined || options.arkade !== undefined) fail('invalid-readiness-target');
    return { expect: 'empty' };
  }
  const sats = value => {
    if (typeof value === 'string' && /^(0|[1-9]\d{0,15})$/.test(value)) value = Number(value);
    if (!Number.isSafeInteger(value) || value < 0) fail('invalid-readiness-target');
    return value;
  };
  const bitcoinSats = sats(options.bitcoin ?? 0), arkadeSats = sats(options.arkade ?? (options.bitcoin === undefined ? 1 : 0));
  if (bitcoinSats === 0 && arkadeSats === 0) fail('invalid-readiness-target');
  return { expect: 'funded', bitcoinSats, arkadeSats };
}

export function classifyReadiness(balance, assetCount, target, pendingCount) {
  if (!target) return { readiness: 'incomplete', reason: 'scenario-and-application-journals-unverified' };
  if (pendingCount !== undefined && (!Number.isSafeInteger(pendingCount) || pendingCount < 0)) fail('live-read-invalid');
  if (pendingCount > 0) return { readiness: 'pending', reason: 'application-operation-unresolved' };
  if (target.expect === 'empty' && (balance.totalSats > 0 || assetCount > 0))
    return { readiness: 'dirty', reason: 'empty-target-has-holdings' };
  if (pendingCount === undefined) return { readiness: 'incomplete', reason: 'application-journals-unverified' };
  if (target.expect === 'empty') return { readiness: 'empty', reason: 'verified-zero-holdings' };
  return balance.availableBitcoinSats >= target.bitcoinSats && balance.availableArkadeSats >= target.arkadeSats
    ? { readiness: 'ready', reason: 'verified-spendable-target' }
    : { readiness: 'incomplete', reason: 'insufficient-spendable-funds' };
}

// SDK adapters must receive cancellation, but may not honor it. Bound the
// caller independently without treating a timeout as a zero balance.
export async function boundedObservation(read, signal) {
  signal.throwIfAborted();
  let abort;
  try {
    return await Promise.race([Promise.resolve().then(read), new Promise((_, reject) => {
      abort = () => reject(new Error('observation-cancelled'));
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    })]);
  } finally { signal.removeEventListener('abort', abort); }
}

// Await the value, not the truthiness of a Promise returned by a browser poller.
export async function pollOwnedObservation(read, signal, intervalMs = 100) {
  for (;;) {
    const value = await boundedObservation(read, signal);
    if (value) return value;
    await boundedObservation(() => new Promise(resolve => setTimeout(resolve, intervalMs)), signal);
  }
}

