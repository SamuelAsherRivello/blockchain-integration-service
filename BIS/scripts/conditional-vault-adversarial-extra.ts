import { createHash } from "node:crypto";
import {
  arkade,
  RestArkProvider,
  RestIndexerProvider,
  RestEmulatorProvider,
  getNetwork,
} from "@arkade-os/sdk";
import { hex, base64 } from "@scure/base";
import { protectedConditionalVaultContext } from "./test-wallets/conditional-vault-context.ts";
import { compileConditionalVault } from "../packages/integration/src/client/wallet-layer-arkade/conditional-vault-program.ts";
import { compileVaultDescriptor } from "../packages/integration/src/client/wallet-layer-arkade/conditional-vault-descriptor.ts";
import { decodeVaultTransaction } from "../packages/integration/src/client/wallet-layer-arkade/conditional-vault-inspection.ts";
import {
  testNetwork,
  type TestNetwork,
} from "../packages/integration/src/client/state-layer-core/test-network.ts";
import { VAULT_EMULATORS } from "../packages/integration/src/client/wallet-layer-arkade/conditional-vault-capability.ts";
let stage = "arguments";
try {
  const [network, account, run] = process.argv.slice(2);
  if (
    process.argv.length !== 5 ||
    !["signet", "mutinynet"].includes(network) ||
    !/^cv-[a-z0-9-]{1,30}$/.test(run ?? "")
  )
    throw Error();
  const selected = network as TestNetwork,
    { api, vault } = protectedConditionalVaultContext(selected),
    operator = testNetwork(selected).operator;
  const ark = new RestArkProvider(operator),
    indexer = new RestIndexerProvider(operator),
    emulator = new RestEmulatorProvider(VAULT_EMULATORS[selected].endpoint);
  await vault.transaction((state) => {
    state.conditionalVaultAdversarialExtra ??= {};
    state.conditionalVaultAdversarialExtra[run] ??= {
      network,
      account,
      attempts: [],
      complete: false,
    };
  });
  async function rejection(
    name: string,
    request: [string, string[]],
    target: "operator" | "emulator",
  ) {
    stage = name;
    await vault.transaction((state) => {
      state.conditionalVaultAdversarialExtra[run].attempts.push({
        name,
        target,
        request,
        status: "prepared",
      });
    });
    let rejected = false;
    try {
      if (target === "operator") await ark.submitTx(...request);
      else await emulator.submitTx(...request);
    } catch (error) {
      rejected = true;
      await vault.transaction((state) => {
        const row = state.conditionalVaultAdversarialExtra[
          run
        ].attempts.findLast((a) => a.name === name);
        row.status = "rejected";
        row.privateError = String(error);
      });
    }
    if (!rejected) throw Error("vault-adversarial-spend-not-rejected");
    process.stdout.write(
      JSON.stringify({ network, run, case: name, rejected: true }) + "\n",
    );
  }
  // Replay the actually countersigned, already consumed happy-path transaction
  // directly at the operator. This does not depend on an expired CHECKTIME.
  const originalRun =
    selected === "signet" ? "cv-signet-canonical-a" : "cv-mutiny-canonical-e";
  const original = await vault.transaction(
    (state) => state.conditionalVaultAcceptance[originalRun].descriptor,
  );
  const complete = await api.check(original),
    last = complete.evidence.at(-1)!;
  if (complete.status !== "claimed")
    throw Error("vault-adversarial-original-receipt-unavailable");
  const archive = await indexer.getVirtualTxs([last.transactionId]);
  const signed = archive.txs
    .map(decodeVaultTransaction)
    .find((tx) => tx.id === last.transactionId)!;
  const ids = Array.from({ length: signed.inputsLength }, (_, i) =>
    hex.encode(signed.getInput(i).txid!),
  );
  const checkpoints = (await indexer.getVirtualTxs(ids)).txs.map(
    decodeVaultTransaction,
  );
  await rejection(
    "consumed-outpoint-replay",
    [
      base64.encode(signed.toPSBT()),
      checkpoints.map((tx) => base64.encode(tx.toPSBT())),
    ],
    "operator",
  );
  stage = "create";
  const id = selected === "signet" ? "9300" : "9310";
  const made = await api.create({
    network: selected,
    id,
    operationId: `${run}-create`,
    walletReference: account,
    durationSeconds: 120,
  });
  if (made.outcome !== "verified" || !made.inspection)
    throw Error("vault-adversarial-funding-unverified");
  const descriptor = made.inspection.descriptor,
    built = compileVaultDescriptor(descriptor);
  await vault.transaction((state) => {
    state.conditionalVaultAdversarialExtra[run].descriptor = descriptor;
  });
  const client = await arkade.Arkade.connect({
    arkade: ark,
    indexer,
    emulator,
    emulatorPubkey: `03${descriptor.emulatorPublicKey}`,
    network: getNetwork(selected),
  });
  const coin = {
    txid: descriptor.funding.transactionId,
    vout: descriptor.funding.outputIndex,
    value: 1000,
  };
  const forged = compileConditionalVault({
    ...built.parameters,
    deadline: descriptor.deadline + 3600,
  });
  const counterfeit = client.contract(
    forged.states[0].program,
    forged.states[0].args,
  );
  const changed = await counterfeit.functions
    .increment()
    .from(coin)
    .to(hex.decode(forged.states[1].pkScript), 1000n)
    .build();
  await rejection(
    "changed-immutable-deadline",
    [
      base64.encode(changed.arkTx.toPSBT()),
      changed.checkpoints.map((c) => base64.encode(c.toPSBT())),
    ],
    "emulator",
  );
  stage = "deadline";
  while (Date.now() < descriptor.deadline * 1000 + 1000)
    await new Promise((resolve) => setTimeout(resolve, 1000));
  const contract = client.contract(
    built.states[0].program,
    built.states[0].args,
  );
  const late = await contract.functions
    .increment()
    .from(coin)
    .to(hex.decode(descriptor.stateScripts[1]), 1000n)
    .build();
  await rejection(
    "late-direct-increment",
    [
      base64.encode(late.arkTx.toPSBT()),
      late.checkpoints.map((c) => base64.encode(c.toPSBT())),
    ],
    "emulator",
  );
  const theft = await contract.functions
    .recover()
    .from(coin)
    .to(hex.decode(descriptor.creatorDestination), 1000n)
    .build();
  const tag = createHash("sha256").update("TapLeaf").digest();
  for (const tx of [theft.arkTx, ...theft.checkpoints]) {
    const leaf = tx.getInput(0).tapLeafScript![0][1],
      body = leaf.slice(0, -1);
    if (body.length >= 253) throw Error("vault-adversarial-unexpected-leaf");
    const leafHash = createHash("sha256")
      .update(tag)
      .update(tag)
      .update(Uint8Array.from([leaf.at(-1)!, body.length]))
      .update(body)
      .digest();
    tx.updateInput(0, {
      tapScriptSig: [
        [
          { pubKey: hex.decode(descriptor.creatorPublicKey), leafHash },
          new Uint8Array(64),
        ],
      ],
    });
  }
  await rejection(
    "forged-creator-signature",
    [
      base64.encode(theft.arkTx.toPSBT()),
      theft.checkpoints.map((c) => base64.encode(c.toPSBT())),
    ],
    "emulator",
  );
  const before = await api.check(descriptor);
  if (
    before.status !== "expired" ||
    !before.activeOutput ||
    before.progress !== 0
  )
    throw Error("vault-adversarial-output-changed");
  stage = "refund";
  const refunded = await api.recover({
    operationId: `${run}-recover`,
    descriptor,
    expectedOutput: before.activeOutput,
    walletReference: account,
  });
  if (
    refunded.outcome !== "verified" ||
    refunded.inspection?.status !== "recovered"
  )
    throw Error("vault-adversarial-refund-unverified");
  await vault.transaction((state) => {
    state.conditionalVaultAdversarialExtra[run].complete = true;
    state.conditionalVaultAdversarialExtra[run].refund =
      refunded.inspection!.evidence.at(-1)!.transactionId;
  });
  process.stdout.write(
    JSON.stringify({
      network,
      run,
      complete: true,
      refund: refunded.inspection.evidence.at(-1)!.transactionId,
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
          : "vault-adversarial-unavailable",
    }) + "\n",
  );
  process.exitCode = 1;
}
