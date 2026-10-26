import { MAX_OPERATION_EXPOSURE_SATS } from './signing-limits.ts';
import { isDeepStrictEqual } from 'node:util';
import { buildOffchainTx, Transaction, type ArkTxInput, type CSVMultisigTapscript } from '@arkade-os/sdk';
import type {TreasureTrustedContext} from './treasure-contract-policy.ts';

/** Inputs and scripts must come from server-validated network/player context,
 * never from a client's assertion of ownership. This validator does not fetch,
 * submit, sign or authorize anything on its own.
 */
export type TrustedPaymentContext = {
  inputs: readonly (ArkTxInput & { assets: readonly { assetId: string; amount: bigint }[] })[];
  changeScript: Uint8Array;
  recipientScript: Uint8Array;
  serverUnrollScript: CSVMultisigTapscript.Type;
  maximumExposureSats: number;
  treasure?: TreasureTrustedContext;
};

const deny = () => Error('Offchain payment is outside the signing policy.');
const signatureFields = new Set(['partialSig', 'tapScriptSig', 'tapKeySig']);
function unsignedInput(input: ReturnType<Transaction['getInput']>) {
  return Object.fromEntries(Object.entries(input).filter(([key]) => !signatureFields.has(key)));
}

/** Exact SDK reconstruction binds checkpoint signatures to the accepted root.
 * Ignore only foreign signature fields, which do not change the signed intent.
 * In particular, do not ignore sighash, witness amounts, script paths or unknown
 * PSBT fields. No arbitrary checkpoint can become a second approved payment.
 */
export function assertCanonicalSigningTransaction(actual: Transaction, canonical: Transaction) {
  if (!isDeepStrictEqual(actual.unsignedTx, canonical.unsignedTx) || actual.inputsLength !== canonical.inputsLength || actual.outputsLength !== canonical.outputsLength) throw deny();
  for (let index = 0; index < actual.inputsLength; index++) {
    if (!isDeepStrictEqual(unsignedInput(actual.getInput(index)), unsignedInput(canonical.getInput(index)))) throw deny();
  }
  for (let index = 0; index < actual.outputsLength; index++) {
    if (!isDeepStrictEqual(actual.getOutput(index), canonical.getOutput(index))) throw deny();
  }
}

/** First policy case: plain Arkade sats, one verified Player recipient and
 * optional verified Game change. Asset packets, burns and contracts require
 * their own explicit policies and cannot pass this validator.
 */
export function validateOffchainPayment(actual: Transaction, trusted: TrustedPaymentContext) {
  if (!Number.isSafeInteger(trusted.maximumExposureSats) || trusted.maximumExposureSats <= 0 || trusted.maximumExposureSats > MAX_OPERATION_EXPOSURE_SATS ||
      trusted.inputs.length === 0 || trusted.inputs.length > 100 || actual.outputsLength < 2 || actual.outputsLength > 3 ||
      isDeepStrictEqual(trusted.changeScript, trusted.recipientScript)) throw deny();
  const outputs: { amount: bigint; script: Uint8Array }[] = [];
  let recipient = 0n, change = 0n, recipients = 0, changes = 0, total = 0n;
  const outpoints = new Set<string>();
  for (const input of trusted.inputs) {
    if (!Array.isArray(input.assets) || input.assets.length !== 0 || !Number.isSafeInteger(input.value) || input.value <= 0 || !/^[0-9a-f]{64}$/.test(input.txid) || !Number.isSafeInteger(input.vout) || input.vout < 0 || input.vout > 0xffffffff) throw deny();
    const outpoint = `${input.txid}:${input.vout}`;
    if (outpoints.has(outpoint)) throw deny();
    outpoints.add(outpoint);
    total += BigInt(input.value);
  }
  // The SDK appends the exact zero-value P2A output. Reconstruction below
  // checks it, rather than trusting a client label for the final output.
  for (let index = 0; index < actual.outputsLength - 1; index++) {
    const output = actual.getOutput(index);
    if (!output.script || typeof output.amount !== 'bigint' || output.amount <= 0n) throw deny();
    if (isDeepStrictEqual(output.script, trusted.recipientScript)) { recipients++; recipient += output.amount; }
    else if (isDeepStrictEqual(output.script, trusted.changeScript)) { changes++; change += output.amount; }
    else throw deny();
    outputs.push({ amount: output.amount, script: output.script });
  }
  const exposure = total - change;
  if (recipients !== 1 || changes > 1 || recipient <= 0n || recipient > exposure || exposure <= 0n || exposure > BigInt(trusted.maximumExposureSats)) throw deny();
  const plan = buildOffchainTx([...trusted.inputs], outputs, trusted.serverUnrollScript);
  assertCanonicalSigningTransaction(actual, plan.arkTx);
  return { ...plan, exposureSats: Number(exposure), recipientSats: Number(recipient), sourceOutpoints: [...outpoints] };
}
