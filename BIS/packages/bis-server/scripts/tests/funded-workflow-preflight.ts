import { createWalletPool, readCandidateBalance, type WalletRequirement } from '../../src/server/wallet-pool.ts';
import { InMemoryContractRepository, InMemoryWalletRepository, MnemonicIdentity, ReadonlyWallet, RestArkProvider, RestIndexerProvider } from '@arkade-os/sdk';
import { sendAmounts } from '../../../integration/src/client/state-layer-core/sending.ts';
import { eligibleUnreservedCoins, type ReservedOperation } from '../../../integration/src/client/state-layer-core/wallet-reservations.ts';
import { readWalletNetworkPolicy } from '../../../integration/src/client/wallet-layer-arkade/wallet-network-policy.ts';
import { requireReadablePolicy } from '../../../integration/src/client/state-layer-core/wallet-network-policy.ts';
import { assetTotals, selectExactSendInputs, sendRecipient } from '../../../integration/src/client/wallet-layer-arkade/sending.ts';
import { identify, operatorFor } from '../../../integration/src/client/wallet-layer-arkade/account.ts';
import { Vault } from '../../../../scripts/test-wallets/vault.ts';
import { createHash } from 'node:crypto';

export type FundedWorkflowCase = 'payment' | 'mint' | 'delivery' | 'burn' | 'boarding' | 'standard-lto';
export type TestNetwork = 'signet' | 'mutinynet';
export type FundedCaseAssignment = Readonly<{
  workflow: FundedWorkflowCase; network: TestNetwork; candidateId: string; accountLabel: string; generation: number; profileId: string;
  outpoints: readonly string[]; allInSats: number; assetId?: string; assetQuantity?: string; recipient?: string; amountSats?: number;
}>;
export type RecentUnknown = Readonly<{ network: TestNetwork; profileId?: string; profileIds?: readonly string[]; outpoints?: readonly string[]; exposureSats?: number; observedAtMs?: number }>;
export type FundedWorkflowPreflight = Readonly<{
  runId: string;
  candidateIds: Readonly<Partial<Record<TestNetwork, string>>>;
  cases: readonly FundedCaseAssignment[];
  rolling24hSpentSats: Readonly<Record<TestNetwork, number>>;
  knownReservedSats: Readonly<Record<TestNetwork, number>>;
  unknownOperations: readonly RecentUnknown[];
}>;
export type ProtectedJournalReader = Readonly<{ readRecentUnknownOperations(nowMs: number): Promise<readonly RecentUnknown[]> }>;
export type ProtectedCaseJournalSnapshot = Readonly<{
  revision: string;
  reservations: readonly ReservedOperation[];
  rolling24hSpentSats: number;
  knownReservedSats: number;
  unknownOperations: readonly RecentUnknown[];
}>;
export type ClientWalletJournalSnapshot = Readonly<{
  revision: string;
  reservations: readonly ReservedOperation[];
  rolling24hSpentSats: number;
  knownReservedSats: number;
  unknownOperations: readonly RecentUnknown[];
}>;
export type ClientWalletJournalReader = Readonly<{
  readNetworkSnapshot(profileId: string, network: TestNetwork, nowMs: number, excludeOperationIds: readonly string[]): Promise<ClientWalletJournalSnapshot>;
}>;
export type ProtectedCaseJournalReader = Readonly<{
  assertAssignedIdentity(assignment: FundedCaseAssignment): Promise<void>;
  readCaseSnapshot(nowMs: number, assignment: FundedCaseAssignment): Promise<ProtectedCaseJournalSnapshot>;
}>;

