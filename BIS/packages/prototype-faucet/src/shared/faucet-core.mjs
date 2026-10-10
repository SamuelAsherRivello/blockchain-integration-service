import { ArkAddress, isValidArkAddress } from '@arkade-os/sdk';
import { isNetwork } from './network-config.mjs';

export const ALLOWED_AMOUNTS = Object.freeze([50_000, 100_000, 200_000]);

function bytesToHex(bytes) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function normalizePublicKeyHex(value) {
  const normalized = String(value ?? '').replace(/^0x/i, '').toLowerCase();
  if (normalized.length === 66 && (normalized.startsWith('02') || normalized.startsWith('03'))) return normalized.slice(2);
  return normalized;
}

export function decodeArkadeAddress(address) {
  const value = String(address ?? '').trim();
  if (!value || !isValidArkAddress(value)) throw new Error('Enter a valid Arkade address.');
  const decoded = ArkAddress.decode(value);
  if (decoded.hrp !== 'tark') throw new Error('Enter a test-network Arkade address.');
  return decoded;
}

export function validateArkadeAddress(address, info, expectedNetwork) {
  if (!isNetwork(expectedNetwork)) throw new Error('Choose Signet or Mutinynet.');
  if (!info || info.network !== expectedNetwork) throw new Error('The selected Arkade operator is unavailable or mismatched.');
  const decoded = decodeArkadeAddress(address);
  const expected = normalizePublicKeyHex(info.signerPubkey);
  const actual = bytesToHex(decoded.serverPubKey);
  if (!expected || actual !== expected) throw new Error(`This address is not a ${expectedNetwork} Arkade address.`);
  return Object.freeze({ address: String(address).trim(), network: expectedNetwork });
}

export function validateAmount(amount, maximum = Number.POSITIVE_INFINITY) {
  const value = Number(amount);
  if (!Number.isSafeInteger(value) || value <= 0 || !ALLOWED_AMOUNTS.includes(value)) throw new Error('Choose an available faucet amount.');
  if (value > maximum) throw new Error(`This faucet currently allows up to ${maximum.toLocaleString()} sats.`);
  return value;
}

export function safeError(error, fallback = 'The faucet is unavailable.') {
  const code = error?.code;
  if (['ADDRESS_INVALID', 'NETWORK_INVALID', 'AMOUNT_INVALID', 'LIMIT_EXCEEDED', 'RATE_LIMITED', 'IDEMPOTENCY_CONFLICT'].includes(code)) return { code, message: error.message };
  return { code: 'UNAVAILABLE', message: fallback };
}

export function createRateLimiter({ max = 5, windowMs = 86_400_000, now = () => Date.now() } = {}) {
  const attempts = new Map();
  return Object.freeze({
    check(key) {
      const current = now();
      const values = (attempts.get(key) ?? []).filter(time => current - time < windowMs);
      if (values.length >= max) { const error = new Error('The faucet rate limit has been reached. Try again later.'); error.code = 'RATE_LIMITED'; throw error; }
      values.push(current);
      attempts.set(key, values);
    },
  });
}

export function createFaucetService({ wallets, infos, limits = {}, limiter = createRateLimiter(), now = () => Date.now() }) {
  const operations = new Map();
  return Object.freeze({
    async request({ network, address, amount, idempotencyKey, clientKey = 'local' }) {
      if (!isNetwork(network)) { const error = new Error('Choose Signet or Mutinynet.'); error.code = 'NETWORK_INVALID'; throw error; }
      if (!idempotencyKey || typeof idempotencyKey !== 'string') { const error = new Error('A request identifier is required.'); error.code = 'IDEMPOTENCY_CONFLICT'; throw error; }
      const existing = operations.get(idempotencyKey);
      if (existing) {
        if (existing.network !== network || existing.address !== String(address).trim() || existing.amountSats !== Number(amount)) { const error = new Error('This request identifier was already used for another request.'); error.code = 'IDEMPOTENCY_CONFLICT'; throw error; }
        return existing;
      }
      const info = await infos[network]();
      let destination;
      try { destination = validateArkadeAddress(address, info, network); } catch (cause) { cause.code ??= 'ADDRESS_INVALID'; throw cause; }
      const maximum = Number(limits[network] ?? Math.max(...ALLOWED_AMOUNTS));
      let amountSats;
      try { amountSats = validateAmount(amount, maximum); } catch (cause) { cause.code ??= 'AMOUNT_INVALID'; throw cause; }
      limiter.check(`${network}:${clientKey}:${destination.address}`);
      const wallet = wallets[network];
      if (!wallet) { const error = new Error('Funding is not configured for this network.'); error.code = 'UNAVAILABLE'; throw error; }
      const sent = await wallet.send({ address: destination.address, amount: amountSats });
      const operation = Object.freeze({ operationId: String(sent?.operationId ?? sent?.txid ?? crypto.randomUUID()), network, address: destination.address, amountSats, status: sent?.status === 'success' ? 'success' : 'pending', createdAt: now(), ...(sent?.txid ? { transactionId: String(sent.txid) } : {}) });
      operations.set(idempotencyKey, operation);
      return operation;
    },
    async status(operationId) {
      const operation = [...operations.values()].find(value => value.operationId === operationId);
      return operation ?? { operationId, status: 'unavailable' };
    },
  });
}
