import test from 'node:test';
import assert from 'node:assert/strict';
import { ArkAddress } from '@arkade-os/sdk';
import { assertAssignedCandidate, assertNode24Runtime, assertReadOnlyCaseQuote, classifyReadOnlyPrerequisite, createProtectedVaultCaseJournalReader, FUNDED_WORKFLOW_CASES, loadAssignedEnvironmentMnemonic, loadAssignedMnemonic, preparePaymentSdkQuote, preflightFundedWorkflow, preflightFromProtectedJournal, readOnlyWalletEligibility,
  type FundedCaseAssignment, type FundedWorkflowPreflight, type ReadOnlyCaseQuote } from '../scripts/tests/funded-workflow-preflight.ts';

function ready(overrides: Partial<FundedWorkflowPreflight> = {}): FundedWorkflowPreflight {
  const cases = FUNDED_WORKFLOW_CASES.map((workflow, index): FundedCaseAssignment => {
    const network = index % 2 ? 'mutinynet' : 'signet';
    const profileId = network === 'signet' ? 'a'.repeat(64) : 'b'.repeat(64);
    return { workflow, network, candidateId: `${network}:01`, accountLabel: `${network}-case-${index}`, generation: 1,
      profileId, outpoints: [`${String(index + 1).padStart(64, '0')}:0`], allInSats: 1_000 };
  });
  return {
    runId: 'coordinator-run-0001', candidateIds: { signet: 'signet:01', mutinynet: 'mutinynet:01' }, cases,
    rolling24hSpentSats: { signet: 2_000, mutinynet: 0 }, knownReservedSats: { signet: 0, mutinynet: 0 },
    unknownOperations: [], ...overrides,
  };
}

test('preflight enumerates the six acceptance families and charges the settled Signet 2,000 exactly once', () => {
  assert.deepEqual(FUNDED_WORKFLOW_CASES, ['payment', 'mint', 'delivery', 'burn', 'boarding', 'standard-lto']);
  const result = preflightFundedWorkflow(ready());
  assert.deepEqual(result.totals, { signet: 3_000, mutinynet: 3_000 });
  assert.deepEqual(result.unknownExposure, { signet: 0, mutinynet: 0 });
  assert.equal(result.operationCapSats, 5_000);
  assert.equal(result.network24hCapSats, 10_000);
  assert.equal(result.financialActions, 0);
});

test('actual runtime version guard accepts only Node 24', () => {
  assertNode24Runtime('v24.1.2');
  for (const version of ['v22.0.0', 'v26.7.0', 'garbage']) assert.throws(() => assertNode24Runtime(version), /Node 24/);
});

test('read-only eligibility is case-specific and does not require quotes for unassigned workflows', () => {
  const balance = { availableArkadeSats: 1_000, availableBitcoinSats: 0, mintMinimumSats: 546, boardingMinimumSats: 330, assets: { ['ab'.repeat(34)]: '2' } };
  assert.equal(classifyReadOnlyPrerequisite('payment', balance).eligibleForNonBroadcastQuote, true);
  assert.equal(classifyReadOnlyPrerequisite('mint', balance).eligibleForNonBroadcastQuote, true);
  assert.equal(classifyReadOnlyPrerequisite('delivery', balance, 'ab'.repeat(34), '2').eligibleForNonBroadcastQuote, true);
  assert.equal(classifyReadOnlyPrerequisite('delivery', balance, 'ab'.repeat(34), '3').eligibleForNonBroadcastQuote, false);
  assert.equal(classifyReadOnlyPrerequisite('burn', balance, 'cd'.repeat(34), '1').eligibleForNonBroadcastQuote, false);
  assert.equal(classifyReadOnlyPrerequisite('boarding', { ...balance, availableBitcoinSats: 329 }).eligibleForNonBroadcastQuote, false);
  assert.equal(classifyReadOnlyPrerequisite('standard-lto', balance).eligibleForNonBroadcastQuote, true);
  assert.equal(classifyReadOnlyPrerequisite('payment', balance).financialActions, 0);
});

