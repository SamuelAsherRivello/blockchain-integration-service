import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { MnemonicIdentity, TxTree, type SignerSession, type Identity } from '@arkade-os/sdk';
import { decodeSigningValue, encodeSigningValue, fromHex, toHex } from '../../../integration/src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import type { SigningClaim, SigningStore } from './signing-store.ts';
import { SDK_SESSION_FIELDS } from './sdk-session-layout.ts';

// This private codec deliberately depends on SDK 0.4.79's session layout. An SDK
// upgrade must review this contract. No private snapshot uses the public encoder.
const fields = SDK_SESSION_FIELDS;
type State = { version: 1; expires: number; initialized: boolean; signed: boolean; transcripts: [string, string][]; sdk: Record<string, any>; settlementBatchDigest?: string };
type Binding = { scope: string; connectionId: string; operationId: string; sessionId: string; settlementReservationId?: string };
function bytes(value: unknown, length: number) {
  const result = typeof value === 'string' ? fromHex(value) : value;
  if (!(result instanceof Uint8Array) || result.length !== length) throw Error('Invalid private signing state.');
  return result;
}
function snapshot(signer: SignerSession): Record<string, any> {
  const sdk = signer as any;
  if (Object.keys(sdk).sort().join(',') !== fields) throw Error('Unsupported SDK signing-state layout.');
  const nonces = (value: Map<string, any> | null, secret: boolean) => value === null ? null : [...value].map(([key, item]) => [key, {
    pubNonce: toHex(bytes(item.pubNonce, 66)), ...(secret ? { secNonce: toHex(bytes(item.secNonce, 97)) } : {}),
  }]);
  return { secretKey: toHex(bytes(sdk.secretKey, 32)), myNonces: nonces(sdk.myNonces, true), aggregateNonces: nonces(sdk.aggregateNonces, false),
    graph: encodeSigningValue(sdk.graph), scriptRoot: sdk.scriptRoot === null ? null : toHex(bytes(sdk.scriptRoot, 32)), rootSharedOutputAmount: sdk.rootSharedOutputAmount?.toString() ?? null };
}
function restore(identity: Pick<Identity, 'signerSession'>, value: Record<string, any>): SignerSession {
  const signer = identity.signerSession() as any;
  if (Object.keys(signer).sort().join(',') !== fields || Object.keys(value).sort().join(',') !== fields) throw Error('Unsupported SDK signing-state layout.');
  const nonces = (items: any, secret: boolean) => {
    if (items === null) return null;
    if (!Array.isArray(items) || items.length > 1000) throw Error('Invalid private signing state.');
    return new Map(items.map(([key, item]) => {
      if (!/^[a-f0-9]{64}$/.test(key)) throw Error('Invalid signing transcript.');
      return [key, { pubNonce: bytes(item.pubNonce, 66), ...(secret ? { secNonce: bytes(item.secNonce, 97) } : {}) }];
    }));
  };
  const graph = decodeSigningValue(value.graph);
  if (graph !== null && !(graph instanceof TxTree)) throw Error('Invalid signing tree.');
  const amount = value.rootSharedOutputAmount;
  if (amount !== null && (typeof amount !== 'string' || !/^\d{1,30}$/.test(amount))) throw Error('Invalid signing amount.');
  signer.secretKey.fill(0);
  Object.assign(signer, { secretKey: bytes(value.secretKey, 32), myNonces: nonces(value.myNonces, true), aggregateNonces: nonces(value.aggregateNonces, false),
    graph, scriptRoot: value.scriptRoot === null ? null : bytes(value.scriptRoot, 32), rootSharedOutputAmount: amount === null ? null : BigInt(amount) });
  return signer;
}
function seal(secret: string, binding: Binding, state: State) {
  const key = createHmac('sha256', secret).update('bis-private-session-key-v1').digest();
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(JSON.stringify(binding)));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(state), 'utf8'), cipher.final()]);
  key.fill(0);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}
function unseal(secret: string, binding: Binding, encrypted: string): State {
  const key = createHmac('sha256', secret).update('bis-private-session-key-v1').digest();
  try {
    const value = Buffer.from(encrypted, 'base64url');
    const cipher = createDecipheriv('aes-256-gcm', key, value.subarray(0, 12));
    cipher.setAAD(Buffer.from(JSON.stringify(binding))); cipher.setAuthTag(value.subarray(12, 28));
    return JSON.parse(Buffer.concat([cipher.update(value.subarray(28)), cipher.final()]).toString('utf8'));
  } finally { key.fill(0); }
}

/** Invoked only while the shared, non-expiring wallet claim is held. Persist every
 * mutation before committing the response. Any uncertain failure retains that claim.
 */