/** Read-only adapter over the protected BIS test-wallet vault and browser journal source. */
export function createProtectedVaultCaseJournalReader(input: { vault?: Pick<Vault, 'read'>; client: ClientWalletJournalReader; runtimeVersion?: string }): ProtectedCaseJournalReader {
  const vault = input.vault ?? new Vault();
  const readVault = async (assignment: FundedCaseAssignment) => {
    assertNode24Runtime(input.runtimeVersion ?? process.versions.node);
    const before = await vault.read({ initialize: false });
    const account = before.accounts?.find((row: any) => row.label === assignment.accountLabel && row.profileId === assignment.profileId &&
      row.generation === assignment.generation);
    if (!account || account.grant?.active !== true || !account.grant.networks?.includes(assignment.network) || account.reportedPending?.[assignment.network])
      throw Error('Assigned registered test identity or grant could not be verified.');
    if (before.operations !== undefined && !Array.isArray(before.operations)) throw Error('Protected operation journal is unavailable.');
    const operations = Array.isArray(before.operations) ? before.operations : [];
    for (const record of operations as readonly any[]) {
      const intent = record?.intent;
      if (!intent || typeof intent.id !== 'string' || !/^[a-f0-9]{64}$/.test(record.fingerprint ?? '') ||
          !['signet', 'mutinynet'].includes(intent.network) || !Number.isSafeInteger(intent.amountSats) || intent.amountSats < 0 ||
          ![null, undefined].includes(intent.feeSats) && (!Number.isSafeInteger(intent.feeSats) || intent.feeSats < 0) ||
          !['prepared', 'submitting', 'pending', 'unknown', 'settled', 'failed', 'cancelled'].includes(record.state) ||
          !Number.isFinite(Date.parse(record.updatedAt ?? record.createdAt)))
        throw Error('Protected operation journal is unavailable.');
    }
    if ((operations as readonly any[]).some(record => {
      const intent = record.intent;
      const owns = (intent.profileId === assignment.profileId && intent.generation === assignment.generation) ||
        (intent.target?.profileId === assignment.profileId && intent.target?.generation === assignment.generation);
      return owns && intent.network === assignment.network &&
        ['prepared', 'submitting', 'pending', 'unknown'].includes(record.state);
    })) throw Error('Assigned test identity has an unresolved protected operation.');
    const after = await vault.read({ initialize: false });
    if (before.revision !== after.revision) throw Error('Protected wallet vault changed during journal inspection.');
    return { revision: after.revision as number, operations };
  };
  const validateClientSnapshot = (snapshot: ClientWalletJournalSnapshot) => {
    if (!/^[a-f0-9]{64}$/i.test(snapshot.revision) || !Array.isArray(snapshot.reservations) ||
        !Array.isArray(snapshot.unknownOperations) || !Number.isSafeInteger(snapshot.rolling24hSpentSats) || snapshot.rolling24hSpentSats < 0 ||
        !Number.isSafeInteger(snapshot.knownReservedSats) || snapshot.knownReservedSats < 0) throw Error('Browser wallet journal snapshot is unavailable.');
  };
  return Object.freeze({
    async assertAssignedIdentity(assignment) { await readVault(assignment); },
    async readCaseSnapshot(nowMs, assignment) {
      if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw Error('Invalid protected journal snapshot time.');
      const vaultBefore = await readVault(assignment);
      const operationIds = vaultBefore.operations.map((record: any) => record.intent.id);
      const clientBefore = await input.client.readNetworkSnapshot(assignment.profileId, assignment.network, nowMs, operationIds);
      validateClientSnapshot(clientBefore);
      const spent: Record<TestNetwork, number> = { signet: 0, mutinynet: 0 };
      const reserved: Record<TestNetwork, number> = { signet: 0, mutinynet: 0 };
      const unknownOperations: RecentUnknown[] = [...clientBefore.unknownOperations];
      const recentFloor = nowMs - 24 * 60 * 60 * 1000;
      for (const record of vaultBefore.operations as readonly any[]) {
        const intent = record.intent;
        if (intent.network !== 'signet' && intent.network !== 'mutinynet') throw Error('Protected operation network is invalid.');
        const network = intent.network as TestNetwork;
        const observedAtMs = Date.parse(record.updatedAt ?? record.createdAt);
        if (!Number.isFinite(observedAtMs)) throw Error('Protected operation timestamp is invalid.');
        const fee = record.observedFeeSats ?? intent.feeSats;
        if (!Number.isSafeInteger(intent.amountSats) || intent.amountSats < 0 ||
            (fee !== null && fee !== undefined && (!Number.isSafeInteger(fee) || fee < 0)))
          throw Error('Protected operation journal is unavailable.');
        const allIn = intent.amountSats + (Number.isSafeInteger(fee) ? fee : MAX_OPERATION_SATS);
        if (!Number.isSafeInteger(allIn)) throw Error('Protected operation journal is unavailable.');
        const age = observedAtMs > nowMs ? 0 : nowMs - observedAtMs;
        if (record.state === 'settled' && intent.kind !== 'faucet' && age < 24 * 60 * 60 * 1000) spent[network] += allIn;
        else if (['prepared', 'submitting', 'pending'].includes(record.state)) reserved[network] += allIn;
        else if (record.state === 'unknown' || (record.state === 'cancelled' && record.resolution?.networkOutcome === 'unknown')) {
          const outpoints = Array.isArray(intent.capturedInputs)
            ? intent.capturedInputs.map((point: any) => `${point.txid}:${point.vout}`) : [];
          const profileIds = [intent.profileId, intent.target?.profileId].filter((profileId): profileId is string =>
            typeof profileId === 'string' && /^[a-f0-9]{64}$/.test(profileId));
          unknownOperations.push({ network, profileId: intent.profileId, profileIds: Object.freeze([...new Set(profileIds)]),
            outpoints, exposureSats: allIn, observedAtMs });
        }
      }
      const clientAfter = await input.client.readNetworkSnapshot(assignment.profileId, assignment.network, nowMs, operationIds);
      validateClientSnapshot(clientAfter);
      const vaultAfter = await readVault(assignment);
      if (vaultBefore.revision !== vaultAfter.revision || clientBefore.revision !== clientAfter.revision)
        throw Error('Protected source journals changed during inspection.');
      const rolling24hSpentSats = { signet: spent.signet, mutinynet: spent.mutinynet };
      const knownReservedSats = { signet: reserved.signet, mutinynet: reserved.mutinynet };
      rolling24hSpentSats[assignment.network] += clientAfter.rolling24hSpentSats;
      knownReservedSats[assignment.network] += clientAfter.knownReservedSats;
      const revision = createHash('sha256').update(JSON.stringify({ vault: vaultAfter.revision,
        operations: vaultBefore.operations.map((record: any) => [record.intent.id, record.fingerprint, record.state, record.updatedAt]),
        client: clientAfter.revision })).digest('hex');
      return Object.freeze({ revision, reservations: Object.freeze([...clientAfter.reservations]),
        rolling24hSpentSats: rolling24hSpentSats[assignment.network], knownReservedSats: knownReservedSats[assignment.network],
        unknownOperations: Object.freeze(unknownOperations) });
    },
  });
}