test('exact trusted run and slot mismatch is refused before private loader invocation', async () => {
  let reads = 0;
  await assert.rejects(loadAssignedMnemonic({ assignedRunId: 'coordinator-run-0001', assignedCandidateId: 'signet:01',
    requestedRunId: 'other-run-0001', requestedCandidateId: 'signet:01' }, 'v24.1.2', async () => { reads++; return 'secret'; }), /assignment mismatch/);
  await assert.rejects(loadAssignedMnemonic({ assignedRunId: 'coordinator-run-0001', assignedCandidateId: 'signet:01',
    requestedRunId: 'coordinator-run-0001', requestedCandidateId: 'signet:02' }, 'v24.1.2', async () => { reads++; return 'secret'; }), /assignment mismatch/);
  await assert.rejects(readOnlyWalletEligibility({ assignedRunId: 'coordinator-run-0001', assignedCandidateId: 'signet:01',
    requestedRunId: 'other-run-0001', requestedCandidateId: 'signet:01', loadMnemonic: async () => { reads++; return 'secret'; } }), /Node 24|assignment mismatch/);
  assert.equal(reads, 0);
  assert.throws(() => assertAssignedCandidate({ assignedRunId: 'coordinator-run-0001', assignedCandidateId: 'signet:01',
    requestedRunId: 'coordinator-run-0001', requestedCandidateId: 'signet:02' }), /assignment mismatch/);
});

test('private environment lookup is gated by Node 24 and exact assigned run/slot', () => {
  let reads = 0;
  const values = new Proxy({ BIS_GAME_WALLET_SIGNET_01_MNEMONIC: 'ephemeral-test-value' }, {
    get(target, key, receiver) { if (key === 'BIS_GAME_WALLET_SIGNET_01_MNEMONIC') reads++; return Reflect.get(target, key, receiver); },
  });
  const scope = { assignedRunId: 'coordinator-run-0001', assignedCandidateId: 'signet:01',
    requestedRunId: 'coordinator-run-0001', requestedCandidateId: 'signet:01' };
  assert.throws(() => loadAssignedEnvironmentMnemonic(scope, 'v26.0.0', values), /Node 24/);
  assert.throws(() => loadAssignedEnvironmentMnemonic({ ...scope, requestedRunId: 'other-run-0001' }, 'v24.1.2', values), /assignment mismatch/);
  assert.equal(reads, 0);
  assert.equal(loadAssignedEnvironmentMnemonic(scope, 'v24.1.2', values), 'ephemeral-test-value');
  assert.equal(reads, 1);
});

test('preflight includes fees in the per-operation ceiling', () => {
  const input = ready();
  const cases = input.cases.map(item => item.workflow === 'payment' ? { ...item, allInSats: 5_001 } : item);
  assert.throws(() => preflightFundedWorkflow(ready({ cases })), /Invalid or unassigned workflow case/);
});

test('case quote validation binds the exact workflow, network, profile, inputs, fee and expiry', () => {
  const assignment = ready().cases[0]!;
  const quote: ReadOnlyCaseQuote = { workflow: assignment.workflow, network: assignment.network, profileId: assignment.profileId,
    outpoints: assignment.outpoints, amountSats: 900, feeSats: 100, allInSats: 1_000,
    expiresAtMs: 60_000, fingerprint: 'f'.repeat(64), sourceRevision: 'e'.repeat(64) };
  assert.doesNotThrow(() => assertReadOnlyCaseQuote(assignment, quote, 1));
  assert.throws(() => assertReadOnlyCaseQuote(assignment, { ...quote, network: 'mutinynet' }, 1), /quote is invalid/);
  assert.throws(() => assertReadOnlyCaseQuote(assignment, { ...quote, profileId: 'c'.repeat(64) }, 1), /quote is invalid/);
  assert.throws(() => assertReadOnlyCaseQuote(assignment, { ...quote, outpoints: ['bad'] }, 1), /quote is invalid/);
  assert.throws(() => assertReadOnlyCaseQuote(assignment, { ...quote, feeSats: 4_101, allInSats: 5_001 }, 1), /quote is invalid/);
  assert.throws(() => assertReadOnlyCaseQuote(assignment, { ...quote, allInSats: 999 }, 1), /quote is invalid/);
  assert.throws(() => assertReadOnlyCaseQuote(assignment, { ...quote, expiresAtMs: 1 }, 1), /quote is invalid/);
  assert.throws(() => assertReadOnlyCaseQuote(assignment, { ...quote, expiresAtMs: 60_002 }, 1), /quote is invalid/);
});

