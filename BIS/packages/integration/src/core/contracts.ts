/** Pure lifecycle rules. Callers must hold the wallet lock and persist before submitting. */
export type ContractScope = Readonly<{
  network: string; operator: string; playerId: string; gameId: string; exclusivityKey: string;
}>;
export type LtoRequest = Readonly<{
  scope: ContractScope; id: string; sessionId: string; operationId: string;
  purpose: string; hostReference: string; amountSats: number; startedAt: number; expiresAt: number;
}>;
export type ContractOperationKind = 'fund' | 'claim' | 'refund';
export const contractFailureMessages = {
  'insufficient-funds':'The game needs enough available sats for the reward and any asset-preserving change.',
  'fee-change':'The operator no longer offers the required zero-fee terms.',
  'invalid-assets':'The game wallet asset data could not be verified.',
  'account-changed':'The wallet or session changed, or the offer expired.',
  'input-recovery':'Another wallet operation needs input recovery. Check Account details.',
  'preparation-failed':'Transaction preparation failed. No transaction was submitted. Check wallet and operator availability.'
} as const;
export type ContractOperation = Readonly<{
  id: string; kind: ContractOperationKind; submission: 'prepared' | 'submitted' | 'unknown' | 'confirmed' | 'not-submitted';
  failure?: keyof typeof contractFailureMessages;
}>;
export type ContractRecord = Readonly<Omit<LtoRequest, 'operationId'> & {
  version: 1; type: 'lto'; financial: 'funding' | 'funded' | 'claiming' | 'refunding' | 'unknown' | 'claimed' | 'refunded' | 'failed';
  ended?: 'rejected' | 'session-ended'; operation: ContractOperation;
}>;
type ContractAttempt = Readonly<{ scope: ContractScope; sessionId: string; status: 'created' | 'occupied' | 'expired'; contractId?: string }>;
export type ContractLedger = Readonly<{ contracts: readonly ContractRecord[]; attempts: readonly ContractAttempt[] }>;
export type BisContract = Readonly<{
  id: string; type: 'lto'; scope: ContractScope; sessionId: string; purpose: string; hostReference: string;
  amountSats: number; startedAt: number; expiresAt: number; financial: ContractRecord['financial'];
  eligibility: 'within-window' | 'expired' | 'ended' | 'resolved';
  canClaim: boolean; canReject: boolean; canRefund: boolean;
  role?: 'player' | 'game';
  evidence?: 'local record' | 'verified receipt';
  operationId?: string; operationKind?: ContractOperationKind; transactionId?: string; fundingTransactionId?: string;
}>;
export class ContractError extends Error {}
const sameScope = (a: ContractScope, b: ContractScope) =>
  a.network === b.network && a.operator === b.operator && a.playerId === b.playerId && a.gameId === b.gameId && a.exclusivityKey === b.exclusivityKey;
export const contractResolved = (contract: ContractRecord) => ['claimed', 'refunded', 'failed'].includes(contract.financial);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 1024;
function timestamp(now: number) { if (!Number.isSafeInteger(now) || now < 0) throw new ContractError('Invalid contract timestamp.'); }
function validateRequest(request: LtoRequest) {
  if (!request.scope || !['network', 'operator', 'playerId', 'gameId', 'exclusivityKey'].every(key => text(request.scope[key as keyof ContractScope])) || request.scope.playerId === request.scope.gameId)
    throw new ContractError('Distinct, scoped player and game identities are required.');
  if (![request.id, request.sessionId, request.operationId, request.purpose, request.hostReference].every(text)) throw new ContractError('Contract identifiers are required.');
  timestamp(request.startedAt); timestamp(request.expiresAt);
  if (request.expiresAt <= request.startedAt || !Number.isSafeInteger(request.amountSats) || request.amountSats <= 0) throw new ContractError('Invalid contract amount or deadline.');
}
export function emptyContractLedger(): ContractLedger { return { contracts: [], attempts: [] }; }

