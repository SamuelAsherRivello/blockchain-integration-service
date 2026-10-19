import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Intent, RestArkProvider, Transaction } from "@arkade-os/sdk";
import { base64, hex } from "@scure/base";
import { protectedConditionalVaultContext } from "./test-wallets/conditional-vault-context.ts";
import { compileVaultDescriptor } from "../packages/integration/src/client/wallet-layer-arkade/conditional-vault-descriptor.ts";
import {
  testNetwork,
  type TestNetwork,
} from "../packages/integration/src/client/state-layer-core/test-network.ts";
import { createArkadeConditionalVaultApi } from "../packages/integration/src/client/wallet-layer-arkade/conditional-vault-api.ts";
import type { VaultJournalEntry } from "../packages/integration/src/client/state-layer-core/conditional-vault-journal.ts";

// Operator-controlled recovery, not a browser timeout shortcut. Restarting the
// owned co-signer kills an old in-flight signing/submission attempt. Only then
// can authenticated absence plus the original unspent output prove that an
// expired request was not accepted. All original payloads remain protected.
async function main() {
const [network, run] = process.argv.slice(2);
if (process.argv.length !== 4 || !["signet", "mutinynet"].includes(network))
  throw Error("vault-fence-arguments");
const selected = network as TestNetwork,
  context = protectedConditionalVaultContext(selected);
const saved = await context.vault.transaction((state) => {
  const record = state.conditionalVaultUiAcceptance?.[run];
  if (
    !record ||
    record.network !== selected ||
    !record.descriptor ||
    record.descriptor.deadline * 1000 >= Date.now()
  )
    throw Error("vault-fence-original-expired-fixture-required");
  const entry = record.privateEntries.find((e) =>
    ["submitting", "pending"].includes(e.phase),
  );
  if (
    !entry ||
    entry.operation !== "increment" ||
    entry.recovery.length !== 1 ||
    entry.recovery[0].target !== "emulator"
  )
    throw Error("vault-fence-emulator-only-request-required");
  return {
    account: record.account,
    descriptor: record.descriptor,
    entry: structuredClone(entry),
  };
});
const api = createArkadeConditionalVaultApi(
  selected,
  () => context.resolveWallet(saved.account, selected),
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
const before = await api.check(saved.descriptor);
if (
  before.status !== "expired" ||
  !before.activeOutput ||
  JSON.stringify(before.activeOutput) !==
    JSON.stringify(saved.entry.expectedInput)
)
  throw Error("vault-fence-original-output-unresolved");
const [raw, checkpoints] = saved.entry.recovery[0].request as [
  string,
  string[],
];
const original = Transaction.fromPSBT(base64.decode(raw));
const checkpoint = Transaction.fromPSBT(base64.decode(checkpoints[0]));
const input = checkpoint.getInput(0),
  built = compileVaultDescriptor(saved.descriptor);
if (
  original.id !== saved.entry.transactionId ||
  checkpoint.id !== hex.encode(original.getInput(0).txid!) ||
  checkpoints.length !== 1 ||
  original.inputsLength !== 1 ||
  !input.witnessUtxo ||
  input.witnessUtxo.amount !== 1000n ||
  hex.encode(input.witnessUtxo.script) !==
    built.states[before.progress!].pkScript
)
  throw Error("vault-fence-original-request-mismatch");
await new Promise<void>((resolve, reject) => {
  const child = spawn(
    process.execPath,
    [
      fileURLToPath(new URL("./conditional-vault-service.ts", import.meta.url)),
      "restart",
      selected,
    ],
    { windowsHide: true, stdio: ["ignore", "ignore", "ignore"] },
  );
  child.on("error", reject);
  child.on("close", (code) =>
    code === 0
      ? resolve()
      : reject(Error("vault-fence-service-restart-unverified")),
  );
});
const lease = await context.resolveWallet(saved.account, selected);
try {
  if (
    hex.encode(await lease.wallet.identity.xOnlyPublicKey()) !==
    saved.descriptor.creatorPublicKey
  )
    throw Error("vault-fence-creator-mismatch");
  const exit = built.states[before.progress!].script.functionByName("exit")!;
  const message = { type: "get-pending-tx" as const, expire_at: 0 };
  const proof = Intent.create(message, [
    { ...input, tapLeafScript: [exit.tapLeafScript] },
  ]);
  const signed = await lease.wallet.identity.sign(proof, [0, 1]);
  const pending = await new RestArkProvider(
    testNetwork(selected).operator,
  ).getPendingTxs({ proof: base64.encode(signed.toPSBT()), message });
  if (pending.length !== 0)
    throw Error("vault-fence-pending-transaction-retained");
  const after = await api.check(saved.descriptor);
  if (
    after.status !== "expired" ||
    JSON.stringify(after.activeOutput) !== JSON.stringify(before.activeOutput)
  )
    throw Error("vault-fence-output-changed");
  await context.vault.transaction((state) => {
    const entry = state.conditionalVaultUiAcceptance[run].privateEntries.find(
      (e) => e.operationId === saved.entry.operationId,
    );
    if (
      !entry ||
      entry.phase === "verified" ||
      entry.transactionId !== saved.entry.transactionId ||
      entry.recovery.length !== 1
    )
      throw Error("vault-fence-journal-changed");
    entry.phase = "rejected";
    entry.draft = {
      ...entry.draft,
      serviceFenceAt: Date.now(),
      resolution:
        "expired-original-not-accepted-after-service-fence-and-authenticated-empty-pending-proof",
    };
  });
} finally {
  await lease.release();
}
// A fresh API reads the durable rejected reservation instead of an old cache.
process.stdout.write(
  JSON.stringify({
    network,
    run,
    originalTransaction: original.id,
    originalRequestRetained: true,
    serviceFenced: true,
    authenticatedPendingEmpty: true,
    recoveryNowPermitted: true,
  }) + '\n',
);
}
await main().catch(() => {
  process.stdout.write(JSON.stringify({complete:false,reason:"vault-protected-recovery-unavailable",originalRecordsRetained:true}) + "\n");
  process.exitCode = 1;
});
