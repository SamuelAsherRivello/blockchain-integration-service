import {
  Intent,
  Transaction,
  assertSubmittedArkTxid,
  matchServerCheckpoints,
  verifyTapscriptSignatures,
  type RestArkProvider,
  type RestEmulatorProvider,
  type Identity,
} from "@arkade-os/sdk";
import { base64, hex } from "@scure/base";
import type { VaultJournalEntry } from "../state-layer-core/conditional-vault-journal.ts";

/** Explicit mutation recovery only. Check never calls this function. Every
 * replay uses the original signed transaction and its exact checkpoint IDs.
 * Returned acknowledgements do not establish financial completion. */
export async function replayOriginalVaultRequest(
  record: VaultJournalEntry,
  dependencies: {
    ark: Pick<RestArkProvider, "submitTx" | "finalizeTx" | "getPendingTxs">;
    emulator: Pick<RestEmulatorProvider, "submitTx">;
    identity?: Identity;
    persistFinalization(request: [string, string[]]): Promise<void>;
  },
) {
  const original = record.recovery.find(
    (row) => row.target === "emulator" || row.target === "operator",
  );
  if (!original) throw Error("vault-original-request-not-submitted");
  const [raw, encoded] = original.request as [string, string[]];
  if (!Array.isArray(encoded)) throw Error("vault-original-request-mismatch");
  const arkTx = Transaction.fromPSBT(base64.decode(raw));
  if (arkTx.id !== record.transactionId)
    throw Error("vault-original-request-mismatch");
  const checkpoints = encoded.map((value) =>
    Transaction.fromPSBT(base64.decode(value)),
  );
  if (
    checkpoints.length !== arkTx.inputsLength ||
    checkpoints.some((checkpoint, index) => {
      const input = arkTx.getInput(index),
        previous = checkpoint.getInput(0);
      return (
        !input.txid ||
        hex.encode(input.txid) !== checkpoint.id ||
        input.index !== 0 ||
        checkpoint.inputsLength !== 1 ||
        Boolean(
          record.expectedInput &&
            (!previous.txid ||
              hex.encode(previous.txid) !==
                record.expectedInput.transactionId ||
              previous.index !== record.expectedInput.outputIndex),
        )
      );
    })
  )
    throw Error("vault-original-checkpoint-mismatch");
  const final = [...record.recovery]
    .reverse()
    .find((row) => row.target === "finalize");
  if (final) {
    const [id, finalCheckpoints] = final.request as [string, string[]];
    if (id !== record.transactionId || !Array.isArray(finalCheckpoints))
      throw Error("vault-original-request-mismatch");
    matchServerCheckpoints(
      finalCheckpoints,
      checkpoints,
      "vault original finalization",
    );
    await dependencies.ark.finalizeTx(id, finalCheckpoints);
    return;
  }
  if (original.target === "emulator") {
    await dependencies.emulator.submitTx(raw, encoded);
    return;
  }
  if (!dependencies.identity || !record.draft?.parameters)
    throw Error("vault-creator-wallet-required");
  const parameters = JSON.parse(String(record.draft.parameters));
  if (
    hex.encode(await dependencies.identity.xOnlyPublicKey()) !==
    parameters.creatorKey
  )
    throw Error("vault-creator-identity-mismatch");
  if (
    !Array.from({ length: arkTx.outputsLength }, (_, i) =>
      arkTx.getOutput(i),
    ).some(
      (output) =>
        output.amount === 1000n &&
        output.script &&
        hex.encode(output.script) === record.expectedScript,
    )
  )
    throw Error("vault-original-funding-mismatch");
  let response;
  try {
    response = await dependencies.ark.submitTx(raw, encoded);
  } catch {
    // A duplicate submission may already be pending at the operator. Prove
    // ownership of only the original inputs, then request that exact transaction.
    const message = { type: "get-pending-tx" as const, expire_at: 0 };
    const proof = Intent.create(
      message,
      checkpoints.map((checkpoint) => checkpoint.getInput(0)),
    );
    const signed = await dependencies.identity.sign(
      proof,
      // BIP-322 also requires the synthetic proof input at index 0.
      Array.from({ length: checkpoints.length + 1 }, (_, i) => i),
    );
    const pending = await dependencies.ark.getPendingTxs({
      proof: base64.encode(signed.toPSBT()),
      message,
    });
    response = pending.find((tx) => tx.arkTxid === arkTx.id);
    if (!response) throw Error("vault-original-funding-unresolved");
  }
  assertSubmittedArkTxid(response, arkTx, "vault original funding");
  const matches = matchServerCheckpoints(
    response.signedCheckpointTxs,
    checkpoints,
    "vault original funding",
  );
  const server = hex.decode(parameters.serverKey);
  const finalArk = Transaction.fromPSBT(base64.decode(response.finalArkTx));
  for (let index = 0; index < finalArk.inputsLength; index++)
    verifyTapscriptSignatures(finalArk, index, [parameters.serverKey]);
  const signedCheckpoints = [];
  for (const { server: checkpoint, local } of matches) {
    const expected = local.getInput(0),
      received = checkpoint.getInput(0);
    if (
      !expected.witnessUtxo ||
      !received.witnessUtxo ||
      expected.witnessUtxo.amount !== received.witnessUtxo.amount ||
      hex.encode(expected.witnessUtxo.script) !==
        hex.encode(received.witnessUtxo.script) ||
      JSON.stringify(expected.tapLeafScript) !==
        JSON.stringify(received.tapLeafScript) ||
      (received.sighashType !== undefined && received.sighashType !== 0)
    )
      throw Error("vault-original-checkpoint-mismatch");
    verifyTapscriptSignatures(checkpoint, 0, [hex.encode(server)]);
    const signed = await dependencies.identity.sign(checkpoint, [0]);
    verifyTapscriptSignatures(signed, 0, [parameters.creatorKey]);
    signedCheckpoints.push(base64.encode(signed.toPSBT()));
  }
  const finalization: [string, string[]] = [arkTx.id, signedCheckpoints];
  await dependencies.persistFinalization(finalization);
  await dependencies.ark.finalizeTx(...finalization);
}