/** Fail closed on corrupt or future data; never silently discard unresolved records. */
export function validateContractLedger(value: unknown): asserts value is ContractLedger {
  const ledger = value as ContractLedger;
  if (!ledger || !Array.isArray(ledger.contracts) || !Array.isArray(ledger.attempts)) throw new ContractError('Contract recovery data is unavailable.');
  const ids = new Set<string>(), slots = new Set<string>(), attempts = new Set<string>();
  const scopeKey = (scope: ContractScope) => JSON.stringify([scope.network, scope.operator, scope.playerId, scope.gameId, scope.exclusivityKey]);
  for (const record of ledger.contracts) {
    if(record?.operation?.failure!==undefined&&!Object.hasOwn(contractFailureMessages,record.operation.failure))throw new ContractError('Contract failure state is invalid.');
    validateRequest({ ...record, operationId: record.operation?.id });
    if (record.version !== 1 || record.type !== 'lto' || ids.has(record.id) || !['funding','funded','claiming','refunding','unknown','claimed','refunded','failed'].includes(record.financial) ||
      !['fund','claim','refund'].includes(record.operation.kind) || !['prepared','submitted','unknown','confirmed','not-submitted'].includes(record.operation.submission) ||
      (record.ended !== undefined && !['rejected','session-ended'].includes(record.ended))) throw new ContractError('Contract recovery data is unavailable.');
    const pending = ['prepared','submitted','unknown'].includes(record.operation.submission);
    if (pending !== ['funding','claiming','refunding','unknown'].includes(record.financial) ||
      (record.financial === 'funding' && record.operation.kind !== 'fund') || (record.financial === 'claiming' && record.operation.kind !== 'claim') ||
      (record.financial === 'refunding' && record.operation.kind !== 'refund') ||
      (record.financial === 'claimed' && (record.operation.kind !== 'claim' || record.operation.submission !== 'confirmed')) ||
      (record.financial === 'refunded' && (record.operation.kind !== 'refund' || record.operation.submission !== 'confirmed')) ||
      (record.financial === 'failed' && (record.operation.kind !== 'fund' || record.operation.submission !== 'not-submitted')) ||
      (record.financial === 'funded' && !(record.operation.kind === 'fund' ? record.operation.submission === 'confirmed' : record.operation.submission === 'not-submitted')))
      throw new ContractError('Contract recovery state is inconsistent.');
    ids.add(record.id);
    if (!contractResolved(record)) {
      const key = scopeKey(record.scope);
      if (slots.has(key)) throw new ContractError('Contract recovery has conflicting offers.');
      slots.add(key);
    }
  }
  for (const attempt of ledger.attempts) {
    validateRequest({ scope: attempt.scope, id: 'attempt', sessionId: attempt.sessionId, operationId: 'attempt', purpose: 'attempt', hostReference: 'attempt', amountSats: 1, startedAt: 0, expiresAt: 1 });
    const key = JSON.stringify([scopeKey(attempt.scope), attempt.sessionId]);
    if (attempts.has(key) || !['created','occupied','expired'].includes(attempt.status)) throw new ContractError('Contract attempt recovery is inconsistent.');
    const record = ledger.contracts.find(contract => contract.id === attempt.contractId);
    if (attempt.status === 'created' ? !record || record.sessionId !== attempt.sessionId || !sameScope(record.scope, attempt.scope) : attempt.contractId !== undefined)
      throw new ContractError('Contract attempt recovery is inconsistent.');
    attempts.add(key);
  }
  if (ledger.contracts.some(record => !ledger.attempts.some(attempt => attempt.status === 'created' && attempt.contractId === record.id))) throw new ContractError('Contract attempt recovery is missing.');
}

/** A skipped attempt is retained so completion of older cleanup cannot fund it later. */
export function startLto(ledger: ContractLedger, request: LtoRequest, now: number): Readonly<{ ledger: ContractLedger; status: ContractAttempt['status']; contract?: ContractRecord }> {
  validateRequest(request); timestamp(now);
  const previous = ledger.attempts.find(attempt => sameScope(attempt.scope, request.scope) && attempt.sessionId === request.sessionId);
  if (previous) return { ledger, status: previous.status, contract: ledger.contracts.find(contract => contract.id === previous.contractId) };
  const occupied = ledger.contracts.some(contract => sameScope(contract.scope, request.scope) && !contractResolved(contract));
  const status = occupied ? 'occupied' : now >= request.expiresAt ? 'expired' : 'created';
  if (status === 'created' && ledger.contracts.some(contract => contract.id === request.id)) throw new ContractError('Contract ID already exists.');
  const scope: ContractScope = { network: request.scope.network, operator: request.scope.operator, playerId: request.scope.playerId, gameId: request.scope.gameId, exclusivityKey: request.scope.exclusivityKey };
  const contract: ContractRecord | undefined = status === 'created' ? {
    version: 1, type: 'lto', scope, id: request.id, sessionId: request.sessionId, purpose: request.purpose, hostReference: request.hostReference,
    amountSats: request.amountSats, startedAt: request.startedAt, expiresAt: request.expiresAt, financial: 'funding',
    operation: { id: request.operationId, kind: 'fund', submission: 'prepared' },
  } : undefined;
  return { status, contract, ledger: {
    contracts: contract ? [...ledger.contracts, contract] : ledger.contracts,
    attempts: [...ledger.attempts, { scope, sessionId: request.sessionId, status, contractId: contract?.id }],
  } };
}

