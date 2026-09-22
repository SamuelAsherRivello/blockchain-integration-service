import { testNetwork, type TestNetwork } from './test-network.ts';

export type WalletPolicyReason = 'supported' | 'network-mismatch' | 'unsupported-fees' | 'policy-unavailable';
export type FeeValueKind = 'zero' | 'nonzero' | 'missing' | 'malformed' | 'unknown';
export type NormalizedFee = Readonly<{ kind: FeeValueKind; value?: string }>;
export type WalletNetworkPolicy = Readonly<{
  network: TestNetwork;
  operator: string;
  reason: WalletPolicyReason;
  zeroFees: boolean;
  fingerprint: string;
  fees: Readonly<{ txFeeRate: NormalizedFee; intentFee: Readonly<Record<string, NormalizedFee>> }>;
}>;
export type WalletOperationAvailabilityReason = Exclude<WalletPolicyReason, 'supported'> | 'insufficient-funds' | 'reserved-inputs';
export type WalletOperationAvailability = Readonly<{ available: true }> | Readonly<{
  available: false;
  reason: WalletOperationAvailabilityReason;
  message: string;
}>;

export class WalletNetworkPolicyError extends Error {
  readonly reason: Exclude<WalletPolicyReason, 'supported'>;
  constructor(reason: Exclude<WalletPolicyReason, 'supported'>, operation: string) {
    super(walletPolicyMessage(reason, operation));
    this.reason = reason;
  }
}

const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
const plainRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** Canonical decimal text avoids treating `0`, `0.0`, and `00.000` as different terms. */
function canonicalDecimal(value: string): string {
  let text = value.trim();
  const negative = text.startsWith('-');
  if (negative || text.startsWith('+')) text = text.slice(1);
  let [whole, fraction = ''] = text.split('.');
  whole = whole.replace(/^0+(?=\d)/, '');
  fraction = fraction.replace(/0+$/, '');
  const normalized = `${whole || '0'}${fraction ? `.${fraction}` : ''}`;
  return negative && normalized !== '0' ? `-${normalized}` : normalized;
}

export function normalizeFeeValue(value: unknown): NormalizedFee {
  if (value === undefined || value === null) return Object.freeze({ kind: 'missing' });
  if (typeof value !== 'string') return Object.freeze({ kind: 'unknown' });
  const text = value.trim();
  if (text === '') return Object.freeze({ kind: 'zero', value: '0' });
  if (!decimal.test(text)) return Object.freeze({ kind: 'malformed' });
  const normalized = canonicalDecimal(text);
  return Object.freeze({ kind: normalized === '0' ? 'zero' : 'nonzero', value: normalized });
}

function fingerprint(network: TestNetwork, operator: string, fees: WalletNetworkPolicy['fees']): string {
  return JSON.stringify({
    network,
    operator,
    txFeeRate: fees.txFeeRate,
    intentFee: Object.fromEntries(Object.entries(fees.intentFee).sort(([left], [right]) => left.localeCompare(right))),
  });
}

/**
 * Converts an SDK/operator info response into only the public policy facts that
 * wallet decisions need. It never keeps provider payloads or error details.
 */
export function inspectWalletNetworkPolicy(network: TestNetwork, info: unknown): WalletNetworkPolicy {
  const operator = testNetwork(network).operator;
  const emptyFees = Object.freeze({ txFeeRate: normalizeFeeValue(undefined), intentFee: Object.freeze({}) });
  if (!plainRecord(info) || typeof info.network !== 'string' || info.network !== network) {
    return Object.freeze({ network, operator, reason: 'network-mismatch', zeroFees: false, fees: emptyFees, fingerprint: fingerprint(network, operator, emptyFees) });
  }
  if (!plainRecord(info.fees) || !plainRecord(info.fees.intentFee)) {
    return Object.freeze({ network, operator, reason: 'policy-unavailable', zeroFees: false, fees: emptyFees, fingerprint: fingerprint(network, operator, emptyFees) });
  }
  const intentFee = Object.fromEntries(Object.entries(info.fees.intentFee).map(([name, value]) => [name, normalizeFeeValue(value)]));
  const fees = Object.freeze({ txFeeRate: normalizeFeeValue(info.fees.txFeeRate), intentFee: Object.freeze(intentFee) });
  const values = [fees.txFeeRate, ...Object.values(fees.intentFee)];
  const unreadable = values.some(value => ['missing', 'malformed', 'unknown'].includes(value.kind));
  const nonzero = values.some(value => value.kind === 'nonzero');
  const reason: WalletPolicyReason = unreadable ? 'policy-unavailable' : nonzero ? 'unsupported-fees' : 'supported';
  return Object.freeze({ network, operator, reason, zeroFees: reason === 'supported', fees, fingerprint: fingerprint(network, operator, fees) });
}

export function walletPolicyMessage(reason: Exclude<WalletPolicyReason, 'supported'>, operation: string): string {
  if (reason === 'network-mismatch') return `The configured operator does not match this wallet's network. ${operation} is unavailable.`;
  if (reason === 'unsupported-fees') return `The current operator fee terms are not supported for ${operation}.`;
  return `Operator policy verification is unavailable. ${operation} is unavailable.`;
}

/** Operations with verified zero-fee math must reject nonzero or unreadable terms before mutation. */
export function requireZeroFeePolicy(policy: WalletNetworkPolicy, operation: string): WalletNetworkPolicy {
  if (policy.reason !== 'supported') throw new WalletNetworkPolicyError(policy.reason, operation);
  return policy;
}

/** Direct Arkade sends bind every readable policy term but do not inherit transfer-only fee restrictions. */
export function requireReadablePolicy(policy: WalletNetworkPolicy, operation: string): WalletNetworkPolicy {
  if (policy.reason === 'network-mismatch' || policy.reason === 'policy-unavailable') throw new WalletNetworkPolicyError(policy.reason, operation);
  return policy;
}

export function walletPolicyAvailability(policy: WalletNetworkPolicy, operation: string, zeroFeesRequired: boolean): WalletOperationAvailability {
  const reason = zeroFeesRequired ? policy.reason : policy.reason === 'unsupported-fees' ? 'supported' : policy.reason;
  return reason === 'supported'
    ? Object.freeze({ available: true })
    : Object.freeze({ available: false, reason, message: walletPolicyMessage(reason, operation) });
}
