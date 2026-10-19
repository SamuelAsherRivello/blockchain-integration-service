import { protectedConditionalVaultContext } from "./test-wallets/conditional-vault-context.ts";
import { createArkadeConditionalVaultApi } from "../packages/integration/src/client/wallet-layer-arkade/conditional-vault-api.ts";
import type { TestNetwork } from "../packages/integration/src/client/state-layer-core/test-network.ts";
import type { VaultJournalEntry } from "../packages/integration/src/client/state-layer-core/conditional-vault-journal.ts";

// Recover only an existing browser acceptance fixture. Never create new funds.
async function main() {
const [network, run] = process.argv.slice(2);
if (process.argv.length !== 4 || !["signet", "mutinynet"].includes(network))
  throw Error("vault-ui-reconcile-arguments");
const selected = network as TestNetwork;
const context = protectedConditionalVaultContext(selected);
const record = await context.vault.transaction((state) => {
  const saved = state.conditionalVaultUiAcceptance?.[run];
  if (!saved || saved.network !== selected || !saved.privateEntries?.length)
    throw Error("vault-ui-original-fixture-required");
  const originalCreate = saved.privateEntries.find(
    (entry) => entry.operation === "create",
  );
  if (!originalCreate?.recovery.length)
    throw Error("vault-ui-original-funded-request-required");
  return {
    account: saved.account,
    descriptor: saved.descriptor,
    id: saved.id,
    originalCreateId: originalCreate.operationId,
  };
});
const api = createArkadeConditionalVaultApi(
  selected,
  () => context.resolveWallet(record.account, selected),
  {
    journal: {
      transaction: (use) =>
        context.vault.transaction((state) =>
          use(
            state.conditionalVaultUiAcceptance[run]
              .privateEntries as VaultJournalEntry[],
          ),
        ),
    },
    lock: async (_key, work) => work(),
  },
);
if (!record.descriptor) {
  // Guard above requires the existing signed Create. This is an exact retry,
  // never a new funding request when the acknowledgement was lost.
  const recovered = await api.create({
    network: selected,
    id: record.id,
    operationId: record.originalCreateId,
    walletReference: record.account,
    durationSeconds: 120,
  });
  if (!recovered.inspection)
    throw Error("vault-ui-original-funding-unresolved");
  record.descriptor = recovered.inspection.descriptor;
  await context.vault.transaction((state) => {
    state.conditionalVaultUiAcceptance[run].descriptor = record.descriptor;
  });
}
let checked = await api.check(record.descriptor);
const pending = await context.vault.transaction((state) =>
  state.conditionalVaultUiAcceptance[run].privateEntries
    .filter((entry) => ["pending", "submitting"].includes(entry.phase))
    .map((entry) => ({
      operationId: entry.operationId,
      operation: entry.operation,
      expectedOutput: entry.expectedInput,
    })),
);
for (const entry of pending) {
  if (entry.operation === "increment") {
    const result = await api.increment({
      ...entry,
      descriptor: record.descriptor,
    });
    process.stdout.write(
      JSON.stringify({
        network,
        run,
        originalOperation: entry.operation,
        outcome: result.outcome,
        reason: result.reason,
      }) + "\n",
    );
  }
}
checked = await api.check(record.descriptor);
if (checked.status === "expired" && checked.activeOutput) {
  const result = await api.recover({
    operationId: `${run}-recovery`,
    descriptor: record.descriptor,
    expectedOutput: checked.activeOutput,
    walletReference: record.account,
  });
  checked = result.inspection ?? checked;
}
await context.vault.transaction((state) => {
  state.conditionalVaultUiAcceptance[run].reconciliation = {
    status: checked.status,
    evidence: checked.evidence,
  };
});
process.stdout.write(
  JSON.stringify({
    network,
    run,
    status: checked.status,
    evidence: checked.evidence,
    originalRecordsRetained: true,
  }) + "\n",
);
if (!["claimed", "recovered"].includes(checked.status)) process.exitCode = 1;
}
await main().catch(() => {
  process.stdout.write(JSON.stringify({complete:false,reason:"vault-protected-recovery-unavailable",originalRecordsRetained:true}) + "\n");
  process.exitCode = 1;
});
