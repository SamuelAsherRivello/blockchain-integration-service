import { lstat, readFile } from 'node:fs/promises';
import { identify, createAccount } from '../../packages/integration/src/client/wallet-layer-arkade/account.ts';
import { phraseWords, validRecovery } from '../../packages/integration/src/client/state-layer-core/recovery-validation.ts';
import { label, network } from './arguments.mjs';
import { publicManifest, validatePrivatePath } from './vault.mjs';
import { fail } from './errors.mjs';

export async function verifiedInventory(state) {
  const labels = new Set(), identities = new Set();
  for (const account of state.accounts) {
    label(account.label);
    if (!validRecovery(account.phrase) || await identify(account.phrase) !== account.profileId ||
        !Number.isSafeInteger(account.generation) || account.generation < 1 ||
        !['supplied', 'agent-created'].includes(account.provenance)) fail('vault-identity-mismatch');
    if (labels.has(account.label) || identities.has(account.profileId)) fail('duplicate-identity');
    if (account.reportedPending !== undefined) {
      if (!account.reportedPending || typeof account.reportedPending !== 'object' || Array.isArray(account.reportedPending)) fail('pending-history-invalid');
      for (const [selectedNetwork, report] of Object.entries(account.reportedPending)) {
        network(selectedNetwork);
        if (report?.kind !== 'onboard' || report.source !== 'user-reported' ||
            typeof report.reportedAt !== 'string' || !Number.isFinite(Date.parse(report.reportedAt))) fail('pending-history-invalid');
      }
    }
    labels.add(account.label); identities.add(account.profileId);
  }
  const pairs = new Set();
  for (const pair of state.pairs) {
    label(pair.label); network(pair.network);
    if (pairs.has(pair.label) || !labels.has(pair.player) || !labels.has(pair.game) || pair.player === pair.game) fail('invalid-role-assignment');
    pairs.add(pair.label);
  }
  return state;
}
export async function register(vault, records, provenance) {
  if (!Array.isArray(records) || records.length < 1 || records.length > 100 || !['supplied', 'agent-created'].includes(provenance)) fail('unsupported-private-input');
  const prepared = [];
  for (const record of records) {
    label(record?.label);
    if (typeof record.phrase !== 'string' || !validRecovery(record.phrase)) fail('unsupported-private-input');
    const phrase = phraseWords(record.phrase).join(' ');
    prepared.push({ label: record.label, phrase, profileId: await identify(phrase) });
  }
  if (new Set(prepared.map(x => x.label)).size !== prepared.length ||
      new Set(prepared.map(x => x.profileId)).size !== prepared.length) fail('duplicate-identity');
  // Each identity is a durable checkpoint, so interruption cannot discard an earlier import.
  for (const record of prepared) await vault.transaction(async state => {
    await verifiedInventory(state);
    const existing = state.accounts.find(x => x.label === record.label);
    if (existing) {
      if (existing.profileId !== record.profileId) fail('registered-identity-conflict');
      return;
    }
    if (state.accounts.some(x => x.profileId === record.profileId)) fail('duplicate-identity');
    state.accounts.push({ ...record, generation: 1, provenance, createdAt: new Date().toISOString(),
      grant: { active: true, networks: ['signet', 'mutinynet'], source: 'user-standing-test-grant-2026-10-11' } });
  });
  return status(vault);
}
export async function importAccounts(vault, input) {
  const path = await validatePrivatePath(input);
  const info = await lstat(path);
  if (!info.isFile() || info.size > 64 * 1024 || info.nlink !== 1) fail('unsupported-private-input');
  await vault.protector.check(path);
  let records;
  try { records = JSON.parse(await readFile(path, 'utf8')); } catch { fail('unsupported-private-input'); }
  return register(vault, records, 'supplied');
}
export async function importSharedAccounts(vault, read) {
  const { readSharedEnvironment, testAccountEnvironmentKeys } = await import('../../packages/shared/src/server/environment.mjs');
  const { values } = readSharedEnvironment({ keys: testAccountEnvironmentKeys, ...(read ? { read } : {}) });
  const records = testAccountEnvironmentKeys.flatMap((key, index) => values[key]?.trim()
    ? [{ label: `test-account-${index + 1}`, phrase: values[key] }] : []);
  if (!records.length) fail('shared-test-accounts-not-configured');
  return register(vault, records, 'supplied');
}
export async function create(vault, accountLabel, selectedNetwork) {
  label(accountLabel); network(selectedNetwork);
  // Check for conflicts before invoking the production account creation/validation flow.
  await vault.transaction(async state => {
    await verifiedInventory(state);
    if (state.accounts.some(x => x.label === accountLabel)) fail('registered-identity-conflict');
  });
  const account = await createAccount(AbortSignal.timeout(30000), selectedNetwork);
  return register(vault, [{ label: accountLabel, phrase: account.phrase }], 'agent-created');
}
export async function status(vault, { network: selectedNetwork, account: accountLabel } = {}) {
  if (selectedNetwork !== undefined) network(selectedNetwork);
  if (accountLabel !== undefined) label(accountLabel);
  return vault.transaction(async state => {
    await verifiedInventory(state);
    const result = publicManifest(state);
    return { ...result, accounts: result.accounts.filter(x => !accountLabel || x.label === accountLabel).map(x => ({
      ...x, networks: (selectedNetwork ? [selectedNetwork] : ['signet', 'mutinynet']).map(id =>
        state.accounts.find(account => account.label === x.label).reportedPending?.[id]
          ? { network: id, readiness: 'pending', reason: 'user-reported-onboarding-unreconciled' }
          : { network: id, readiness: 'unavailable', reason: 'live-observation-required' }),
    })) };
  });
}
// Supplied history is not provider evidence and contains no assumed balances.
// Preserve it durably so a restart cannot erase knowledge of an external
// automatic onboarding operation. Re-import must not clear this hold.
export async function recordPendingOnboarding(vault, accounts, selectedNetwork) {
  network(selectedNetwork);
  if (!Array.isArray(accounts) || !accounts.length || new Set(accounts).size !== accounts.length) fail('invalid-pending-history');
  accounts.forEach(label);
  return vault.transaction(async state => {
    await verifiedInventory(state);
    if (accounts.some(id => !state.accounts.some(account => account.label === id && account.provenance === 'supplied')))
      fail('pending-history-account-unavailable');
    for (const id of accounts) {
      const account = state.accounts.find(account => account.label === id);
      account.reportedPending ??= {};
      account.reportedPending[selectedNetwork] ??= { kind: 'onboard', source: 'user-reported', reportedAt: new Date().toISOString() };
    }
    return { accounts, network: selectedNetwork, readiness: 'pending', reason: 'user-reported-onboarding-unreconciled' };
  });
}
export async function assign(vault, { pair, player, game, network: selectedNetwork }) {
  label(pair); label(player); label(game); network(selectedNetwork);
  if (player === game) fail('role-conflict');
  return vault.transaction(async state => {
    await verifiedInventory(state);
    if (![player, game].every(id => state.accounts.some(x => x.label === id))) fail('account-not-registered');
    const existing = state.pairs.find(x => x.label === pair);
    if (existing) {
      if (existing.player !== player || existing.game !== game || existing.network !== selectedNetwork) fail('role-reassignment-requires-reconciliation');
    } else state.pairs.push({ label: pair, player, game, network: selectedNetwork });
    return { label: pair, player, game, network: selectedNetwork };
  });
}