export function presentContract(contract: ContractRecord, now: number): BisContract {
  timestamp(now);
  const eligibility = contractResolved(contract) ? 'resolved' : contract.ended ? 'ended' : now >= contract.expiresAt ? 'expired' : 'within-window';
  const available = contract.financial === 'funded';
  return {
    id: contract.id, type: 'lto', scope: { network: contract.scope.network, operator: contract.scope.operator, playerId: contract.scope.playerId, gameId: contract.scope.gameId, exclusivityKey: contract.scope.exclusivityKey },
    sessionId: contract.sessionId, purpose: contract.purpose, hostReference: contract.hostReference,
    amountSats: contract.amountSats, startedAt: contract.startedAt, expiresAt: contract.expiresAt, financial: contract.financial, eligibility,
    canClaim: available && eligibility === 'within-window', canReject: available && eligibility === 'within-window', canRefund: available,
  };
}
/** Pure inspection: no provider, timer, signer, persistence or mutation. */
export function checkContracts(ledger: ContractLedger, scope: ContractScope, now: number): readonly BisContract[] {
  return ledger.contracts.filter(contract => sameScope(contract.scope, scope) && !contractResolved(contract)).map(contract => presentContract(contract, now));
}
export function endContract(contract: ContractRecord, reason: NonNullable<ContractRecord['ended']>): ContractRecord {
  return contractResolved(contract) || contract.ended ? contract : { ...contract, ended: reason };
}
export function beginContractOperation(contract: ContractRecord, kind: 'claim' | 'refund', operationId: string, now: number): ContractRecord {
  if (!text(operationId) || operationId === contract.operation.id) throw new ContractError('A new operation ID is required.');
  const state = presentContract(contract, now);
  if (kind === 'claim' ? !state.canClaim : !state.canRefund) throw new ContractError('Contract is not available for this operation.');
  return { ...contract, financial: kind === 'claim' ? 'claiming' : 'refunding', operation: { id: operationId, kind, submission: 'prepared' } };
}
/** Persist this transition BEFORE calling the provider, including when acknowledgement may be lost. */
export function markContractSubmission(contract: ContractRecord, operationId: string, now: number, unknown = false): ContractRecord {
  timestamp(now);
  if (contract.operation.id !== operationId || ['confirmed', 'not-submitted'].includes(contract.operation.submission)) throw new ContractError('Operation does not match pending contract.');
  if (contract.operation.submission === 'prepared' && contract.operation.kind === 'claim' && (contract.ended || now >= contract.expiresAt)) throw new ContractError('The offer is too late to claim.');
  return { ...contract, financial: unknown ? 'unknown' : contract.financial, operation: { ...contract.operation, submission: unknown ? 'unknown' : 'submitted' } };
}
/** The adapter must verify exact source and destination evidence before supplying confirmed. */
export function finishContractOperation(contract: ContractRecord, result: Readonly<{ operationId: string; kind: ContractOperationKind; outcome: 'confirmed' | 'not-submitted' }>): ContractRecord {
  if (contract.operation.id !== result.operationId || contract.operation.kind !== result.kind) throw new ContractError('Outcome does not match contract operation.');
  if (contract.operation.submission === result.outcome) return contract;
  if (['confirmed', 'not-submitted'].includes(contract.operation.submission)) throw new ContractError('Operation was already resolved.');
  if (result.outcome === 'not-submitted' && contract.operation.submission !== 'prepared') throw new ContractError('Submission is uncertain; reconcile before spending again.');
  const financial = result.outcome === 'confirmed'
    ? result.kind === 'fund' ? 'funded' : result.kind === 'claim' ? 'claimed' : 'refunded'
    : result.kind === 'fund' ? 'failed' : 'funded';
  return { ...contract, financial, operation: { ...contract.operation, submission: result.outcome } };
}
