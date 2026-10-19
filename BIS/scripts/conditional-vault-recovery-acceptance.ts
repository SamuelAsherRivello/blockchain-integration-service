import {
  arkade,
  RestArkProvider,
  RestIndexerProvider,
  RestEmulatorProvider,
  getNetwork,
} from "@arkade-os/sdk";
import { hex, base64 } from "@scure/base";
import { protectedConditionalVaultContext } from "./test-wallets/conditional-vault-context.ts";
import {
  compileVaultDescriptor,
  exportVaultDescriptor,
  importVaultDescriptor,
} from "../packages/integration/src/client/wallet-layer-arkade/conditional-vault-descriptor.ts";
import { VAULT_EMULATORS } from "../packages/integration/src/client/wallet-layer-arkade/conditional-vault-capability.ts";
import {
  testNetwork,
  type TestNetwork,
} from "../packages/integration/src/client/state-layer-core/test-network.ts";

try {
  const [network, account, run] = process.argv.slice(2);
  if (
    process.argv.length !== 5 ||
    !["signet", "mutinynet"].includes(network) ||
    !/^cv-[a-z0-9-]{1,28}$/.test(run ?? "")
  )
    throw Error("vault-recovery-arguments");
  const selected = network as TestNetwork,
    context = protectedConditionalVaultContext(selected),
    { api, vault } = context;
  const operator = testNetwork(selected).operator;
  const log = (step: string, details: object) =>
    process.stdout.write(
      JSON.stringify({ network, run, step, ...details }) + "\n",
    );
  async function invalidSpend(
    descriptor: any,
    name: string,
    destination: string,
    amount = 1000n,
    extra = false,
    omitEmulator = false,
  ) {
    const ark = new RestArkProvider(operator),
      emulator = new RestEmulatorProvider(VAULT_EMULATORS[selected].endpoint);
    const client = await arkade.Arkade.connect({
      arkade: ark,
      indexer: new RestIndexerProvider(operator),
      emulator,
      emulatorPubkey: `03${descriptor.emulatorPublicKey}`,
      network: getNetwork(selected),
    });
    const built = compileVaultDescriptor(descriptor),
      checked = await api.check(descriptor);
    if (checked.progress !== 0 || !checked.activeOutput)
      throw Error("vault-recovery-invalid-fixture-state");
    const contract = client.contract(
      built.states[0].program,
      built.states[0].args,
    );
    const { arkTx, checkpoints } = await contract.functions
      .increment()
      .from({ txid: checked.activeOutput.transactionId, vout: 0, value: 1000 })
      .to(hex.decode(destination), 1000n)
      .build();
    if (amount !== 1000n) arkTx.updateOutput(0, { amount });
    if (extra)
      arkTx.addOutput({
        script: hex.decode(descriptor.creatorDestination),
        amount: 0n,
      });
    const request = [
      base64.encode(arkTx.toPSBT()),
      checkpoints.map((c) => base64.encode(c.toPSBT())),
    ] as [string, string[]];
    await vault.transaction((state) => {
      state.conditionalVaultRecoveryAcceptance[run].attempts.push({
        name,
        request,
        transactionId: arkTx.id,
        status: "prepared",
      });
    });
    let rejected = false;
    try {
      if (omitEmulator) await ark.submitTx(...request);
      else await emulator.submitTx(...request);
    } catch (error) {
      rejected = true;
      await vault.transaction((state) => {
        const attempt = state.conditionalVaultRecoveryAcceptance[
          run
        ].attempts.findLast((a) => a.name === name);
        attempt.status = "rejected";
        attempt.privateError = String(error);
      });
    }
    const after = await api.check(descriptor);
    if (
      !rejected ||
      after.progress !== 0 ||
      after.activeOutput?.transactionId !== checked.activeOutput.transactionId
    )
      throw Error("vault-recovery-invalid-spend-not-rejected");
    log(name, { rejected: true, originalOutputUnspent: true });
  }
  await vault.transaction((state) => {
    state.conditionalVaultRecoveryAcceptance ??= {};
    state.conditionalVaultRecoveryAcceptance[run] ??= {
      network,
      account,
      states: {},
      attempts: [],
      complete: false,
    };
  });
  for (let target = 0; target <= 3; target++) {
    const id = String(9200 + target + (selected === "mutinynet" ? 10 : 0));
    const operationId = `${run}-${target}-create`;
    const created = await api.create({
      operationId,
      network: selected,
      id,
      walletReference: account,
      durationSeconds: 120,
    });
    if (created.outcome !== "verified" || !created.inspection)
      throw Error("vault-recovery-create-unverified");
    const descriptor = created.inspection.descriptor;
    await vault.transaction((state) => {
      state.conditionalVaultRecoveryAcceptance[run].states[target] ??= {
        descriptor,
        progress: 0,
        complete: false,
      };
    });
    log("funded", { target, id, funding: descriptor.funding.transactionId });
    const restored = await importVaultDescriptor(
      await exportVaultDescriptor(descriptor),
    );
    if (
      (await protectedConditionalVaultContext(selected).api.check(restored))
        .progress !== 0
    )
      throw Error("vault-recovery-public-restore-failed");
    if (target === 0) {
      await invalidSpend(descriptor, "skip-state", descriptor.stateScripts[2]);
      await invalidSpend(
        descriptor,
        "steal-destination",
        descriptor.creatorDestination,
      );
      await invalidSpend(
        descriptor,
        "reduce-principal",
        descriptor.stateScripts[1],
        999n,
      );
      await invalidSpend(
        descriptor,
        "extra-output",
        descriptor.stateScripts[1],
        1000n,
        true,
      );
      await invalidSpend(
        descriptor,
        "omit-emulator",
        descriptor.stateScripts[1],
        1000n,
        false,
        true,
      );
      const duplicate = await api
        .create({
          operationId: `${run}-duplicate`,
          network: selected,
          id,
          walletReference: account,
          durationSeconds: 120,
        })
        .then(
          () => false,
          (error) => error.message === `VaultID ${id} is already taken.`,
        );
      if (!duplicate) throw Error("vault-recovery-duplicate-not-rejected");
      log("duplicate-create", { rejected: true });
    }
    for (let progress = 0; progress < target; progress++) {
      const before = await api.check(descriptor);
      if (before.progress !== progress || !before.activeOutput)
        throw Error("vault-recovery-state-unavailable");
      const request = {
        operationId: `${run}-${target}-increment-${progress}`,
        descriptor,
        expectedOutput: before.activeOutput,
      };
      const result = await api.increment(request);
      if (result.outcome !== "verified")
        throw Error("vault-recovery-increment-unverified");
      const repeated = await api.increment(request);
      if (
        repeated.outcome !== "verified" ||
        repeated.inspection?.progress !== progress + 1
      )
        throw Error("vault-recovery-increment-replay-failed");
      log("advanced", { target, progress: progress + 1 });
    }
    log("waiting-for-immutable-deadline", {
      target,
      deadline: descriptor.deadline,
    });
    while (Date.now() < descriptor.deadline * 1000 + 1000)
      await new Promise((resolve) =>
        setTimeout(
          resolve,
          Math.min(1000, descriptor.deadline * 1000 + 1000 - Date.now()),
        ),
      );
    const expired = await api.check(descriptor);
    if (
      expired.status !== "expired" ||
      expired.progress !== target ||
      !expired.activeOutput
    )
      throw Error("vault-recovery-expiry-not-observed");
    const late = await api.claim({
      operationId: `${run}-${target}-late-claim`,
      descriptor,
      expectedOutput: expired.activeOutput,
      walletReference: account,
    });
    if (late.outcome !== "rejected")
      throw Error("vault-recovery-late-claim-not-rejected");
    const request = {
      operationId: `${run}-${target}-recover`,
      descriptor,
      expectedOutput: expired.activeOutput,
      walletReference: account,
    };
    const recovered = await api.recover(request);
    if (
      recovered.outcome !== "verified" ||
      recovered.inspection?.status !== "recovered"
    )
      throw Error("vault-recovery-refund-unverified");
    if ((await api.recover(request)).outcome !== "verified")
      throw Error("vault-recovery-replay-unverified");
    await vault.transaction((state) => {
      Object.assign(
        state.conditionalVaultRecoveryAcceptance[run].states[target],
        {
          complete: true,
          transactions: recovered.inspection!.evidence.map(
            (e) => e.transactionId,
          ),
        },
      );
    });
    log("recovered", {
      target,
      transactions: recovered.inspection.evidence.map((e) => e.transactionId),
      principalSats: 1000,
    });
  }
  await vault.transaction((state) => {
    state.conditionalVaultRecoveryAcceptance[run].complete = true;
  });
  log("complete", { verified: true });
} catch (error) {
  process.stdout.write(
    JSON.stringify({
      verified: false,
      reason:
        error instanceof Error && /^vault-[a-z-]+$/.test(error.message)
          ? error.message
          : "vault-recovery-acceptance-unavailable",
    }) + "\n",
  );
  process.exitCode = 1;
}
