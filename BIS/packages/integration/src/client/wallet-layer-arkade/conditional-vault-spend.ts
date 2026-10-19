import { arkade, Transaction, type Identity } from "@arkade-os/sdk";
import { base64, hex } from "@scure/base";
import { VAULT_PRINCIPAL } from "./conditional-vault-program.ts";

/** Validate the canonical SDK/operator layout before signing. The operator
 * rebuilds the transaction, so a reordered anchor would change its transaction
 * ID and fail ARK_TX_MISMATCH. Never rewrite an immutable older contract.
 */
export function normalizeVaultOutputLayout(transaction: Transaction) {
  if (transaction.outputsLength !== 3)
    throw Error("vault-spend-invalid-layout");
  const anchor = (index: number) =>
    hex.encode(transaction.getOutput(index).script ?? new Uint8Array()) ===
    "51024e73";
  if (
    !anchor(2) ||
    transaction.getOutput(0).amount !== VAULT_PRINCIPAL ||
    transaction.getOutput(1).amount !== 0n ||
    transaction.getOutput(1).script?.[0] !== 0x6a
  )
    throw Error("vault-spend-invalid-layout");
  return transaction;
}

export async function sendConditionalVaultSpend(
  contract: InstanceType<typeof arkade.ArkadeContract>,
  emulator: {
    submitTx(
      arkTx: string,
      checkpoints: string[],
    ): Promise<{ signedArkTx: string; signedCheckpointTxs: string[] }>;
  },
  branch: "increment" | "claim" | "recover",
  coin: { txid: string; vout: number; value: number },
  destination: Uint8Array,
  identity?: Identity,
) {
  if (coin.value !== Number(VAULT_PRINCIPAL))
    throw Error("vault-spend-principal-mismatch");
  const { arkTx, checkpoints } = await contract.functions[branch]()
    .from(coin)
    .to(destination, VAULT_PRINCIPAL)
    .build();
  normalizeVaultOutputLayout(arkTx);
  if (branch !== "increment" && !identity)
    throw Error("vault-spend-creator-required");
  const signed =
    identity && branch !== "increment"
      ? await identity.sign(arkTx, [0])
      : arkTx;
  const signedCheckpoints =
    identity && branch !== "increment"
      ? await Promise.all(checkpoints.map((c) => identity.sign(c, [0])))
      : checkpoints;
  const result = await emulator.submitTx(
    base64.encode(signed.toPSBT()),
    signedCheckpoints.map((c) => base64.encode(c.toPSBT())),
  );
  const returned = Transaction.fromPSBT(base64.decode(result.signedArkTx));
  if (returned.id !== arkTx.id)
    throw Error("vault-spend-acknowledgement-mismatch");
  return { txid: returned.id };
}
