import { RestIndexerProvider, Transaction } from "@arkade-os/sdk";
import { base64, hex } from "@scure/base";
import { Vault } from "./test-wallets/vault.ts";
import { Operations } from "./test-wallets/operations.ts";
import { compileConditionalVault } from "../packages/integration/src/client/wallet-layer-arkade/conditional-vault-program.ts";
import { testNetwork } from "../packages/integration/src/client/state-layer-core/test-network.ts";

// Read-only reconciliation. It never signs, finalizes, replays or sends.
try {
  const runId = process.argv[2];
  if (process.argv.length !== 3 || !/^[a-z][a-z0-9-]{0,30}$/.test(runId ?? ""))
    throw Error("vault-reconcile-invalid-id");
  const vault = new Vault();
  const operations = new Operations(vault);
  const run = await vault.transaction((state) =>
    structuredClone(state.conditionalVaultRuns?.[runId]),
  );
  if (!run) throw Error("vault-reconcile-run-not-found");
  const record = (await operations.list()).find(
    (record) => record.intent.id === `${runId}-create`,
  );
  if (!record?.providerId)
    throw Error("vault-reconcile-original-acknowledgement-required");
  const compiled = compileConditionalVault(run.parameters, {
    legacyVersion: run.contractVersion === 4 ? 4 : 3,
  });
  const indexer = new RestIndexerProvider(testNetwork(run.network).operator);
  const result = await indexer.getVirtualTxs([record.providerId]);
  const tx = result.txs
    .map((raw) =>
      /^[a-f0-9]+$/i.test(raw)
        ? Transaction.fromRaw(hex.decode(raw))
        : Transaction.fromPSBT(base64.decode(raw)),
    )
    .find((tx) => tx.id === record.providerId);
  if (!tx) throw Error("vault-reconcile-transaction-unavailable");
  const canonical = compiled.states[0].pkScript;
  const subdust = `6a${canonical.slice(2)}`;
  const principal = run.contractVersion === 4 ? 1000 : 100;
  const matches = Array.from({ length: tx.outputsLength }, (_, vout) => ({
    vout,
    ...tx.getOutput(vout),
  })).filter(
    (out) =>
      out.amount === BigInt(principal) &&
      out.script &&
      [canonical, subdust].includes(hex.encode(out.script)),
  );
  if (matches.length !== 1) throw Error("vault-reconcile-output-mismatch");
  const output = matches[0];
  const script = hex.encode(output.script!);
  const { vtxos } = await indexer.getVtxos({
    outpoints: [{ txid: tx.id, vout: output.vout }],
  });
  if (
    vtxos.length !== 1 ||
    vtxos[0].value !== principal ||
    vtxos[0].script !== canonical
  )
    throw Error("vault-reconcile-indexer-mismatch");
  await operations.reconcile(record.intent.id, async (saved) => ({
    id: saved.intent.id,
    fingerprint: saved.fingerprint,
    providerId: tx.id,
    outcome: "settled",
    verified: true,
  }));
  await vault.transaction((state) => {
    state.conditionalVaultRuns[runId].fundingObservation = {
      txid: tx.id,
      vout: output.vout,
      value: principal,
      wireScript: script,
      indexerScript: canonical,
      classification:
        script === canonical
          ? "taproot-funded"
          : "subdust-carrier-funded-contract-compatibility-unverified",
    };
  });
  process.stdout.write(
    JSON.stringify({
      runId,
      network: run.network,
      transactionId: tx.id,
      outputIndex: output.vout,
      amountSats: principal,
      wireRepresentation: script === canonical ? "taproot" : "subdust-carrier",
      fundingObserved: true,
      contractExecutionVerified: false,
    }) + "\n",
  );
} catch (error) {
  const reason =
    error instanceof Error && /^vault-reconcile-[a-z-]+$/.test(error.message)
      ? error.message
      : "vault-reconcile-unavailable";
  process.stdout.write(
    JSON.stringify({ reason, fundingObserved: false }) + "\n",
  );
  process.exitCode = 1;
}
