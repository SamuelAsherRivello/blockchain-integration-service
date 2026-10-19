import { protectedConditionalVaultContext } from "./test-wallets/conditional-vault-context.ts";
import { VAULT_PROGRAM_VERSION } from "../packages/integration/src/client/wallet-layer-arkade/conditional-vault-program.ts";

try {
  const [network, account, id, run] = process.argv.slice(2);
  if (
    process.argv.length !== 6 ||
    !["signet", "mutinynet"].includes(network) ||
    !/^\d{4}$/.test(id ?? "") ||
    !/^cv-[a-z0-9-]{1,35}$/.test(run ?? "")
  )
    throw Error("vault-acceptance-invalid-arguments");
  const { api, vault } = protectedConditionalVaultContext(
    network as "signet" | "mutinynet",
  );
  const created = await api.create({
    network: network as "signet" | "mutinynet",
    id,
    operationId: `${run}-create`,
    walletReference: account,
    durationSeconds: 120,
  });
  process.stdout.write(
    JSON.stringify({
      network,
      step: "create",
      outcome: created.outcome,
      status: created.inspection?.status,
      reason: created.reason,
    }) + "\n",
  );
  if (created.outcome !== "verified" || !created.inspection)
    throw Error("vault-acceptance-create-unverified");
  const descriptor = created.inspection.descriptor;
  await vault.transaction((state) => {
    state.conditionalVaultAcceptance ??= {};
    state.conditionalVaultAcceptance[run] = {
      network,
      account,
      version: VAULT_PROGRAM_VERSION,
      descriptor,
      steps: [{ step: "create", outcome: created.outcome }],
      complete: false,
    };
  });
  for (let progress = 0; progress < 3; progress++) {
    const checked = await api.check(descriptor);
    if (
      checked.status !== "locked" ||
      checked.progress !== progress ||
      !checked.activeOutput
    )
      throw Error("vault-acceptance-public-check-mismatch");
    const result = await api.increment({
      operationId: `${run}-increment-${progress + 1}`,
      descriptor,
      expectedOutput: checked.activeOutput,
    });
    process.stdout.write(
      JSON.stringify({
        network,
        step: `increment-${progress + 1}`,
        outcome: result.outcome,
        status: result.inspection?.status,
        reason: result.reason,
      }) + "\n",
    );
    await vault.transaction((state) =>
      state.conditionalVaultAcceptance[run].steps.push({
        step: `increment-${progress + 1}`,
        outcome: result.outcome,
        reason: result.reason,
      }),
    );
    if (result.outcome !== "verified")
      throw Error("vault-acceptance-increment-unverified");
  }
  const checked = await api.check(descriptor);
  if (
    checked.status !== "claimable" ||
    checked.progress !== 3 ||
    !checked.activeOutput
  )
    throw Error("vault-acceptance-terminal-check-mismatch");
  const claimed = await api.claim({
    operationId: `${run}-claim`,
    descriptor,
    expectedOutput: checked.activeOutput,
    walletReference: account,
  });
  process.stdout.write(
    JSON.stringify({
      network,
      step: "claim",
      outcome: claimed.outcome,
      status: claimed.inspection?.status,
      reason: claimed.reason,
    }) + "\n",
  );
  if (
    claimed.outcome !== "verified" ||
    claimed.inspection?.status !== "claimed"
  )
    throw Error("vault-acceptance-claim-unverified");
  const final = await api.check(descriptor);
  if (final.status !== "claimed")
    throw Error("vault-acceptance-final-reconciliation-unverified");
  await vault.transaction((state) => {
    state.conditionalVaultAcceptance[run].complete = true;
    state.conditionalVaultAcceptance[run].transactions = [
      descriptor.funding.transactionId,
      ...final.evidence.map((e) => e.transactionId),
    ];
  });
  process.stdout.write(
    JSON.stringify({
      network,
      run,
      sequenceVerified: true,
      transactions: [
        descriptor.funding.transactionId,
        ...final.evidence.map((e) => e.transactionId),
      ],
      negativeMatrixComplete: false,
    }) + "\n",
  );
} catch (error) {
  const reason =
    error instanceof Error &&
    /^(vault-acceptance-[a-z-]+|vault-[a-z-]+)$/.test(error.message)
      ? error.message
      : "vault-acceptance-unavailable";
  process.stdout.write(
    JSON.stringify({ sequenceVerified: false, reason }) + "\n",
  );
  process.exitCode = 1;
}