test('payment planner makes a source-pinned read-only SDK quote using production input and amount rules', async () => {
  const profileId = 'a'.repeat(64), key = new Uint8Array(32).fill(1);
  const own = new ArkAddress(key, key, 'tark').encode();
  const recipient = new ArkAddress(key, new Uint8Array(32).fill(2), 'tark').encode();
  const assignment: FundedCaseAssignment = { workflow: 'payment', network: 'signet', candidateId: 'signet:01', accountLabel: 'signet-player', generation: 1, profileId,
    outpoints: [], allInSats: 1_000, recipient, amountSats: 1_000 };
  let spendableReads = 0;
  const wallet = { dustAmount: 330, getAddress: async () => own, getSpendableVtxos: async () => {
    spendableReads++;
    return [{ txid: '1'.repeat(64), vout: 0, value: 600 }, { txid: '2'.repeat(64), vout: 1, value: 800 }];
  } } as unknown as import('@arkade-os/sdk').ReadonlyWallet;
  const quote = await preparePaymentSdkQuote({ assignment, wallet, reservations: [], sourceRevision: 'e'.repeat(64), now: () => 1_000,
    readPolicy: async () => ({ info: { network: 'signet', vtxoMinAmount: 330n, vtxoMaxAmount: 0n },
      policy: { reason: 'supported', fingerprint: 'f'.repeat(64) } } as never),
  });
  assert.equal(spendableReads, 1);
  assert.equal(quote.amountSats, 1_000);
  assert.equal(quote.feeSats, 0);
  assert.equal(quote.allInSats, 1_000);
  assert.deepEqual(quote.outpoints, [`${'1'.repeat(64)}:0`, `${'2'.repeat(64)}:1`]);
  assert.equal(quote.sourceRevision, 'e'.repeat(64));
});

test('same source profile remains blocked while unrelated unknown exposure is budgeted at the full per-op cap', () => {
  const unknownOperations = [{ network: 'signet' as const, profileId: 'a'.repeat(64), exposureSats: 1_000 }];
  assert.throws(() => preflightFundedWorkflow(ready({ unknownOperations })), /conflicts with assigned source/);
  const unrelated = [{ network: 'signet' as const, profileId: 'c'.repeat(64) }];
  const result = preflightFundedWorkflow(ready({ unknownOperations: unrelated }));
  assert.equal(result.unknownExposure.signet, 5_000);
  assert.equal(result.totals.signet, 3_000);
});

test('overlapping original outpoint blocks a competing source without modifying the unknown journal', () => {
  const point = ready().cases[0]!.outpoints[0]!;
  const unknownOperations = [{ network: 'signet' as const, profileId: 'c'.repeat(64), outpoints: [point], exposureSats: 500 }];
  assert.throws(() => preflightFundedWorkflow(ready({ unknownOperations })), /conflicts with assigned source/);
  assert.equal(unknownOperations[0]!.outpoints[0], point);
});

test('an unrelated unknown from outside the rolling window remains protected but is not charged to today', () => {
  const unknownOperations = [{ network: 'signet' as const, profileId: 'c'.repeat(64), exposureSats: 5_000, observedAtMs: 1 }];
  const result = preflightFundedWorkflow(ready({ unknownOperations }), 100_000_000);
  assert.equal(result.unknownExposure.signet, 0);
  assert.equal(unknownOperations.length, 1);
});

