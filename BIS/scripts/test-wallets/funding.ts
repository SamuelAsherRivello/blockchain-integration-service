import { loadAddresses } from '../../packages/integration/src/client/wallet-layer-arkade/addresses.ts';
import { watchActivity } from '../../packages/integration/src/client/wallet-layer-arkade/activity.ts';
import { ensureApi, requestFunding } from '../../packages/prototype-faucet/scripts/fund-address.ts';
import { readSharedEnvironment } from '../../packages/shared/src/server/environment.ts';
import { verifiedInventory } from './inventory.ts';
import { Operations } from './operations.ts';
import { origin } from './arguments.ts';
import { fail } from './errors.ts';
import { RestArkProvider } from '@arkade-os/sdk';
import { testNetwork } from '../../packages/integration/src/client/state-layer-core/test-network.ts';
import { inspectTreasureDirectPolicy } from '../../packages/integration/src/client/wallet-layer-arkade/treasure-direct-policy.ts';
import { assertAcceptanceBudget } from '../treasure-acceptance-policy.ts';
import {findTestActor,actorSource} from './server-actors.ts';

/** Narrow 1,000-sat offchain funding. This does not quote/onboard Bitcoin funds
 * or alter unknown-cost legacy intents. SDK Wallet.send conserves input value
 * as recipient plus change; nonzero operator policy remains unsupported. */
export function boundedFaucetCost(network, info, balance) {
  const policy = inspectTreasureDirectPolicy(network, info);
  if (balance?.network !== network || !Number.isSafeInteger(balance.available) || balance.available < 1000 ||
      balance.onboarding && balance.onboarding.status !== 'complete') fail('bounded-faucet-not-spendable');
  return { feeSats: 0, policyFingerprint: policy.fingerprint, availableSats: balance.available };
}
async function readBoundedFaucetCost(api, network) {
  const response = await fetch(`${api}/api/faucet/balance?network=${network}`, {method:'GET',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
  if (!response.ok) fail('bounded-faucet-not-spendable');
  const balance = await response.json(), info = await new RestArkProvider(testNetwork(network).operator).getInfo();
  return {info,balance};
}

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
  const { argumentsFor } = await import('./arguments.ts');
  // Validate even when invoked directly, before any private access or side effect.
  argumentsFor(['fund', ...Object.entries(options).flatMap(([key, value]) => [`--${key}`, String(value)])]);
  const api = adapters.api ?? faucetOrigin(options.api);
  const bounded = Number(options.amount) === 1000;
  const quote = async () => {
    const {info,balance} = await (adapters.cost ?? readBoundedFaucetCost)(api, options.network);
    return boundedFaucetCost(options.network,info,balance);
  };
  const account = await vault.transaction(async state => {
    await verifiedInventory(state);
    const row = findTestActor(state,options.account);
    if (!row) fail('account-not-registered');
    if (!row.grant?.active || !row.grant.networks?.includes(options.network)) fail('test-grant-unavailable');
    return { ...row, network: options.network };
  });
  const addresses = await (adapters.addresses ?? loadAddresses)(account, AbortSignal.timeout(30000));
  const cost = bounded ? await quote() : undefined;
  const ledger = new Operations(vault);
  const intent = { id: options.operation, account: account.label, profileId: account.profileId,
    generation: account.generation, network: options.network, kind: 'faucet',
    recipient: addresses.arkadeAddress, amountSats: Number(options.amount), feeSats: bounded ? 0 : null, sourceOrigin: api };
  if(actorSource(account))intent.serverSource=actorSource(account);
  if (bounded) await vault.transaction(state => {
    assertAcceptanceBudget(state.operations ?? [], intent, Date.now());
    state.boundedFaucetFunding ??= {};
    const previous = state.boundedFaucetFunding[intent.id];
    const binding = {network:intent.network,profileId:intent.profileId,generation:intent.generation,recipient:intent.recipient,amountSats:1000,feeSats:0,sourceOrigin:api};
    if (previous && JSON.stringify(previous.binding) !== JSON.stringify(binding)) fail('operation-intent-conflict');
    if (!previous) state.boundedFaucetFunding[intent.id] = {binding,preparedCost:cost,observedAt:Date.now()};
  });
  await ledger.prepare(intent);
  const operation = await ledger.submit(intent.id, async () => {
    if (bounded) {
      // Recheck just before POST. An unavailable existing API never spawns a
      // competing server, onboards, or triggers replacement funding here.
      const current = await quote();
      if (current.policyFingerprint !== cost.policyFingerprint) fail('bounded-faucet-policy-changed');
      await vault.transaction(state => {state.boundedFaucetFunding[intent.id].submitCost=current;state.boundedFaucetFunding[intent.id].submitObservedAt=Date.now();});
    } else await (adapters.ensure ?? ensureApi)({ api });
    const ack = await (adapters.request ?? requestFunding)({ api, address: intent.recipient,
      network: intent.network, amount: intent.amountSats, idempotencyKey: intent.id },
    (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(30000) }));
    if (ack.network !== intent.network || ack.address !== intent.recipient || ack.amountSats !== intent.amountSats ||
        !/^[a-f0-9]{64}$/.test(ack.operationId ?? '') || bounded && ack.transactionId !== undefined && ack.transactionId !== ack.operationId) fail('faucet-acknowledgement-mismatch');
    return { providerId: ack.operationId };
  });
  if (!['pending', 'unknown', 'submitting'].includes(operation.state)) return { operation };
  let evidence;
  try { evidence = await (adapters.receipt ?? observeReceipt)(account, operation); } catch { /* Unavailable is not zero or success. */ }
  if (!evidence) return { operation, readiness: 'pending', reason: 'recipient-evidence-unavailable' };
  const reconciled = await ledger.reconcile(intent.id, async () => evidence);
  return { operation: reconciled, readiness: reconciled.state === 'settled' ? 'funding-verified' : 'pending' };
}

