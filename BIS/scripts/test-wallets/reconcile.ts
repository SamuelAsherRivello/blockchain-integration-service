import { Operations } from './operations.ts';
import { verifiedInventory } from './inventory.ts';
import { observeReceipt } from './funding.ts';
import { label, origin } from './arguments.ts';
import { boundedObservation } from './readiness.ts';
import { fail } from './errors.ts';

export async function reconcileFaucet(vault, operationId, adapters = {}) {
  label(operationId);
  const ledger = new Operations(vault);
  let operation = (await ledger.list()).find(row => row.intent.id === operationId);
  if (!operation) fail('operation-not-found');
  if (operation.intent.kind !== 'faucet') fail('reconcile-adapter-unavailable');
  if (['settled', 'failed', 'cancelled'].includes(operation.state)) return { operation };
  if (operation.state === 'prepared') return { operation, readiness: 'incomplete', reason: 'operation-not-submitted' };
  const account = await vault.transaction(async state => {
    await verifiedInventory(state);
    const current = state.accounts.find(row => row.label === operation.intent.account);
    if (!current || current.profileId !== operation.intent.profileId || current.generation !== operation.intent.generation)
      fail('operation-identity-changed');
    // Revocation denies new submission, not read-only recovery of original work.
    return { ...current, network: operation.intent.network };
  });
  const signal = AbortSignal.timeout(30000);
  if (!operation.providerId) {
    try {
      const api = origin(operation.intent.sourceOrigin);
      const response = await boundedObservation(() => (adapters.fetch ?? fetch)(
        `${api}/api/faucet/status/${encodeURIComponent(operation.intent.id)}?by=request`,
        { method: 'GET', cache: 'no-store', redirect: 'error', signal }), signal);
      if (!response.ok) throw Error();
      const ack = await boundedObservation(() => response.json(), signal);
      if (ack.network !== operation.intent.network || ack.address !== operation.intent.recipient ||
          ack.amountSats !== operation.intent.amountSats || !/^[a-f0-9]{64}$/.test(ack.operationId ?? '') ||
          ack.transactionId !== undefined && ack.transactionId !== ack.operationId) throw Error();
      operation = await ledger.reconcile(operationId, async saved => ({ id: operationId, fingerprint: saved.fingerprint,
        providerId: ack.operationId, outcome: 'pending' }));
    } catch {
      // Cache loss, an old API, malformed evidence or network failure is not
      // proof of no submission. Never start an API or issue another POST.
      return { operation, readiness: 'pending', reason: 'original-faucet-acknowledgement-unavailable' };
    }
  }
  let evidence;
  try { evidence = await boundedObservation(() => (adapters.receipt ?? observeReceipt)(account, operation), signal); }
  catch { /* Preserve the original reservation. */ }
  if (!evidence) return { operation, readiness: 'pending', reason: 'recipient-evidence-unavailable' };
  const settled = await ledger.reconcile(operationId, async () => evidence);
  return { operation: settled, readiness: settled.state === 'settled' ? 'funding-verified' : 'pending' };
}

