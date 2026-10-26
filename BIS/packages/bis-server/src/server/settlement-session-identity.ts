import { createHmac } from 'node:crypto';
import { SingleKey, type Transaction, type Identity } from '@arkade-os/sdk';
import { Transaction as BitcoinTransaction } from '@scure/btc-signer';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import type { SettlementBinding } from './settlement-authorization.ts';
import { boundSdkSession } from './sdk-session-layout.ts';

/** Server-private MuSig identity for one ORIGINAL settlement draft. The caller
 * supplies the canonical Game-key draft after fresh source/intent validation,
 * before substituting this session public key into the registration message.
 * This avoids a self-referential key derivation. Never use this identity for
 * wallet inputs, ownership proofs, messages or general Game signing.
 * Derivation is not a grant; original-input reservations still apply.
 */
export function settlementSessionIdentity(secret: string | undefined, binding: SettlementBinding, canonicalDraft: Transaction): Readonly<Pick<Identity, 'compressedPublicKey' | 'xOnlyPublicKey' | 'signerSession'>> {
  if (typeof secret !== 'string' || secret.length < 32 || !['signet', 'mutinynet'].includes(binding.network) ||
      !/^[a-f0-9]{64}$/.test(binding.profileId) || Object.values(binding).some(value => typeof value !== 'string' || !value || value.length > 2048) ||
      !(canonicalDraft instanceof BitcoinTransaction) || canonicalDraft.inputsLength < 2 || canonicalDraft.inputsLength > 101 || canonicalDraft.outputsLength > 100) throw Error('Settlement session identity unavailable.');
  const draft = canonicalDraft.toPSBT();
  if (draft.length > 128 * 1024) throw Error('Settlement session identity unavailable.');
  const scope = JSON.stringify(['bis-settlement-session-key-v1', binding.audience, binding.gameId, binding.network, binding.profileId, binding.operationId, binding.connectionId]);
  for (let counter = 0; counter < 16; counter++) {
    const key = createHmac('sha256', secret).update(scope).update('\0').update(draft).update('\0' + counter).digest();
    try {
      if (secp256k1.utils.isValidSecretKey(key)) {
        const privateKey = Uint8Array.from(key), identity = SingleKey.fromPrivateKey(privateKey);
        return Object.freeze({ compressedPublicKey: () => identity.compressedPublicKey(), xOnlyPublicKey: () => identity.xOnlyPublicKey(), signerSession: () => boundSdkSession(identity, privateKey) });
      }
    } finally { key.fill(0); }
  }
  throw Error('Settlement session identity unavailable.');
}