export type ReadOnlyCaseQuote = Readonly<{
  workflow: FundedWorkflowCase;
  network: TestNetwork;
  profileId: string;
  outpoints: readonly string[];
  amountSats: number;
  feeSats: number;
  allInSats: number;
  expiresAtMs: number;
  fingerprint: string;
  sourceRevision: string;
}>;
export type CaseQuotePreparer = (input: Readonly<{
  assignment: FundedCaseAssignment;
  eligibility: Awaited<ReturnType<typeof readOnlyWalletEligibility>>;
  wallet: ReadonlyWallet;
  reservations: readonly ReservedOperation[];
  sourceRevision: string;
  signal: AbortSignal;
}>) => Promise<ReadOnlyCaseQuote>;

export function assertReadOnlyCaseQuote(assignment: FundedCaseAssignment, quote: ReadOnlyCaseQuote, nowMs: number): void {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0 || quote.workflow !== assignment.workflow || quote.network !== assignment.network ||
      quote.profileId !== assignment.profileId || !Array.isArray(quote.outpoints) || quote.outpoints.length === 0 ||
      quote.outpoints.some(point => !/^[a-f0-9]{64}:\d+$/.test(point)) || new Set(quote.outpoints).size !== quote.outpoints.length ||
      !Number.isSafeInteger(quote.amountSats) || quote.amountSats <= 0 || !Number.isSafeInteger(quote.feeSats) || quote.feeSats < 0 ||
      !Number.isSafeInteger(quote.allInSats) || quote.allInSats !== quote.amountSats + quote.feeSats || quote.allInSats > MAX_OPERATION_SATS ||
      !Number.isSafeInteger(quote.expiresAtMs) || quote.expiresAtMs <= nowMs || quote.expiresAtMs > nowMs + 60_000 ||
      !/^[a-f0-9]{64}$/i.test(quote.fingerprint) || !/^[a-f0-9]{64}$/i.test(quote.sourceRevision)) {
    throw Error('The assigned SDK quote is invalid, stale, or exceeds the per-operation cap.');
  }
}

