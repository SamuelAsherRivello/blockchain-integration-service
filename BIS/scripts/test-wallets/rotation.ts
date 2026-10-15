import { readdir } from 'node:fs/promises';
import { createAccount, identify } from '../../packages/integration/src/client/wallet-layer-arkade/account.ts';
import { loadBalance } from '../../packages/integration/src/client/wallet-layer-arkade/balance.ts';
import { listWalletAssets } from '../../packages/integration/src/client/wallet-layer-arkade/assets.ts';
import { validRecovery, phraseWords } from '../../packages/integration/src/client/state-layer-core/recovery-validation.ts';
import { label, network } from './arguments.ts';
import { verifiedInventory } from './inventory.ts';
import { Operations } from './operations.ts';
import { boundedObservation } from './readiness.ts';
import { fail } from './errors.ts';

const networks = ['signet', 'mutinynet'];
const amounts = ['availableSats', 'availableBitcoinSats', 'availableArkadeSats', 'totalSats', 'bitcoinSats', 'arkadeSats'];
const terminal = new Set(['settled', 'failed', 'cancelled']);

async function noOwnedSessions(vault) {
  // Never open browser databases or repair/delete ownership locks. A stale lock
  // is an explicit recovery prerequisite, not permission to replace an identity.
  if ((await readdir(vault.root)).some(name => /^(?:profile-|onboarding-).*\.lock$/.test(name))) fail('rotation-owned-session-active');
}

// The caller supplies fresh public app-journal reads for every registered app
// and both networks. These adapters must not open a nested vault transaction.
// Absence of a pending adapter is deliberately unavailable, never zero.
export async function rotate(vault, options, adapters = {}) {
  if (!options || Object.keys(options).some(key => !['account', 'network'].includes(key))) fail('invalid-rotation-request');
  label(options.account); network(options.network);
  if (adapters.pending !== undefined && typeof adapters.pending !== 'function') fail('rotation-journals-unavailable');
  return vault.transaction(async state => {
    await verifiedInventory(state);
    const account = state.accounts.find(row => row.label === options.account);
    if (!account) fail('account-not-registered');
    if (!account.grant?.active || !networks.every(id => account.grant.networks?.includes(id))) fail('test-grant-unavailable');
    if (account.reportedPending && Object.keys(account.reportedPending).length) fail('rotation-operation-unresolved');
    const records = await new Operations({ transaction: use => use(state) }).list();
    if (records.some(row => !terminal.has(row.state) &&
        [row.intent.profileId, row.intent.target?.profileId].includes(account.profileId))) fail('rotation-operation-unresolved');
    // Creation keeps agent-generated recovery private. Every supported browser
    // restoration requires a retained pair or operation intent, so absence of
    // BOTH is evidence of no application exposure for a new agent identity.
    // Supplied identities may have independent history and never use this proof.
    const neverExposed = account.provenance === 'agent-created' &&
      !state.pairs.some(pair => [pair.player, pair.game].includes(account.label)) &&
      !records.some(row => [row.intent.profileId, row.intent.target?.profileId].includes(account.profileId) ||
        [row.intent.account, row.intent.target?.account].includes(account.label));
    const readPending = adapters.pending ?? (neverExposed ? async () => 0 : undefined);
    if (!readPending) fail('rotation-journals-unavailable');
    const checkSessions = () => (adapters.assertNoOwnedSessions ?? noOwnedSessions)(vault);
    await checkSessions();
    const observations = [];
    // Hold the encrypted-vault transaction lock through observation and commit,
    // preventing a competing runner operation from acquiring a new reservation.
    for (const selectedNetwork of networks) {
      const signal = AbortSignal.timeout(30000), scope = { ...structuredClone(account), network: selectedNetwork };
      let balance, assets, pending;
      try {
        [balance, assets, pending] = await boundedObservation(() => Promise.all([
          (adapters.balance ?? loadBalance)(scope, signal),
          (adapters.assets ?? listWalletAssets)(scope, signal), readPending(scope, signal),
        ]), signal);
      } catch { fail('rotation-observation-unavailable'); }
      if (!balance || !amounts.every(key => Number.isSafeInteger(balance[key]) && balance[key] >= 0) ||
          !Array.isArray(assets) || !Number.isSafeInteger(pending) || pending < 0 ||
          balance.availableSats !== balance.availableArkadeSats || balance.totalSats !== balance.bitcoinSats + balance.arkadeSats ||
          balance.availableBitcoinSats > balance.bitcoinSats || balance.availableArkadeSats > balance.arkadeSats)
        fail('rotation-observation-unavailable');
      if (pending) fail('rotation-operation-unresolved');
      if (assets.length || amounts.some(key => balance[key] !== 0)) fail('rotation-holdings-present');
      observations.push({ network: selectedNetwork, observedAt: new Date().toISOString(), assetCount: 0,
        pendingCount: 0, balances: Object.fromEntries(amounts.map(key => [key, 0])) });
    }
    const signal = AbortSignal.timeout(30000);
    let fresh;
    try { fresh = await boundedObservation(() => (adapters.makeAccount ?? createAccount)(signal, options.network), signal); }
    catch { fail('rotation-account-unavailable'); }
    if (!validRecovery(fresh?.phrase)) fail('rotation-account-unavailable');
    const phrase = phraseWords(fresh.phrase).join(' '), profileId = await identify(phrase);
    if (fresh.profileId !== undefined && fresh.profileId !== profileId) fail('rotation-account-unavailable');
    if (state.archivedAccounts !== undefined && !Array.isArray(state.archivedAccounts)) fail('rotation-archive-invalid');
    const archives = state.archivedAccounts ?? [];
    for (const archive of archives) {
      if (!archive?.account || !Number.isFinite(Date.parse(archive.archivedAt))) fail('rotation-archive-invalid');
      await verifiedInventory({ accounts: [archive.account], pairs: [] });
    }
    if (state.accounts.some(row => row.profileId === profileId) || archives.some(row => row.account.profileId === profileId)) fail('duplicate-identity');
    if (archives.some(row => row.account.label === account.label && row.account.generation >= account.generation)) fail('rotation-archive-invalid');
    if (!Number.isSafeInteger(account.generation + 1)) fail('rotation-generation-invalid');
    await checkSessions();
    const now = new Date().toISOString();
    // Both recovery secrets remain inside one atomic DPAPI-encrypted vault
    // commit. Existing operation journals and browser profiles are untouched.
    const replacement = { label: account.label, phrase, profileId, generation: account.generation + 1,
      provenance: 'agent-created', createdAt: now, grant: structuredClone(account.grant) };
    state.archivedAccounts = [...archives, { account: structuredClone(account), archivedAt: now, observations }];
    state.accounts[state.accounts.indexOf(account)] = replacement;
    return { account: replacement.label, profileId, generation: replacement.generation, provenance: replacement.provenance,
      archived: { profileId: account.profileId, generation: account.generation, archivedAt: now }, observations };
  });
}

