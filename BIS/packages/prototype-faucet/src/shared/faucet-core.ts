import { ArkAddress, isValidArkAddress } from '@arkade-os/sdk';
import { isNetwork, type NetworkId } from './network-config.ts';

type FaucetError = Error & { code?: string };
type OperatorInfo = { network?: unknown; signerPubkey?: unknown };
type SendResult = { operationId?: string; transactionId?: string; txid?: string; status?: string };
type FaucetWallet = { send(input: { address: string; amount: number }): Promise<SendResult | undefined> };
type FaucetOperation = Readonly<{ operationId: string; network: NetworkId; address: string; amountSats: number;
  status: 'success' | 'pending'; createdAt: number; transactionId?: string }>;
type FaucetRequest = { network: unknown; address: unknown; amount: unknown; idempotencyKey: unknown; clientKey?: string };
type FaucetServiceOptions = { wallets: Readonly<Partial<Record<NetworkId, FaucetWallet>>>;
  infos: Readonly<Record<string, () => Promise<OperatorInfo>>>;
  limits?: Readonly<Partial<Record<NetworkId, unknown>>>;
  limiter?: ReturnType<typeof createRateLimiter>; now?: () => number };

export const MIN_AMOUNT_SATS = 1;
export const MAX_AMOUNT_SATS = 100_000;
export const ALLOWED_AMOUNTS = Object.freeze([25_000, 50_000, 100_000]);

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function normalizePublicKeyHex(value: unknown) {
  const normalized = String(value ?? '').replace(/^0x/i, '').toLowerCase();
  if (normalized.length === 66 && (normalized.startsWith('02') || normalized.startsWith('03'))) return normalized.slice(2);
  return normalized;
}

export function decodeArkadeAddress(address: unknown) {
  const value = String(address ?? '').trim();
  if (!value || !isValidArkAddress(value)) throw new Error('Enter a valid Arkade address.');
  const decoded = ArkAddress.decode(value);
  if (decoded.hrp !== 'tark') throw new Error('Enter a test-network Arkade address.');
  return decoded;
}

export function validateArkadeAddress(address: unknown, info: OperatorInfo | null | undefined, expectedNetwork: unknown) {
  if (!isNetwork(expectedNetwork)) throw new Error('Choose Signet or Mutinynet.');
  if (!info || info.network !== expectedNetwork) throw new Error('The selected Arkade operator is unavailable or mismatched.');
  const decoded = decodeArkadeAddress(address);
  const expected = normalizePublicKeyHex(info.signerPubkey);
  const actual = bytesToHex(decoded.serverPubKey);
  if (!expected || actual !== expected) throw new Error(`This address is not a ${expectedNetwork} Arkade address.`);
  return Object.freeze({ address: String(address).trim(), network: expectedNetwork });
}

export function validateAmount(amount: unknown, maximum = MAX_AMOUNT_SATS) {
  const value = Number(amount);
  if (!Number.isSafeInteger(value) || value < MIN_AMOUNT_SATS) throw new Error(`Choose a whole-satoshi amount from ${MIN_AMOUNT_SATS.toLocaleString()} to ${maximum.toLocaleString()}.`);
  if (value > maximum) throw new Error(`This faucet currently allows up to ${maximum.toLocaleString()} sats.`);
  return value;
}

export function safeError(error: unknown, fallback = 'The faucet is unavailable.') {
  const code = (error as FaucetError | null | undefined)?.code;
  if (String((error as FaucetError | null | undefined)?.message ?? '').includes('fee-estimation-unavailable')) return { code: 'UNAVAILABLE', message: 'Arkade operator fee estimation is unavailable. Try again later.' };
  if (['ADDRESS_INVALID', 'NETWORK_INVALID', 'AMOUNT_INVALID', 'LIMIT_EXCEEDED', 'RATE_LIMITED', 'IDEMPOTENCY_CONFLICT'].includes(code!)) return { code, message: (error as FaucetError).message };
  return { code: 'UNAVAILABLE', message: fallback };
}