/** Production-equivalent direct-send quote using a read-only Arkade SDK wallet. */
export async function preparePaymentSdkQuote(input: {
  assignment: FundedCaseAssignment;
  wallet: ReadonlyWallet;
  reservations: readonly ReservedOperation[];
  sourceRevision: string;
  now?: () => number;
  readPolicy?: typeof readWalletNetworkPolicy;
}): Promise<ReadOnlyCaseQuote> {
  const { assignment, wallet } = input;
  if (assignment.workflow !== 'payment' || typeof assignment.recipient !== 'string' ||
      !Number.isSafeInteger(assignment.amountSats) || assignment.amountSats! <= 0) throw Error('Assigned payment parameters are invalid.');
  const network = assignment.network, now = input.now ?? Date.now;
  const { info, policy } = await (input.readPolicy ?? readWalletNetworkPolicy)(network);
  requireReadablePolicy(policy, 'Direct Send');
  const own = await wallet.getAddress();
  const address = sendRecipient(assignment.recipient, own);
  const candidates = await wallet.getSpendableVtxos({ withRecoverable: false, withUnrolled: false });
  const coins = eligibleUnreservedCoins(candidates, input.reservations)
    .sort((a, b) => a.txid.localeCompare(b.txid) || a.vout - b.vout);
  const availableTotal = coins.reduce((sum, coin) => sum + coin.value, 0);
  const dust = Math.max(Number(wallet.dustAmount), Number(info.vtxoMinAmount), 1);
  const selected = assignment.amountSats! < availableTotal && availableTotal - assignment.amountSats! > 0 && availableTotal - assignment.amountSats! < dust
    ? selectExactSendInputs(coins, assignment.amountSats!) ?? coins : coins;
  const total = selected.reduce((sum, coin) => sum + coin.value, 0);
  const amounts = sendAmounts(total, assignment.amountSats, dust);
  if (info.vtxoMaxAmount > 0n && (BigInt(amounts.amountSats) > info.vtxoMaxAmount || BigInt(amounts.changeSats) > info.vtxoMaxAmount))
    throw Error('Assigned payment exceeds the operator limit.');
  const retained = assetTotals(selected);
  if (retained.length && amounts.changeSats < dust) throw Error('Assigned payment cannot preserve selected input assets.');
  const raw = JSON.stringify({ profileId: assignment.profileId, recipient: address.encode(), amount: amounts.amountSats,
    inputs: selected.map(coin => [coin.txid, coin.vout, coin.value, (coin.assets ?? []).map(asset => [asset.assetId, String(asset.amount)])]),
    policy: policy.fingerprint, own, dust });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const fingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const checkedAtMs = now();
  const outpoints = selected.map(coin => `${coin.txid}:${coin.vout}`);
  const quote: ReadOnlyCaseQuote = Object.freeze({ workflow: 'payment', network, profileId: assignment.profileId, outpoints,
    amountSats: amounts.amountSats, feeSats: 0, allInSats: amounts.amountSats,
    expiresAtMs: checkedAtMs + 60_000, fingerprint, sourceRevision: input.sourceRevision });
  assertReadOnlyCaseQuote(assignment, quote, checkedAtMs);
  return quote;
}

/**
 * Concrete read-only planner for the existing direct Arkade payment workflow.
 * It uses the same production selectors, amount checks, fee policy and quote
 * fingerprint inputs as the browser's quoteSend path, but accepts the original
 * durable reservation snapshot from its trusted reader.
 */
export async function preparePaymentCaseQuote(input: {
  assignment: FundedCaseAssignment;
  wallet: ReadonlyWallet;
  reservations: readonly ReservedOperation[];
  sourceRevision: string;
  eligibility: Awaited<ReturnType<typeof readOnlyWalletEligibility>>;
  signal: AbortSignal;
  now?: () => number;
  readPolicy?: typeof readWalletNetworkPolicy;
}) {
  return preparePaymentSdkQuote(input);
}

export const paymentCaseQuotePreparer: CaseQuotePreparer = async input => {
  input.signal.throwIfAborted();
  const quote = await preparePaymentCaseQuote(input);
  input.signal.throwIfAborted();
  return quote;
};

const MAX_OPERATION_SATS = 5_000;
const MAX_NETWORK_24H_SATS = 10_000;
const MAX_UNKNOWN_EXPOSURE_SATS = MAX_OPERATION_SATS;
export const FUNDED_WORKFLOW_CASES: readonly FundedWorkflowCase[] = ['payment', 'mint', 'delivery', 'burn', 'boarding', 'standard-lto'];

/** Parse and enforce the actual runtime version; call before private configuration access. */
export function assertNode24Runtime(version: string): void {
  const match = /^v?(\d+)\./.exec(version);
  if (!match || Number(match[1]) !== 24) throw Error('Refusing private access: the funded harness requires Node 24.');
}

/** Check exact candidate scope before calling any private-secrets loader. */
export function assertAssignedCandidate(input: { assignedRunId: string; assignedCandidateId: string; requestedRunId: string; requestedCandidateId: string }): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{7,79}$/.test(input.assignedRunId) || input.requestedRunId !== input.assignedRunId ||
      !/^(signet|mutinynet):0[123]$/.test(input.assignedCandidateId) || input.requestedCandidateId !== input.assignedCandidateId) {
    throw Error('Funded acceptance assignment mismatch.');
  }
}

