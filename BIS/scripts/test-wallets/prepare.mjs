import { observe } from './observations.mjs';
import { fund } from './funding.mjs';
import { reconcileFaucet } from './reconcile.mjs';
import { Operations } from './operations.mjs';
import { argumentsFor } from './arguments.mjs';
import { readinessTarget } from './readiness.mjs';
import { fail } from './errors.mjs';

export async function prepare(vault, options, adapters = {}) {
  argumentsFor(['prepare', ...Object.entries(options).flatMap(([key, value]) => [`--${key}`, String(value)])]);
  const target = readinessTarget(options);
  const view = () => observe(vault, { account: options.account, network: options.network,
    expect: options.expect, bitcoin: options.bitcoin, arkade: options.arkade }, adapters.observations ?? {});
  const saved = options.operation ? (await new Operations(vault).list()).find(row => row.intent.id === options.operation) : undefined;
  if (saved && (saved.intent.account !== options.account || saved.intent.network !== options.network ||
      saved.intent.kind !== 'faucet' || saved.intent.amountSats !== Number(options.amount) ||
      options.api !== undefined && saved.intent.sourceOrigin !== options.api)) fail('preparation-intent-conflict');
  // Reconcile original submitted work before using balances to make any new
  // decision. This path cannot issue a funding POST, even after cache loss.
  if (saved && ['submitting', 'pending', 'unknown'].includes(saved.state)) {
    const recovery = await (adapters.reconcile ?? reconcileFaucet)(vault, saved.intent.id);
    return { ...await view(), funding: 'original-operation-checked', operation: recovery.operation,
      recovery: { readiness: recovery.readiness, reason: recovery.reason } };
  }
  const before = await view(), observed = before.accounts[0]?.networks[0];
  if (!observed) fail('account-not-registered');
  if (target.expect === 'empty' || ['pending', 'unavailable'].includes(observed.readiness)) return { ...before, funding: 'not-requested' };
  if (observed.balances?.availableBitcoinSats >= target.bitcoinSats && observed.balances?.availableArkadeSats >= target.arkadeSats)
    return { ...before, funding: 'not-needed' };
  if (saved) return { ...before, funding: 'not-repeated', operation: saved };
  if (!options.source) return { ...before, funding: 'required', reason: 'explicit-funding-source-required' };
  if (observed.balances?.availableBitcoinSats < target.bitcoinSats)
    return { ...before, funding: 'unavailable', reason: 'bitcoin-funding-adapter-unavailable' };
  const funded = await (adapters.fund ?? fund)(vault, { account: options.account, network: options.network,
    source: options.source, amount: options.amount, operation: options.operation, ...(options.api ? { api: options.api } : {}) });
  // Fresh reads still do not replace exact receipt verification or app journals.
  return { ...await view(), funding: 'requested', operation: funded.operation,
    recovery: { readiness: funded.readiness, reason: funded.reason } };
}
