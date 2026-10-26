import { MAX_OPERATION_EXPOSURE_SATS } from './signing-limits.ts';
import { isDeepStrictEqual } from 'node:util';
import { buildOffchainTx, type Transaction } from '@arkade-os/sdk';
import { assertCanonicalSigningTransaction, type TrustedPaymentContext } from './offchain-policy.ts';

/** Only after private owner authentication. The owner authorizes exact asset
 * operations/destinations; Bitcoin risk is still independently bounded using
 * fresh Game inputs and server-derived Game change, not client classifications.
 */
export function validateOwnerOffchain(tx: Transaction, context: TrustedPaymentContext) {
  const deny = () => Error('Owner transaction is outside the signing policy.');
  if (!context.inputs.length || context.inputs.length > 100 || tx.outputsLength < 2 || tx.outputsLength > 100 || !Number.isSafeInteger(context.maximumExposureSats) || context.maximumExposureSats < 0 || context.maximumExposureSats > MAX_OPERATION_EXPOSURE_SATS) throw deny();
  let inputValue = 0n, outputValue = 0n, change = 0n;
  const sourceOutpoints: string[] = [];
  for (const input of context.inputs) {
    if (!/^[a-f0-9]{64}$/.test(input.txid) || !Number.isSafeInteger(input.vout) || input.vout < 0 || input.vout > 0xffffffff || !Number.isSafeInteger(input.value) || input.value <= 0) throw deny();
    sourceOutpoints.push(`${input.txid}:${input.vout}`); inputValue += BigInt(input.value);
  }
  if (new Set(sourceOutpoints).size !== sourceOutpoints.length) throw deny();
  const outputs: { script: Uint8Array; amount: bigint }[] = [];
  for (let index = 0; index < tx.outputsLength - 1; index++) {
    const output = tx.getOutput(index);
    if (!output.script || typeof output.amount !== 'bigint' || output.amount < 0n) throw deny();
    outputs.push({ script: output.script, amount: output.amount }); outputValue += output.amount;
    if (isDeepStrictEqual(output.script, context.changeScript)) change += output.amount;
  }
  const exposure = inputValue - change;
  if (outputValue > inputValue || exposure < 0n || exposure > BigInt(context.maximumExposureSats)) throw deny();
  const plan = buildOffchainTx([...context.inputs], outputs, context.serverUnrollScript);
  assertCanonicalSigningTransaction(tx, plan.arkTx);
  return { ...plan, exposureSats: Number(exposure), recipientSats: Number(outputValue - change), sourceOutpoints };
}