/** Read exactly one process-environment secret, only after runtime/scope checks. */
export function loadAssignedEnvironmentMnemonic(input: {
  assignedRunId: string; assignedCandidateId: string; requestedRunId: string; requestedCandidateId: string;
}, runtimeVersion = process.versions.node, values: NodeJS.ProcessEnv = process.env): string {
  assertNode24Runtime(runtimeVersion);
  assertAssignedCandidate(input);
  const [network, slot] = input.assignedCandidateId.split(':') as [TestNetwork, '01' | '02' | '03'];
  const mnemonic = values[`BIS_GAME_WALLET_${network.toUpperCase()}_${slot}_MNEMONIC`]?.trim();
  if (!mnemonic) throw Error('Assigned test identity is unavailable.');
  return mnemonic;
}

/** Shared guard sequence used immediately before the vault callback. */
export async function loadAssignedMnemonic(input: { assignedRunId: string; assignedCandidateId: string; requestedRunId: string; requestedCandidateId: string },
  runtimeVersion: string, loader: () => Promise<string>): Promise<string> {
  assertNode24Runtime(runtimeVersion);
  assertAssignedCandidate(input);
  return loader();
}

/** This read-only SDK path takes a secret only from a caller-supplied private vault loader. */
export async function readOnlyWalletEligibility(input: {
  assignedRunId: string; assignedCandidateId: string; requestedRunId: string; requestedCandidateId: string;
  expectedProfileId?: string; loadMnemonic: () => Promise<string>; requirement?: WalletRequirement; signal?: AbortSignal; now?: () => number;
}) {
  const mnemonic = await loadAssignedMnemonic(input, process.versions.node, input.loadMnemonic);
  const [network, slot] = input.assignedCandidateId.split(':') as [TestNetwork, '01' | '02' | '03'];
  if (typeof mnemonic !== 'string' || !mnemonic.trim()) throw Error('Assigned test identity is unavailable.');
  if (input.expectedProfileId && await identify(mnemonic) !== input.expectedProfileId) throw Error('Assigned test identity is unavailable.');
  const key = `BIS_GAME_WALLET_${network.toUpperCase()}_${slot}_MNEMONIC`;
  const pool = createWalletPool({ [key]: mnemonic });
  try {
    const signal = input.signal ?? AbortSignal.timeout(15_000);
    const wallet = await pool.select(network, input.requirement, signal);
    if (input.expectedProfileId && wallet.profileId !== input.expectedProfileId) throw Error();
    const [balance, info] = await Promise.all([
      readCandidateBalance(wallet, signal, input.requirement),
      new RestArkProvider(network === 'signet' ? 'https://signet.arkade.sh' : 'https://mutinynet.arkade.sh').getInfo(),
    ]);
    signal.throwIfAborted();
    if (info.network !== network || typeof info.fees?.txFeeRate !== 'string' || !/^\d+(?:\.\d+)?$/.test(info.fees.txFeeRate) || !info.fees.intentFee) throw Error();
    const { mnemonic: _secret, ...identity } = wallet;
    const feeInfo = { txFeeRate: info.fees.txFeeRate, intentFee: Object.fromEntries(Object.entries(info.fees.intentFee).filter(([, value]) => typeof value === 'string')) };
    return { identity, balance, feeInfo, checkedAtMs: input.now?.() ?? Date.now(), financialActions: 0 };
  } catch {
    throw Error('Assigned test wallet eligibility could not be verified.');
  }
}

/** Case-by-case prerequisites; eligibility is not a transaction quote or spend authorization. */
export function classifyReadOnlyPrerequisite(workflow: FundedWorkflowCase, balance: {
  availableArkadeSats: number; availableBitcoinSats: number; mintMinimumSats?: number; boardingMinimumSats?: number; assets?: Readonly<Record<string, string>>;
}, assetId?: string, assetQuantity?: string) {
  let eligible = false, reason = '';
  switch (workflow) {
    case 'payment':
    case 'standard-lto':
      eligible = Number.isSafeInteger(balance.availableArkadeSats) && balance.availableArkadeSats > 0;
      reason = eligible ? 'Fresh Arkade-spendable inputs exist; prepare and quote this case individually.' : 'No fresh Arkade-spendable inputs.';
      break;
    case 'mint':
      eligible = Number.isSafeInteger(balance.availableArkadeSats) && Number.isSafeInteger(balance.mintMinimumSats) && balance.mintMinimumSats! > 0 && balance.availableArkadeSats >= balance.mintMinimumSats!;
      reason = eligible ? 'Fresh Arkade balance meets the SDK mint carrier minimum; prepare and quote this case individually.' : 'Fresh Arkade balance does not meet the SDK mint minimum.';
      break;
    case 'delivery':
    case 'burn': {
      const holding = assetId && /^[a-f0-9]{68}$/i.test(assetId) ? balance.assets?.[assetId.toLowerCase()] : undefined;
      eligible = typeof holding === 'string' && /^[1-9][0-9]*$/.test(holding) && typeof assetQuantity === 'string' &&
        /^[1-9][0-9]*$/.test(assetQuantity) && BigInt(holding) >= BigInt(assetQuantity);
      reason = eligible ? 'A fresh balance includes the requested quantity; prepare and quote this case individually.' : 'Fresh spendable holdings do not cover the selected asset quantity.';
      break;
    }
    case 'boarding':
      eligible = Number.isSafeInteger(balance.availableBitcoinSats) && Number.isSafeInteger(balance.boardingMinimumSats) && balance.boardingMinimumSats! > 0 && balance.availableBitcoinSats >= balance.boardingMinimumSats!;
      reason = eligible ? 'Confirmed Bitcoin balance meets the SDK boarding minimum; prepare and quote this case individually.' : 'Confirmed Bitcoin balance does not meet the SDK boarding minimum.';
      break;
  }
  return Object.freeze({ workflow, eligibleForNonBroadcastQuote: eligible, quoteRequired: true as const, financialActions: 0 as const, reason });
}