test('known unknown exposure above the new per-operation ceiling remains fully charged only within the rolling window', () => {
  const base = ready(), signetCase = { ...base.cases.find(item => item.workflow === 'payment')!, allInSats: 3_000 };
  const source = [{ network: 'signet' as const, profileId: 'c'.repeat(64), exposureSats: 6_000, observedAtMs: 99_000_000 }];
  const under = preflightFundedWorkflow(ready({ cases: [signetCase], rolling24hSpentSats: { signet: 0, mutinynet: 0 },
    knownReservedSats: { signet: 0, mutinynet: 0 }, unknownOperations: source }), 100_000_000);
  assert.equal(under.unknownExposure.signet, 6_000);
  assert.equal(under.totals.signet, 3_000);
  assert.throws(() => preflightFundedWorkflow(ready({ cases: [{ ...signetCase, allInSats: 5_000 }],
    rolling24hSpentSats: { signet: 0, mutinynet: 0 }, knownReservedSats: { signet: 0, mutinynet: 0 },
    unknownOperations: source }), 100_000_000), /Rolling 24-hour network cap exceeded/);
  const oldUnknown = [{ ...source[0]!, observedAtMs: 1 }];
  const old = preflightFundedWorkflow(ready({ cases: [signetCase], rolling24hSpentSats: { signet: 0, mutinynet: 0 },
    knownReservedSats: { signet: 0, mutinynet: 0 }, unknownOperations: oldUnknown }), 100_000_000);
  assert.equal(old.unknownExposure.signet, 0);
  assert.equal(oldUnknown.length, 1);
  assert.throws(() => preflightFundedWorkflow(ready({ cases: [signetCase], unknownOperations: [{ ...source[0]!,
    profileId: signetCase.profileId, observedAtMs: 1 }] }), 100_000_000), /conflicts with assigned source/);
});

test('a network with no cases in this exact run is not blocked by its protected unknowns', () => {
  const input = ready();
  const cases = input.cases.filter(item => item.network === 'signet');
  const result = preflightFundedWorkflow(ready({ cases, unknownOperations: [{ network: 'mutinynet', profileId: 'd'.repeat(64) }] }));
  assert.equal(result.totals.mutinynet, 0);
  assert.equal(result.unknownExposure.mutinynet, 5_000);
});

test('journal snapshot feeds budget/conflict checks and retains every unknown record', async () => {
  const records = [{ network: 'signet' as const, profileId: 'c'.repeat(64) }];
  let reads = 0;
  const result = await preflightFromProtectedJournal({ ...ready(), nowMs: 100_000_000 }, {
    async readRecentUnknownOperations(nowMs) { reads++; assert.equal(nowMs, 100_000_000); return records; },
  });
  assert.equal(reads, 1);
  assert.equal(result.preservedUnknownOperationCount, 1);
  assert.equal(result.unknownExposure.signet, 5_000);
  assert.equal(records.length, 1);
});

test('protected vault reader verifies identity/grant with read-only snapshots and excludes its operation ids from browser totals', async () => {
  let vaultReads = 0, clientReads = 0;
  const state = { revision: 7, accounts: [{ label: 'signet-player', profileId: 'a'.repeat(64), generation: 1,
    grant: { active: true, networks: ['signet'] } }], operations: [], pairs: [] };
  const reader = createProtectedVaultCaseJournalReader({ runtimeVersion: 'v24.1.0',
    vault: { async read(options) { assert.deepEqual(options, { initialize: false }); vaultReads++; return state; } },
    client: { async readNetworkSnapshot(profileId, network, nowMs, excludeOperationIds) {
      clientReads++; assert.equal(profileId, 'a'.repeat(64)); assert.equal(network, 'signet'); assert.equal(nowMs, 100_000);
      assert.deepEqual(excludeOperationIds, []);
      return { revision: 'f'.repeat(64), reservations: [], rolling24hSpentSats: 0, knownReservedSats: 0, unknownOperations: [] };
    } },
  });
  const assignment = { workflow: 'payment' as const, network: 'signet' as const, candidateId: 'signet:01',
    accountLabel: 'signet-player', generation: 1, profileId: 'a'.repeat(64), outpoints: [], allInSats: 1 };
  await reader.assertAssignedIdentity(assignment);
  assert.equal(vaultReads, 2);
  assert.equal(clientReads, 0);
  assert.equal(state.revision, 7);
  await reader.readCaseSnapshot(100_000, assignment);
  assert.equal(clientReads, 2);
  assert.equal(vaultReads, 6);
});

