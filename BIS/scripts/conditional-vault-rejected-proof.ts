import { RestIndexerProvider, Transaction } from "@arkade-os/sdk";
import { base64, hex } from "@scure/base";
import { Vault } from "./test-wallets/vault.ts";
import { Operations } from "./test-wallets/operations.ts";
import { testNetwork } from "../packages/integration/src/client/state-layer-core/test-network.ts";

// Restricted reconciliation of an explicit dust-policy rejection. Never infer
// rejection from timeout, missing acknowledgement, or an absent transaction alone.
try {
  const runId = process.argv[2];
  if (process.argv.length !== 3 || !/^[a-z][a-z0-9-]{0,30}$/.test(runId ?? ""))
    throw Error("vault-rejected-invalid-run");
  const vault = new Vault();
  const ledger = new Operations(vault);
  const data = await vault.transaction((state) => {
    const run = state.conditionalVaultRuns?.[runId];
    const recovery = run?.recovery?.[`${runId}-create`];
    const diagnostics =
      recovery?.filter((item) => item.kind === "private-diagnostic") ?? [];
    if (
      diagnostics.length !== 1 ||
      !/below.*dust/i.test(diagnostics[0].request.message) ||
      !diagnostics[0].request.message.includes("330")
    )
      throw Error("vault-rejected-no-explicit-rejection");
    const submissions = recovery.filter(
      (item) => item.kind === "operator-submit",
    );
    if (
      submissions.length !== 1 ||
      recovery.some((item) => item.kind === "operator-finalize")
    )
      throw Error("vault-rejected-submission-ambiguous");
    return { network: run.network, request: submissions[0].request[0] };
  });
  const transaction = Transaction.fromPSBT(base64.decode(data.request));
  const indexer = new RestIndexerProvider(testNetwork(data.network).operator);
  // Arkd may retain the rejected PSBT in transaction storage. That is not a
  // financial receipt. Require no materialized output and unchanged inputs.
  const candidateOutputs = await indexer.getVtxos({
    outpoints: Array.from({ length: transaction.outputsLength }, (_, vout) => ({
      txid: transaction.id,
      vout,
    })),
  });
  if (candidateOutputs.vtxos.length)
    throw Error("vault-rejected-transaction-has-outputs");
  const inputs = [];
  for (let i = 0; i < transaction.inputsLength; i++) {
    const input = transaction.getInput(i);
    if (!input.txid || input.index === undefined)
      throw Error("vault-rejected-input-unavailable");
    // The submitted Ark input spends a checkpoint. Resolve its original coin
    // from the protected checkpoint submitted with the exact same request.
    inputs.push({ checkpoint: hex.encode(input.txid), vout: input.index });
  }
  const originals = await vault.transaction((state) => {
    const submission = state.conditionalVaultRuns[runId].recovery[
      `${runId}-create`
    ].find((item) => item.kind === "operator-submit");
    return submission.request[1].map((raw) => {
      const checkpoint = Transaction.fromPSBT(base64.decode(raw));
      const input = checkpoint.getInput(0);
      if (
        !input.txid ||
        input.index === undefined ||
        !inputs.some((row) => row.checkpoint === checkpoint.id)
      )
        throw Error("vault-rejected-checkpoint-mismatch");
      return { txid: hex.encode(input.txid), vout: input.index };
    });
  });
  const rows = await indexer.getVtxos({ outpoints: originals });
  if (
    originals.length !== inputs.length ||
    !originals.every((input) =>
      rows.vtxos.some(
        (coin) =>
          coin.txid === input.txid &&
          coin.vout === input.vout &&
          !coin.isSpent &&
          !coin.spentBy,
      ),
    )
  )
    throw Error("vault-rejected-input-not-unspent");
  const result = await ledger.reconcile(`${runId}-create`, async (record) => ({
    id: record.intent.id,
    fingerprint: record.fingerprint,
    providerId: transaction.id,
    outcome: "failed",
    verified: true,
  }));
  process.stdout.write(
    JSON.stringify({
      runId,
      network: data.network,
      state: result.state,
      transactionId: transaction.id,
      explicitPolicyRejection: true,
      originalInputsUnspent: true,
    }) + "\n",
  );
} catch (error) {
  const reason =
    error instanceof Error && /^vault-rejected-[a-z-]+$/.test(error.message)
      ? error.message
      : "vault-rejected-unresolved";
  process.stdout.write(JSON.stringify({ reason }) + "\n");
  process.exitCode = 1;
}