/**
 * Prepare exactly one assigned case. The caller supplies the production
 * case-specific SDK planner (never a submit/sign path); this function enforces
 * runtime and assignment checks before private access, then rejects a stale,
 * mismatched, or over-budget quote before consulting the protected journal.
 */
export async function prepareAssignedCase(input: {
  assignedRunId: string;
  assignedCandidateId: string;
  requestedRunId: string;
  requestedCandidateId: string;
  assignment: FundedCaseAssignment;
  loadMnemonic: () => Promise<string>;
  prepareQuote: CaseQuotePreparer;
  journal: ProtectedCaseJournalReader;
  signal?: AbortSignal;
  now?: () => number;
}) {
  assertNode24Runtime(process.versions.node);
  assertAssignedCandidate(input);
  const { assignment } = input;
  if (assignment.candidateId !== input.assignedCandidateId || assignment.network !== input.assignedCandidateId.split(':')[0] ||
      !FUNDED_WORKFLOW_CASES.includes(assignment.workflow) || !/^[a-f0-9]{64}$/.test(assignment.profileId)) {
    throw Error('Funded acceptance assignment mismatch.');
  }
  const signal = input.signal ?? AbortSignal.timeout(30_000);
  const now = input.now ?? Date.now;
  const assetWorkflow = assignment.workflow === 'delivery' || assignment.workflow === 'burn';
  if (assetWorkflow && (!assignment.assetId || !/^[a-f0-9]{68}$/i.test(assignment.assetId) ||
      !assignment.assetQuantity || !/^[1-9][0-9]*$/.test(assignment.assetQuantity))) throw Error('Assigned asset case requirements are invalid.');
  const requirement: WalletRequirement = assignment.workflow === 'mint' ? { purpose: 'mint' } :
    assignment.workflow === 'boarding' ? { purpose: 'boarding' } : assetWorkflow ? { purpose: 'asset',
      asset: { assetId: assignment.assetId!, quantity: assignment.assetQuantity! } } : { arkadeSats: 1 };
  await input.journal.assertAssignedIdentity(assignment);
  const mnemonic = await loadAssignedMnemonic(input, process.versions.node, input.loadMnemonic);
  const eligibility = await readOnlyWalletEligibility({ ...input, expectedProfileId: assignment.profileId,
    loadMnemonic: async () => mnemonic, requirement, signal, now });
  signal.throwIfAborted();
  const prerequisite = classifyReadOnlyPrerequisite(assignment.workflow, {
    availableArkadeSats: eligibility.balance.availableArkadeSats,
    availableBitcoinSats: eligibility.balance.availableBitcoinSats,
    mintMinimumSats: eligibility.balance.mintMinimumSats,
    boardingMinimumSats: eligibility.balance.boardingMinimumSats,
    assets: eligibility.balance.assets,
  }, assignment.assetId, assignment.assetQuantity);
  if (!prerequisite.eligibleForNonBroadcastQuote) throw Error('Assigned case prerequisites are not met.');

  const journalBefore = await input.journal.readCaseSnapshot(now(), assignment);
  if (!/^[a-f0-9]{64}$/i.test(journalBefore.revision) || !Array.isArray(journalBefore.reservations) ||
      !Array.isArray(journalBefore.unknownOperations) || !Number.isSafeInteger(journalBefore.rolling24hSpentSats) ||
      !Number.isSafeInteger(journalBefore.knownReservedSats)) throw Error('Protected case journal snapshot is unavailable.');
  const preparedAtMs = now();
  const operator = operatorFor(assignment.network);
  const wallet = await ReadonlyWallet.create({
    identity: await MnemonicIdentity.fromMnemonic(mnemonic, { isMainnet: false }).toReadonly(),
    arkProvider: new RestArkProvider(operator), indexerProvider: new RestIndexerProvider(operator),
    storage: { walletRepository: new InMemoryWalletRepository(), contractRepository: new InMemoryContractRepository() },
  });
  let quote: ReadOnlyCaseQuote;
  try {
    signal.throwIfAborted();
    quote = await input.prepareQuote({ assignment, eligibility, wallet, reservations: journalBefore.reservations,
      sourceRevision: journalBefore.revision, signal });
    signal.throwIfAborted();
  } finally { await wallet.dispose(); }
  assertReadOnlyCaseQuote(assignment, quote, preparedAtMs);
  if (quote.sourceRevision !== journalBefore.revision) throw Error('The protected source journal changed during quote preparation.');
  const journalAfter = await input.journal.readCaseSnapshot(now(), assignment);
  if (journalAfter.revision !== journalBefore.revision) throw Error('The protected source journal changed during quote preparation.');
  signal.throwIfAborted();
  const preflight = preflightFundedWorkflow({
    runId: input.assignedRunId,
    candidateIds: { [assignment.network]: assignment.candidateId },
    cases: [{ ...assignment, outpoints: quote.outpoints, allInSats: quote.allInSats }],
    rolling24hSpentSats: { signet: assignment.network === 'signet' ? journalAfter.rolling24hSpentSats : 0,
      mutinynet: assignment.network === 'mutinynet' ? journalAfter.rolling24hSpentSats : 0 },
    knownReservedSats: { signet: assignment.network === 'signet' ? journalAfter.knownReservedSats : 0,
      mutinynet: assignment.network === 'mutinynet' ? journalAfter.knownReservedSats : 0 },
    unknownOperations: journalAfter.unknownOperations,
  }, preparedAtMs);
  return Object.freeze({ workflow: assignment.workflow, network: assignment.network, profileId: assignment.profileId,
    amountSats: quote.amountSats, feeSats: quote.feeSats, allInSats: quote.allInSats,
    expiresAtMs: quote.expiresAtMs, fingerprint: quote.fingerprint, outpoints: Object.freeze([...quote.outpoints]),
    checkedAtMs: preparedAtMs, unknownOperationCount: journalAfter.unknownOperations.length,
    sourceRevision: journalAfter.revision, preflight });
}

