import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  protectedConditionalVaultContext,
  exitAfterProtectedStoreIdle,
} from "./test-wallets/conditional-vault-context.ts";
import type { TestNetwork } from "../packages/integration/src/client/state-layer-core/test-network.ts";
let stage = "arguments";
try {
  const [network, account, run, childStage] = process.argv.slice(2);
  if (
    ![5, 6].includes(process.argv.length) ||
    !["signet", "mutinynet"].includes(network) ||
    !/^cv-[a-z0-9-]{1,26}$/.test(run ?? "")
  )
    throw Error("vault-interruption-invalid-arguments");
  const selected = network as TestNetwork;
  const stages = [
    "prepared",
    "before-submit",
    "after-submit",
    "after-finalize",
  ];
  const base = selected === "signet" ? 9400 : 9410;
  if (childStage) {
    const index = stages.indexOf(childStage);
    if (index < 0) throw Error();
    const operationId = `${run}-${childStage}`;
    const context = protectedConditionalVaultContext(
      selected,
      index < 2
        ? { operationId, phase: index === 0 ? "prepared" : "submitting" }
        : undefined,
    );
    if (index >= 2) {
      const original = globalThis.fetch;
      globalThis.fetch = async (...args) => {
        const response = await original(...args);
        const url = String(args[0]);
        if (
          response.ok &&
          url.endsWith(index === 2 ? "/v1/tx/submit" : "/v1/tx/finalize")
        )
          await exitAfterProtectedStoreIdle(75);
        return response;
      };
    }
    await context.api.create({
      network: selected,
      id: String(base + index),
      operationId,
      walletReference: account,
      durationSeconds: 120,
    });
    throw Error("vault-interruption-failpoint-not-reached");
  }
  const { api, vault } = protectedConditionalVaultContext(selected);
  await vault.transaction((state) => {
    state.conditionalVaultInterruptionAcceptance ??= {};
    state.conditionalVaultInterruptionAcceptance[run] ??= {
      network,
      account,
      cases: {},
      complete: false,
    };
  });
  for (const [index, name] of stages.entries()) {
    stage = name;
    const prior = await vault.transaction(
      (state) => state.conditionalVaultInterruptionAcceptance[run].cases[name],
    );
    if (prior?.verified) continue;
    const record = await vault.transaction((state) =>
      state.conditionalVaultApiJournals?.[selected]?.find(
        (entry) => entry.operationId === `${run}-${name}`,
      ),
    );
    if (!record) {
      const exit = await new Promise<number | null>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          [fileURLToPath(import.meta.url), selected, account, run, name],
          { windowsHide: true, stdio: ["ignore", "ignore", "ignore"] },
        );
        const timer = setTimeout(() => {
          child.kill();
          reject(Error("vault-interruption-child-timeout"));
        }, 90000);
        child.on("error", reject);
        child.on("close", (code) => {
          clearTimeout(timer);
          resolve(code);
        });
      });
      if (exit !== 75) throw Error("vault-interruption-child-unverified");
    }
    const result = await api.create({
      network: selected,
      id: String(base + index),
      operationId: `${run}-${name}`,
      walletReference: account,
      durationSeconds: 120,
    });
    if (index === 0) {
      if (result.outcome !== "rejected")
        throw Error("vault-interruption-preparation-unverified");
      await vault.transaction((state) => {
        state.conditionalVaultInterruptionAcceptance[run].cases[name] = {
          verified: true,
          outcome: "never-submitted",
        };
      });
      process.stdout.write(
        JSON.stringify({
          network,
          run,
          stage: name,
          verified: true,
          financialSubmission: false,
        }) + "\n",
      );
      continue;
    }
    if (result.outcome !== "verified" || !result.inspection)
      throw Error("vault-interruption-reconciliation-unverified");
    const descriptor = result.inspection.descriptor;
    await vault.transaction((state) => {
      state.conditionalVaultInterruptionAcceptance[run].cases[name] = {
        verified: true,
        descriptor,
        funding: descriptor.funding.transactionId,
      };
    });
    process.stdout.write(
      JSON.stringify({
        network,
        run,
        stage: name,
        verified: true,
        originalFunding: descriptor.funding.transactionId,
      }) + "\n",
    );
  }
  stage = "refunds";
  const cases = await vault.transaction(
    (state) => state.conditionalVaultInterruptionAcceptance[run].cases,
  );
  for (const [name, record] of Object.entries(cases) as Array<[string, any]>) {
    if (!record.descriptor || record.refund) continue;
    const descriptor = record.descriptor;
    while (Date.now() < descriptor.deadline * 1000 + 1000)
      await new Promise((resolve) => setTimeout(resolve, 1000));
    const current = await api.check(descriptor);
    if (current.status !== "expired" || !current.activeOutput)
      throw Error("vault-interruption-original-output-unresolved");
    const recovered = await api.recover({
      operationId: `${run}-${name}-refund`,
      descriptor,
      expectedOutput: current.activeOutput,
      walletReference: account,
    });
    if (
      recovered.outcome !== "verified" ||
      recovered.inspection?.status !== "recovered"
    )
      throw Error("vault-interruption-refund-unverified");
    await vault.transaction((state) => {
      state.conditionalVaultInterruptionAcceptance[run].cases[name].refund =
        recovered.inspection!.evidence.at(-1)!.transactionId;
    });
  }
  await vault.transaction((state) => {
    state.conditionalVaultInterruptionAcceptance[run].complete = true;
  });
  process.stdout.write(
    JSON.stringify({
      network,
      run,
      complete: true,
      allFixturesRefunded: true,
    }) + "\n",
  );
} catch (error) {
  process.stdout.write(
    JSON.stringify({
      stage,
      complete: false,
      reason:
        error instanceof Error && /^vault-[a-z-]+$/.test(error.message)
          ? error.message
          : "vault-interruption-unavailable",
    }) + "\n",
  );
  process.exitCode = 1;
}
