import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  protectedConditionalVaultContext,
  exitAfterProtectedStoreIdle,
} from "./test-wallets/conditional-vault-context.ts";
import { VAULT_EMULATORS } from "../packages/integration/src/client/wallet-layer-arkade/conditional-vault-capability.ts";
import type { TestNetwork } from "../packages/integration/src/client/state-layer-core/test-network.ts";

const [network, account, run, childPhase] = process.argv.slice(2);
if (
  ![5, 6].includes(process.argv.length) ||
  !["signet", "mutinynet"].includes(network) ||
  !/^cv-[a-z0-9-]{1,30}$/.test(run ?? "")
)
  throw Error("vault-mutation-interruption-arguments");
const selected = network as TestNetwork;
const publicReport = (json: string) => process.stdout.write(json + "\n");
let stage = childPhase ?? "create";
try {
  const initial = protectedConditionalVaultContext(selected);
  if (childPhase === "recover-existing") {
    const saved = await initial.vault.transaction(
      (state) => state.conditionalVaultMutationInterruptions[run],
    );
    const original = await initial.journal.transaction((entries) =>
      entries.find((entry) => entry.operationId === saved.request.operationId),
    );
    if (original) await initial.api[saved.operation](saved.request);
    else if (saved.operation !== 'claim') throw Error("vault-mutation-original-request-required");
    const checked = await initial.api.check(saved.descriptor);
    if (checked.status !== "expired" || !checked.activeOutput)
      throw Error("vault-mutation-expired-output-required");
    const result = await initial.api.recover({
      descriptor: saved.descriptor,
      expectedOutput: checked.activeOutput,
      operationId: `${run}-refund`,
      walletReference: account,
    });
    if (
      result.outcome !== "verified" ||
      result.inspection?.status !== "recovered"
    )
      throw Error("vault-mutation-refund-unverified");
    await initial.vault.transaction((state) => {
      state.conditionalVaultMutationInterruptions[run].cleanup = {
        status: "recovered",
        transactions: result.inspection!.evidence.map((e) => e.transactionId),
      };
    });
    publicReport(
      JSON.stringify({
        network,
        run,
        existingFixtureRefunded: true,
        transaction: result.inspection.evidence.at(-1)!.transactionId,
      }),
    );
    await exitAfterProtectedStoreIdle(0);
  }
  if (childPhase) {
    const saved = await initial.vault.transaction(
      (state) => state.conditionalVaultMutationInterruptions[run],
    );
    const context = protectedConditionalVaultContext(
      selected,
      childPhase === "before-submit"
        ? { operationId: saved.request.operationId, phase: "submitting" }
        : undefined,
    );
    if (childPhase === "after-response") {
      const fetchOriginal = globalThis.fetch;
      globalThis.fetch = async (...args) => {
        const response = await fetchOriginal(...args);
        if (
          response.ok &&
          String(args[0]) === `${VAULT_EMULATORS[selected].endpoint}/v1/tx`
        ) {
          await initial.vault.transaction((state) => {
            state.conditionalVaultMutationInterruptions[run].faultObserved =
              "http-response-before-caller";
          });
          await exitAfterProtectedStoreIdle(75);
        }
        return response;
      };
    }
    const result = await context.api[saved.operation](saved.request);
    if (childPhase === "after-response" && result.outcome === "verified") {
      // Independent receipts can precede a delayed final HTTP response. Crash
      // before publishing that financial result, rather than waiting forever.
      await initial.vault.transaction((state) => {
        state.conditionalVaultMutationInterruptions[run].faultObserved =
          "verified-receipt-before-caller";
      });
      await exitAfterProtectedStoreIdle(75);
    }
    throw Error("vault-mutation-interruption-failpoint-not-reached");
  }
  const { api, vault } = initial;
  await vault.transaction((state) => {
    state.conditionalVaultMutationInterruptions ??= {};
    state.conditionalVaultMutationInterruptions[run] ??= {
      network,
      account,
      cases: [],
      complete: false,
    };
    if (state.conditionalVaultMutationInterruptions[run].complete)
      throw Error("vault-mutation-original-run-complete");
  });
  let descriptor = await vault.transaction(
    (state) => state.conditionalVaultMutationInterruptions[run].descriptor,
  );
  if (!descriptor) {
    const suffix = run.charCodeAt(run.length - 1) - 97;
    if (suffix < 0 || suffix > 9)
      throw Error("vault-mutation-run-suffix-invalid");
    const created = await api.create({
      network: selected,
      id: String((selected === "signet" ? 9500 : 9510) + suffix),
      operationId: `${run}-create`,
      walletReference: account,
      durationSeconds: 120,
    });
    if (created.outcome !== "verified" || !created.inspection)
      throw Error("vault-mutation-funding-unverified");
    descriptor = created.inspection.descriptor;
    await vault.transaction((state) => {
      state.conditionalVaultMutationInterruptions[run].descriptor = descriptor;
    });
  }
  let checked = await api.check(descriptor);
  for (const [index, operation, phase] of [
    [0, "increment", run.endsWith('-b') || run.includes('-claim-') ? 'no-fault' : "before-submit"],
    [1, "increment", run.endsWith('-b') || run.includes('-claim-') ? 'no-fault' : "after-response"],
    [2, "increment", "no-fault"],
    [3, "claim", "after-response"],
  ] as const) {
    stage = `${operation}-${index}`;
    const done = await vault.transaction((state) =>
      state.conditionalVaultMutationInterruptions[run].cases.some(
        (entry) => entry.index === index,
      ),
    );
    if (done) continue;
    const original = await initial.journal.transaction((entries) =>
      entries.find(
        (entry) => entry.operationId === `${run}-${operation}-${index}`,
      ),
    );
    if (!original && (!checked.activeOutput || checked.progress !== index))
      throw Error("vault-mutation-original-state-unverified");
    const request = {
      descriptor,
      operationId: `${run}-${operation}-${index}`,
      expectedOutput: original?.expectedInput ?? checked.activeOutput!,
      ...(operation === "claim" ? { walletReference: account } : {}),
    };
    await vault.transaction((state) => {
      Object.assign(state.conditionalVaultMutationInterruptions[run], {
        operation,
        request,
      });
    });
    if (!original && phase !== 'no-fault') {
      const code = await new Promise<number | null>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          [fileURLToPath(import.meta.url), network, account, run, phase],
          { windowsHide: true, stdio: ["ignore", "ignore", "ignore"] },
        );
        const timer = setTimeout(() => {
          child.kill();
          reject(Error("vault-mutation-child-timeout"));
        }, 60000);
        child.on("error", reject);
        child.on("close", (code) => {
          clearTimeout(timer);
          resolve(code);
        });
      });
      if (code !== 75) throw Error("vault-mutation-child-exit-unverified");
    }
    // The same ID/outpoint must recover, not construct another transition.
    const result =
      operation === "claim"
        ? await api.claim({ ...request, walletReference: account })
        : await api.increment(request);
    if (result.outcome !== "verified" || !result.inspection)
      throw Error("vault-mutation-replay-unverified");
    const expected =
      operation === "claim" ? "claimed" : index === 2 ? "claimable" : "locked";
    if (
      (result.inspection.status !== expected && !(operation === 'increment' && result.inspection.status === 'expired')) ||
      result.inspection.progress !== Math.min(index + 1, 3)
    )
      throw Error("vault-mutation-receipt-unverified");
    checked = result.inspection;
    await vault.transaction((state) => {
      state.conditionalVaultMutationInterruptions[run].cases.push({
        index,
        operation,
        phase,
        faultObserved:
          state.conditionalVaultMutationInterruptions[run].faultObserved,
        verified: true,
        transactions: result.inspection!.evidence.map((e) => e.transactionId),
      });
    });
    publicReport(
      JSON.stringify({
        network,
        run,
        operation,
        phase,
        originalOutcomeVerified: true,
      }),
    );
  }
  const final = await api.check(descriptor);
  if (final.status !== "claimed")
    throw Error("vault-mutation-final-receipt-unverified");
  await vault.transaction((state) => {
    state.conditionalVaultMutationInterruptions[run].complete = true;
  });
  publicReport(
    JSON.stringify({
      network,
      run,
      complete: true,
      creatorReceiptVerified: true,
      transactions: final.evidence.map((e) => e.transactionId),
    }),
  );
} catch (error) {
  publicReport(
    JSON.stringify({
      network,
      run,
      stage,
      complete: false,
      reason:
        error instanceof Error && /^vault-[a-z-]+$/.test(error.message)
          ? error.message
          : "vault-mutation-interruption-unavailable",
    }),
  );
  process.exitCode = 1;
}