/** Executable local harness entry point using only the exact assigned env slot. */
export async function prepareAssignedCaseFromEnvironment(input: Omit<Parameters<typeof prepareAssignedCase>[0], 'loadMnemonic'> & {
  values?: NodeJS.ProcessEnv;
}) {
  assertNode24Runtime(process.versions.node);
  assertAssignedCandidate(input);
  await input.journal.assertAssignedIdentity(input.assignment);
  const { values = process.env, ...request } = input;
  const mnemonic = loadAssignedEnvironmentMnemonic(input, process.versions.node, values);
  return prepareAssignedCase({ ...request, loadMnemonic: async () => mnemonic });
}

/** One-call executable entry for the existing direct-payment SDK planner. */
export function prepareAssignedPaymentFromEnvironment(input: Omit<Parameters<typeof prepareAssignedCaseFromEnvironment>[0], 'prepareQuote'>) {
  return prepareAssignedCaseFromEnvironment({ ...input, prepareQuote: paymentCaseQuotePreparer });
}

/** Capture an immutable journal snapshot; this adapter is read-only and never resolves records. */
export async function preflightFromProtectedJournal(input: Omit<FundedWorkflowPreflight, 'unknownOperations'> & { nowMs: number }, journal: ProtectedJournalReader) {
  if (!Number.isSafeInteger(input.nowMs) || input.nowMs < 0) throw Error('Invalid journal snapshot time.');
  const unknownOperations = await journal.readRecentUnknownOperations(input.nowMs);
  if (!Array.isArray(unknownOperations)) throw Error('Protected journal snapshot unavailable.');
  const result = preflightFundedWorkflow({ ...input, unknownOperations }, input.nowMs);
  return Object.freeze({ ...result, preservedUnknownOperationCount: unknownOperations.length });
}

