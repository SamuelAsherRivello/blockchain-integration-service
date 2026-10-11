import { loadAddresses } from '../../packages/integration/src/client/wallet-layer-arkade/addresses.ts';
import { watchActivity } from '../../packages/integration/src/client/wallet-layer-arkade/activity.ts';
import { ensureApi, requestFunding } from '../../packages/prototype-faucet/scripts/fund-address.mjs';
import { readSharedEnvironment } from '../../packages/shared/src/server/environment.mjs';
import { verifiedInventory } from './inventory.mjs';
import { Operations } from './operations.mjs';
import { origin } from './arguments.mjs';
import { fail } from './errors.mjs';

function faucetOrigin(explicit) {
  if (explicit) return origin(explicit);
  const port = readSharedEnvironment({ keys: ['FAUCET_PORT'], legacyFaucetFallback: true }).values.FAUCET_PORT || '5190';
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) fail('invalid-faucet-port');
  return `http://127.0.0.1:${Number(port)}`;
}
export async function observeReceipt(account, record) {
  // A balance delta is insufficient: another sender may have funded this account.
  // Require the exact acknowledged transaction among freshly verified spendable receipts.
  if (!/^[a-f0-9]{64}$/.test(record.providerId ?? '')) return undefined;
  const stop = new AbortController();
  let found;
  await watchActivity(account, AbortSignal.any([stop.signal, AbortSignal.timeout(30000)]), rows => {
    found = rows.find(row => row.direction === 'Incoming' && row.receiptVerified === true &&
      row.amountSats === record.intent.amountSats && row.identifier.split(' ').includes(`ark:${record.providerId}`));
    stop.abort();
  });
  return found ? { id: record.intent.id, fingerprint: record.fingerprint,
    providerId: record.providerId, outcome: 'settled', verified: true } : undefined;
}

export async function fund(vault, options, adapters = {}) {
  const { argumentsFor } = await import('./arguments.mjs');
  // Validate even when invoked directly, before any private access or side effect.
  argumentsFor(['fund', ...Object.entries(options).flatMap(([key, value]) => [`--${key}`, String(value)])]);
  const api = adapters.api ?? faucetOrigin(options.api);
  const account = await vault.transaction(async state => {
    await verifiedInventory(state);
    const row = state.accounts.find(x => x.label === options.account);
    if (!row) fail('account-not-registered');
    if (!row.grant?.active || !row.grant.networks?.includes(options.network)) fail('test-grant-unavailable');
    return { ...row, network: options.network };
  });
  const addresses = await (adapters.addresses ?? loadAddresses)(account, AbortSignal.timeout(30000));
  const ledger = new Operations(vault);
  const intent = { id: options.operation, account: account.label, profileId: account.profileId,
    generation: account.generation, network: options.network, kind: 'faucet',
    recipient: addresses.arkadeAddress, amountSats: Number(options.amount), feeSats: null, sourceOrigin: api };
  await ledger.prepare(intent);
  const operation = await ledger.submit(intent.id, async () => {
    await (adapters.ensure ?? ensureApi)({ api });
    const ack = await (adapters.request ?? requestFunding)({ api, address: intent.recipient,
      network: intent.network, amount: intent.amountSats, idempotencyKey: intent.id },
    (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(30000) }));
    if (ack.network !== intent.network || ack.address !== intent.recipient || ack.amountSats !== intent.amountSats ||
        !/^[a-f0-9]{64}$/.test(ack.operationId ?? '')) fail('faucet-acknowledgement-mismatch');
    return { providerId: ack.operationId };
  });
  if (!['pending', 'unknown', 'submitting'].includes(operation.state)) return { operation };
  let evidence;
  try { evidence = await (adapters.receipt ?? observeReceipt)(account, operation); } catch { /* Unavailable is not zero or success. */ }
  if (!evidence) return { operation, readiness: 'pending', reason: 'recipient-evidence-unavailable' };
  const reconciled = await ledger.reconcile(intent.id, async () => evidence);
  return { operation: reconciled, readiness: reconciled.state === 'settled' ? 'funding-verified' : 'pending' };
}
