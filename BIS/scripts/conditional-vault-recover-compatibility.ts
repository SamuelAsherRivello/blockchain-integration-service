import { Vault } from "./test-wallets/vault.ts";
import { compileConditionalVault } from "../packages/integration/src/client/wallet-layer-arkade/conditional-vault-program.ts";

// Read-only legacy recovery inventory. Never reinterpret an immutable old
// program as v5 or promise that its invalid cooperative layout can be repaired.
const runId = process.argv[2];
if (process.argv.length !== 3 || !/^vault-[a-z0-9-]+$/.test(runId ?? ""))
  throw Error("vault-recovery-invalid-run");
const record = await new Vault().transaction((state) => {
  const run = state.conditionalVaultRuns?.[runId];
  if (!run || ![3, 4].includes(run.contractVersion))
    throw Error("vault-original-record-required");
  return {
    version: run.contractVersion,
    parameters: run.parameters,
    receipts: run.receipts,
  };
});
const built = compileConditionalVault(record.parameters, {
  legacyVersion: record.version,
});
console.log(
  JSON.stringify({
    runId,
    network: record.parameters.network,
    version: built.version,
    cooperativeRecovery: "unsupported-original-layout",
    originalRecordsRetained: true,
    fundsMoved: false,
    originalFunding: record.receipts?.map((receipt) => ({
      transactionId: receipt.txid,
      outputIndex: receipt.vout,
    })),
    unilateralExit:
      record.version === 4
        ? "original-creator-csv-branch-reproducible-requires-unroll-maturity-and-package-fees"
        : "subdust-carrier-not-proven-spendable",
    originalExitScripts: built.states.map(
      (state) => state.functions.find((fn) => fn.name === "exit")?.tapscript,
    ),
  }),
);