/** Budget and source-conflict checks are pure: unknowns are preserved and never resolved here. */
export function preflightFundedWorkflow(input: FundedWorkflowPreflight, nowMs = Date.now()) {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw Error('Invalid preflight clock.');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{7,79}$/.test(input.runId)) throw Error('A coordinator-assigned run ID is required.');
  if (!Array.isArray(input.cases) || input.cases.length === 0 || input.cases.length > FUNDED_WORKFLOW_CASES.length) throw Error('At least one assigned workflow case is required.');
  const cases = input.cases as readonly FundedCaseAssignment[];
  const totals: Record<TestNetwork, number> = { signet: 0, mutinynet: 0 };
  const assigned = new Set<string>();
  const plannedOutpoints = new Set<string>();
  for (const item of cases) {
    const network = item.network;
    if (!FUNDED_WORKFLOW_CASES.includes(item.workflow) || (network !== 'signet' && network !== 'mutinynet')) throw Error('Invalid funded workflow scope.');
    const candidateForNetwork = network === 'signet' ? input.candidateIds.signet : input.candidateIds.mutinynet;
    const outpoints = item.outpoints as readonly string[];
    if (!new RegExp(`^${network}:0[123]$`).test(item.candidateId) || item.candidateId !== candidateForNetwork ||
        !/^[a-f0-9]{64}$/.test(item.profileId) || !Array.isArray(outpoints) || outpoints.some((outpoint: string) => !/^[a-f0-9]{64}:\d+$/.test(outpoint)) ||
        !Number.isSafeInteger(item.allInSats) || item.allInSats <= 0 || item.allInSats > MAX_OPERATION_SATS) throw Error(`Invalid or unassigned workflow case: ${item.workflow}.`);
    const caseKey = `${item.network}:${item.workflow}`;
    if (assigned.has(caseKey)) throw Error(`Duplicate workflow case: ${item.workflow}.`);
    assigned.add(caseKey);
    for (const outpoint of outpoints) {
      const key = `${network}:${outpoint}`;
      if (plannedOutpoints.has(key)) throw Error('Assigned cases cannot spend the same source outpoint.');
      plannedOutpoints.add(key);
    }
    totals[network] += item.allInSats;
  }

  const unknownExposure: Record<TestNetwork, number> = { signet: 0, mutinynet: 0 };
  for (const unknown of input.unknownOperations) {
    if (unknown.network !== 'signet' && unknown.network !== 'mutinynet') throw Error('Unknown journal network is invalid.');
    if (unknown.profileId !== undefined && !/^[a-f0-9]{64}$/.test(unknown.profileId)) throw Error('Unknown journal source profile is invalid.');
    const profileIds = unknown.profileIds ?? (unknown.profileId ? [unknown.profileId] : []);
    if (!Array.isArray(profileIds) || profileIds.some(profileId => !/^[a-f0-9]{64}$/.test(profileId))) throw Error('Unknown journal source profile is invalid.');
    const originalOutpoints = unknown.outpoints ?? [];
    if (!Array.isArray(originalOutpoints) || originalOutpoints.some((point: string) => !/^[a-f0-9]{64}:\d+$/.test(point))) throw Error('Unknown journal source inputs are invalid.');
    if (unknown.observedAtMs !== undefined && (!Number.isSafeInteger(unknown.observedAtMs) || unknown.observedAtMs < 0)) throw Error('Unknown journal timestamp is invalid.');
    for (const item of cases.filter(candidate => candidate.network === unknown.network)) {
      if (profileIds.includes(item.profileId) || originalOutpoints.some(point => item.outpoints.includes(point))) throw Error(`Unresolved operation conflicts with assigned source for ${item.workflow}.`);
    }
    const exposure = unknown.exposureSats ?? MAX_UNKNOWN_EXPOSURE_SATS;
    if (!Number.isSafeInteger(exposure) || exposure <= 0) throw Error('Unknown operation exposure cannot be safely bounded.');
    if (unknown.observedAtMs === undefined || unknown.observedAtMs > nowMs) unknownExposure[unknown.network] += exposure;
    else if (nowMs - unknown.observedAtMs < 24 * 60 * 60 * 1000) unknownExposure[unknown.network] += exposure;
  }

  for (const network of ['signet', 'mutinynet'] as const) {
    if (!cases.some(item => item.network === network)) continue;
    const spent = input.rolling24hSpentSats[network], reserved = input.knownReservedSats[network];
    if (!Number.isSafeInteger(spent) || spent < 0 || !Number.isSafeInteger(reserved) || reserved < 0) throw Error(`Invalid rolling budget ledger for ${network}.`);
    if (spent + reserved + unknownExposure[network] + totals[network] > MAX_NETWORK_24H_SATS) throw Error(`Rolling 24-hour network cap exceeded for ${network}.`);
  }

  return Object.freeze({ runId: input.runId, totals, unknownExposure, operationCapSats: MAX_OPERATION_SATS, network24hCapSats: MAX_NETWORK_24H_SATS, financialActions: 0 });
}
