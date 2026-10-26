import { isDeepStrictEqual } from 'node:util';
import { Intent, Transaction, VtxoScript, Extension, createAssetPacket, type IntentCoin, type Recipient } from '@arkade-os/sdk';
import { RawPSBTV0 } from '@scure/btc-signer/psbt.js';
import { assertCanonicalSigningTransaction } from './offchain-policy.ts';
import { MAX_OPERATION_EXPOSURE_SATS } from './signing-limits.ts';

export type TrustedSettlementContext = Readonly<{
  inputs: readonly IntentCoin[];
  gamePublicKey: string;
  sessionPublicKey?: string;
  arkadeScript: Uint8Array;
  bitcoinScript: Uint8Array;
  dustAmount: bigint;
  maximumExposureSats: number;
}>;
const deny = () => Error('Settlement intent is outside the signing policy.');
const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

/** Validate an SDK ownership proof, not a blockchain spend or settlement
 * receipt. The caller must obtain this context from fresh server-verified Game
 * sources and bind every proof to one original settlement authorization.
 */
export function validateSettlementIntent(actual: Transaction, context: TrustedSettlementContext) {
  const global = RawPSBTV0.decode(actual.toPSBT(0)).global;
  const messageBytes = global.genericSignedMessage;
  if (!(messageBytes instanceof Uint8Array) || messageBytes.length === 0 || messageBytes.length > 8192 ||
      !/^0[23][a-f0-9]{64}$/.test(context.gamePublicKey) || context.sessionPublicKey !== undefined && !/^0[23][a-f0-9]{64}$/.test(context.sessionPublicKey) || !Number.isSafeInteger(context.maximumExposureSats) ||
      context.maximumExposureSats < 0 || context.maximumExposureSats > MAX_OPERATION_EXPOSURE_SATS ||
      !context.inputs.length || context.inputs.length > 100 || typeof context.dustAmount !== 'bigint' || context.dustAmount <= 0n ||
      isDeepStrictEqual(context.arkadeScript, context.bitcoinScript)) throw deny();
  let message: Intent.Message;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(messageBytes);
    message = JSON.parse(text);
    if (!message || typeof message !== 'object' || Array.isArray(message) ||
        !['register', 'delete', 'get-pending-tx'].includes(message.type) || message.expire_at !== 0 ||
        Intent.encodeMessage(message) !== text) throw deny();
  } catch { throw deny(); }
  const register = message.type === 'register';
  const expectedFields = register ? ['cosigners_public_keys', 'expire_at', 'onchain_output_indexes', 'type', 'valid_at'] : ['expire_at', 'type'];
  if (!isDeepStrictEqual(Object.keys(message).sort(), expectedFields.sort())) throw deny();
  const points = new Set<string>(), holdings = new Map<string, bigint>();
  let value = 0n;
  const assetInputs = new Map<number, { assetId: string; amount: bigint }[]>();
  context.inputs.forEach((coin, index) => {
    const point = `${coin.txid}:${coin.vout}`;
    if (!/^[a-f0-9]{64}$/.test(coin.txid) || !Number.isSafeInteger(coin.vout) || coin.vout < 0 || coin.vout > 0xffffffff ||
        !Number.isSafeInteger(coin.value) || coin.value <= 0 || points.has(point) || !(coin.tapTree instanceof Uint8Array)) throw deny();
    const source = VtxoScript.decode(coin.tapTree).pkScript;
    if (!isDeepStrictEqual(source, context.arkadeScript) && !isDeepStrictEqual(source, context.bitcoinScript)) throw deny();
    points.add(point); value += BigInt(coin.value);
    const assets = 'assets' in coin ? coin.assets ?? [] : [], seen = new Set<string>();
    if (!Array.isArray(assets) || assets.length > 100) throw deny();
    for (const asset of assets) {
      if (!/^[a-f0-9]{68}$/.test(asset.assetId) || typeof asset.amount !== 'bigint' || asset.amount <= 0n || seen.has(asset.assetId)) throw deny();
      seen.add(asset.assetId);
      holdings.set(asset.assetId, (holdings.get(asset.assetId) ?? 0n) + asset.amount);
      if (holdings.size > 100) throw deny();
    }
    // Intent input 0 is synthetic. Real asset source indexes begin at 1.
    if (assets.length) assetInputs.set(index + 1, assets.map(asset => ({ ...asset })));
  });
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw deny();
  let exposureSats = 0;
  const outputs: { amount: bigint; script: Uint8Array }[] = [];
  if (message.type === 'register') {
    if (message.valid_at !== 0 || !Array.isArray(message.onchain_output_indexes) || !Array.isArray(message.cosigners_public_keys) || actual.outputsLength < 1 || actual.outputsLength > 100) throw deny();
    const onchain = message.onchain_output_indexes;
    if (onchain.some((index, position) => !Number.isSafeInteger(index) || index < 0 || index >= actual.outputsLength || position > 0 && index <= onchain[position - 1])) throw deny();
    let paid = 0n, assetDestination = -1;
    for (let i = 0; i < actual.outputsLength; i++) {
      const output = actual.getOutput(i);
      if (!output.script || typeof output.amount !== 'bigint' || output.amount < 0n) throw deny();
      if (Extension.isExtension(output.script)) {
        if (i !== actual.outputsLength - 1 || !holdings.size || output.amount !== 0n || onchain.includes(i)) throw deny();
        continue;
      }
      if (output.amount === 0n || !isDeepStrictEqual(output.script, onchain.includes(i) ? context.bitcoinScript : context.arkadeScript)) throw deny();
      if (!onchain.includes(i) && assetDestination === -1) assetDestination = i;
      paid += output.amount;
      outputs.push({ amount: output.amount, script: output.script });
    }
    if (!outputs.length || paid > value || value - paid > BigInt(context.maximumExposureSats)) throw deny();
    const hasOffchain = outputs.length > onchain.length;
    if (!isDeepStrictEqual(message.cosigners_public_keys, hasOffchain ? [context.sessionPublicKey ?? context.gamePublicKey] : [])) throw deny();
    if (holdings.size) {
      if (assetDestination < 0 || outputs[assetDestination].amount < context.dustAmount) throw deny();
      const recipients: Recipient[] = outputs.map(output => ({ address: '', amount: Number(output.amount) }));
      recipients[assetDestination] = { ...recipients[assetDestination], assets: [...holdings].map(([assetId, amount]) => ({ assetId, amount })) };
      outputs.push(Extension.create([createAssetPacket(assetInputs, recipients)]).txOut());
    }
    exposureSats = Number(value - paid);
  }
  const proof = Intent.create(message, [...context.inputs], outputs);
  assertCanonicalSigningTransaction(actual, proof);
  if (!isDeepStrictEqual(global, RawPSBTV0.decode(proof.toPSBT(0)).global)) throw deny();
  return Object.freeze({ proof, kind: message.type, exposureSats, sourceOutpoints: [...points],
    outputs: outputs.map(output => ({ amount: String(output.amount), script: hex(output.script) })) });
}