export async function executeHostedSigning(options: {
  identity: MnemonicIdentity; secret: string; connectionId: string; connectionExpires: number; now: number;
  store: SigningStore; claim: SigningClaim; owner: string; method: string; args: any[]; sessionId?: string;
  sessionPolicy?: { reservationId: string; publicKey: string; identity: Pick<Identity, 'signerSession'> };
}): Promise<unknown> {
  const { identity, store, claim, owner, method, args } = options;
  if (!Array.isArray(args)) throw Error('Invalid signing arguments.');
  const policy = options.sessionPolicy;
  if (policy && (!method.startsWith('session.') || !/^[a-f0-9]{64}$/.test(policy.reservationId) || !/^0[23][a-f0-9]{64}$/.test(policy.publicKey) ||
      policy.reservationId !== claim.transactionId || policy.reservationId !== claim.exposureId ||
      claim.settlementBatch !== undefined && claim.settlementBatch.reservationId !== policy.reservationId)) throw Error('Original settlement session binding invalid.');
  if (method === 'sign') return encodeSigningValue(await identity.sign(args[0], args[1] ?? undefined));
  if (method === 'signMessage') {
    if (!(args[0] instanceof Uint8Array) || !['schnorr', 'ecdsa'].includes(args[1])) throw Error('Invalid signing message.');
    return encodeSigningValue(await identity.signMessage(args[0], args[1]));
  }
  const sessionId = method === 'session.create' ? randomUUID() : options.sessionId;
  if (typeof sessionId !== 'string' || !/^[a-f0-9-]{36}$/.test(sessionId)) throw Error('Invalid signing session.');
  const binding: Binding = { scope: claim.scope, connectionId: options.connectionId, operationId: claim.operationId, sessionId,
    ...(policy ? { settlementReservationId: policy.reservationId } : {}) };
  const sessionIdentity = policy?.identity ?? identity;
  const assertKey = async (signer: SignerSession) => {
    if (policy && toHex(await signer.getPublicKey()) !== policy.publicKey) throw Error('Original settlement session key changed.');
  };
  let signer: SignerSession, state: State, result: unknown;
  if (method === 'session.create') {
    signer = sessionIdentity.signerSession();
    await assertKey(signer);
    state = { version: 1, expires: Math.min(options.connectionExpires, options.now + 600000), initialized: false, signed: false, transcripts: [], sdk: {} };
    if (policy && claim.settlementBatch) state.settlementBatchDigest = claim.settlementBatch.digest;
    result = sessionId;
  } else {
    const encrypted = await store.session(claim, owner, sessionId);
    if (!encrypted) throw Error('Original signing session lost.');
    state = unseal(options.secret, binding, encrypted);
    if (state.version !== 1 || !Number.isSafeInteger(state.expires) || state.expires <= options.now || typeof state.initialized !== 'boolean' || typeof state.signed !== 'boolean' || !Array.isArray(state.transcripts)) throw Error('Original signing session expired or invalid.');
    if (policy) {
      if (state.settlementBatchDigest !== undefined && (!/^[a-f0-9]{64}$/.test(state.settlementBatchDigest) || state.settlementBatchDigest !== claim.settlementBatch?.digest) ||
          state.initialized && state.settlementBatchDigest === undefined ||
          !['session.getPublicKey', 'session.init'].includes(method) && !claim.settlementBatch) throw Error('Original settlement batch binding invalid.');
    }
    signer = restore(sessionIdentity, state.sdk);
    await assertKey(signer);
    if (method === 'session.getPublicKey') result = await signer.getPublicKey();
    else if (method === 'session.init') {
      if (policy && !claim.settlementBatch) throw Error('Original settlement batch binding required.');
      if (state.initialized || !(args[0] instanceof TxTree) || !(args[1] instanceof Uint8Array) || args[1].length !== 32 || typeof args[2] !== 'bigint' || args[2] <= 0n) throw Error('Signing transcript already set or invalid.');
      state.initialized = true; await signer.init(args[0], args[1], args[2]);
      if (policy) state.settlementBatchDigest = claim.settlementBatch!.digest;
    } else if (method === 'session.getNonces') {
      if (!state.initialized || state.signed) throw Error('Invalid signing phase.');
      result = await signer.getNonces();
    } else if (method === 'session.aggregatedNonces') {
      if (!state.initialized || state.signed || typeof args[0] !== 'string' || !(args[1] instanceof Map)) throw Error('Invalid signing phase.');
      const transcripts = new Map(state.transcripts), transcript = JSON.stringify(encodeSigningValue(args[1]));
      if (transcripts.has(args[0]) && transcripts.get(args[0]) !== transcript) throw Error('Signing nonces changed.');
      transcripts.set(args[0], transcript); state.transcripts = [...transcripts];
      result = await signer.aggregatedNonces(args[0], args[1]);
    } else if (method === 'session.sign') {
      if (!state.initialized || state.signed) throw Error('Signing session already consumed.');
      state.signed = true; result = await signer.sign();
    } else throw Error('Unsupported signer method.');
  }
  state.sdk = snapshot(signer);
  await store.session(claim, owner, sessionId, seal(options.secret, binding, state));
  return encodeSigningValue(result);
}