test('protected vault reader blocks a matching target with an unresolved operation before browser access', async () => {
  let clientReads = 0;
  const assignment = { workflow: 'payment' as const, network: 'signet' as const, candidateId: 'signet:01',
    accountLabel: 'signet-player', generation: 1, profileId: 'a'.repeat(64), outpoints: [], allInSats: 1 };
  const state = { revision: 7, accounts: [{ label: 'signet-player', profileId: assignment.profileId, generation: 1,
    grant: { active: true, networks: ['signet'] } }], pairs: [], operations: [{
    intent: { id: 'operation-1', profileId: 'b'.repeat(64), generation: 1, network: 'signet', amountSats: 900,
      feeSats: 100, target: { profileId: assignment.profileId, generation: 1 } },
    fingerprint: 'c'.repeat(64), state: 'unknown', createdAt: new Date(90_000).toISOString(), updatedAt: new Date(90_000).toISOString(),
  }] };
  const reader = createProtectedVaultCaseJournalReader({ runtimeVersion: 'v24.1.0',
    vault: { async read() { return state; } },
    client: { async readNetworkSnapshot() { clientReads++; throw Error('must not read browser journal'); } },
  });
  await assert.rejects(reader.assertAssignedIdentity(assignment), /unresolved protected operation/);
  assert.equal(clientReads, 0);
});

test('protected vault ledger scopes large history and counts a source/target unknown once while retaining both identities and inputs', async () => {
  const assignment = { workflow: 'payment' as const, network: 'mutinynet' as const, candidateId: 'mutinynet:01',
    accountLabel: 'mutinynet-player', generation: 1, profileId: 'b'.repeat(64), outpoints: [], allInSats: 1 };
  const point = `${'d'.repeat(64)}:4`;
  const state = { revision: 7, accounts: [{ label: 'mutinynet-player', profileId: assignment.profileId, generation: 1,
    grant: { active: true, networks: ['mutinynet'] } }], pairs: [], operations: [
    { intent: { id: 'large-old-signet', profileId: 'c'.repeat(64), generation: 1, network: 'signet', kind: 'arkade-send', amountSats: 80_000, feeSats: 1 },
      fingerprint: 'e'.repeat(64), state: 'settled', createdAt: new Date(80_000).toISOString(), updatedAt: new Date(80_000).toISOString() },
    { intent: { id: 'unknown-source-target', profileId: 'c'.repeat(64), generation: 1, network: 'mutinynet', kind: 'arkade-send', amountSats: 800, feeSats: null,
        target: { profileId: 'd'.repeat(64), generation: 1 },
        capturedInputs: [{ txid: 'd'.repeat(64), vout: 4 }] },
      fingerprint: 'a'.repeat(64), state: 'unknown', createdAt: new Date(90_000).toISOString(), updatedAt: new Date(90_000).toISOString() },
  ] };
  const clientSnapshot = { revision: 'f'.repeat(64), reservations: [], rolling24hSpentSats: 0, knownReservedSats: 0, unknownOperations: [] };
  const reader = createProtectedVaultCaseJournalReader({ runtimeVersion: 'v24.1.0',
    vault: { async read() { return state; } },
    client: { async readNetworkSnapshot() { return clientSnapshot; } },
  });
  const snapshot = await reader.readCaseSnapshot(100_000, assignment);
  assert.equal(snapshot.rolling24hSpentSats, 0);
  assert.equal(snapshot.unknownOperations.length, 1);
  assert.deepEqual(snapshot.unknownOperations[0]?.profileIds, ['c'.repeat(64), 'd'.repeat(64)]);
  assert.equal(snapshot.unknownOperations[0]?.exposureSats, 5_800);
  assert.ok(snapshot.unknownOperations[0]?.outpoints?.includes(point));
  const planned = { ...ready().cases.find(row => row.workflow === 'payment')!, network: 'mutinynet' as const,
    candidateId: 'mutinynet:01', profileId: 'e'.repeat(64), allInSats: 3_000 };
  const budget = preflightFundedWorkflow(ready({ cases: [planned], rolling24hSpentSats: { signet: 0, mutinynet: 0 },
    knownReservedSats: { signet: 0, mutinynet: 0 }, unknownOperations: snapshot.unknownOperations }), 100_000);
  assert.equal(budget.unknownExposure.mutinynet, 5_800);
  assert.throws(() => preflightFundedWorkflow(ready({ cases: [{ ...planned, profileId: 'd'.repeat(64) }],
    rolling24hSpentSats: { signet: 0, mutinynet: 0 }, knownReservedSats: { signet: 0, mutinynet: 0 },
    unknownOperations: snapshot.unknownOperations }), 100_000), /conflicts with assigned source/);
});