/** Public failure labels must reflect actual evidence, never a guessed cause. */
export function publicOnboarding<T extends { failureCode?: string; failureMessage?: string }>(operation: T | null | undefined) {
  if (!operation) return undefined;
  const feeFailure=/fee-estimation-unavailable|failed to estimate fee rate/i.test(String(operation.failureMessage??''));
  const message=operation.failureCode==='operator-unavailable'
    ? feeFailure?'Arkade operator fee estimation is unavailable. Try again later.':'The Arkade operator is unavailable. Try again later.'
    : operation.failureCode==='policy-unsupported'
      ? 'The Arkade operator policy does not support onboarding right now.'
      : operation.failureCode==='settlement-rejected'
        ? 'The Arkade operator rejected onboarding. Try again later.'
        : operation.failureCode==='outcome-unknown'
          ? 'Onboarding is pending reconciliation. Do not submit it again.'
          : operation.failureMessage?'Onboarding could not be completed. Check its status before retrying.':undefined;
  return {...operation,...(message?{failureMessage:message}:{})};
}

export function createRateLimiter({ max = 5, windowMs = 86_400_000, now = () => Date.now() } = {}) {
  const attempts = new Map<string, number[]>();
  return Object.freeze({
    check(key: string) {
      const current = now();
      const values = (attempts.get(key) ?? []).filter(time => current - time < windowMs);
      if (values.length >= max) { const error: FaucetError = new Error('The faucet rate limit has been reached. Try again later.'); error.code = 'RATE_LIMITED'; throw error; }
      values.push(current);
      attempts.set(key, values);
    },
  });
}

export function createFaucetService({ wallets, infos, limits = {}, limiter = createRateLimiter(), now = () => Date.now() }: FaucetServiceOptions) {
  const operations = new Map<string, FaucetOperation>();
  return Object.freeze({
    async request({ network, address, amount, idempotencyKey, clientKey = 'local' }: FaucetRequest) {
      if (!isNetwork(network)) { const error: FaucetError = new Error('Choose Signet or Mutinynet.'); error.code = 'NETWORK_INVALID'; throw error; }
      if (!idempotencyKey || typeof idempotencyKey !== 'string') { const error: FaucetError = new Error('A request identifier is required.'); error.code = 'IDEMPOTENCY_CONFLICT'; throw error; }
      const existing = operations.get(idempotencyKey);
      if (existing) {
        if (existing.network !== network || existing.address !== String(address).trim() || existing.amountSats !== Number(amount)) { const error: FaucetError = new Error('This request identifier was already used for another request.'); error.code = 'IDEMPOTENCY_CONFLICT'; throw error; }
        return existing;
      }
      const info = await infos[network]();
      let destination;
      try { destination = validateArkadeAddress(address, info, network); } catch (cause) { (cause as FaucetError).code ??= 'ADDRESS_INVALID'; throw cause; }
      const configuredMaximum = Number(limits[network] ?? MAX_AMOUNT_SATS);
      const maximum = Math.min(configuredMaximum, MAX_AMOUNT_SATS);
      let amountSats;
      try { amountSats = validateAmount(amount, maximum); } catch (cause) { (cause as FaucetError).code ??= 'AMOUNT_INVALID'; throw cause; }
      limiter.check(`${network}:${clientKey}:${destination.address}`);
      const wallet = wallets[network];
      if (!wallet) { const error: FaucetError = new Error('Funding is not configured for this network.'); error.code = 'UNAVAILABLE'; throw error; }
      const sent = await wallet.send({ address: destination.address, amount: amountSats });
      const transactionId = sent?.transactionId ?? sent?.txid ?? sent?.operationId;
      const operation = Object.freeze({ operationId: String(sent?.operationId ?? sent?.txid ?? crypto.randomUUID()), network, address: destination.address, amountSats, status: sent?.status === 'success' ? 'success' : 'pending', createdAt: now(), ...(transactionId ? { transactionId: String(transactionId) } : {}) });
      operations.set(idempotencyKey, operation);
      return operation;
    },
    async status(operationId: string, { byRequest = false } = {}) {
      // Lost acknowledgements can be inspected by their original idempotency
      // key without replaying POST /request. This never sends or creates work.
      const operation = byRequest ? operations.get(operationId) : [...operations.values()].find(value => value.operationId === operationId);
      return operation ?? { operationId, status: 'unavailable' };
    },
  });
}

