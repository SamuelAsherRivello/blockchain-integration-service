import {
  arkade,
  ArkAddress,
  Wallet,
  MnemonicIdentity,
  RestArkProvider,
  RestIndexerProvider,
  RestEmulatorProvider,
  InMemoryWalletRepository,
  InMemoryContractRepository,
  Transaction,
  getNetwork,
  signAndSubmitOffchainTx,
} from "@arkade-os/sdk";
import { hex, base64 } from "@scure/base";
import { Vault } from "./test-wallets/vault.ts";
import { Operations } from "./test-wallets/operations.ts";
import { verifiedInventory } from "./test-wallets/inventory.ts";
import {
  inspectVaultCapability,
  VAULT_EMULATORS,
} from "../packages/integration/src/client/wallet-layer-arkade/conditional-vault-capability.ts";
import {
  compileConditionalVault,
  VAULT_PRINCIPAL,
  VAULT_PROGRAM_VERSION,
} from "../packages/integration/src/client/wallet-layer-arkade/conditional-vault-program.ts";
import { testNetwork } from "../packages/integration/src/client/state-layer-core/test-network.ts";
import { sendConditionalVaultSpend } from "../packages/integration/src/client/wallet-layer-arkade/conditional-vault-spend.ts";

// Funded compatibility proof, not the production UI acceptance runner. Persistent
// protected records are deliberately retained even if the process is interrupted.
const vault = new Vault();
const operations = new Operations(vault);
let stage = "arguments";
let wallet: Awaited<ReturnType<typeof Wallet.create>> | undefined;
try {
  const [network, accountLabel, runId, id] = process.argv.slice(2);
  if (
    process.argv.length !== 6 ||
    !["signet", "mutinynet"].includes(network) ||
    !/^[a-z][a-z0-9-]{0,30}$/.test(runId ?? "") ||
    !/^\d{4}$/.test(id ?? "")
  )
    throw Error("vault-run-invalid-arguments");
  const selected = network as "signet" | "mutinynet";
  stage = "authorization";
  const account = await vault.transaction(async (state) => {
    await verifiedInventory(state);
    const row = state.accounts.find(
      (account) => account.label === accountLabel,
    );
    if (
      !row?.grant?.active ||
      !row.grant.networks.includes(selected) ||
      row.reportedPending?.[selected]
    )
      throw Error("vault-run-account-unavailable");
    if (state.conditionalVaultRuns?.[runId])
      throw Error("vault-run-already-recorded-reconcile-required");
    return { ...row };
  });
  const identity = MnemonicIdentity.fromMnemonic(account.phrase, {
    isMainnet: false,
  });
  const creator = await identity.xOnlyPublicKey();
  stage = "capability";
  await inspectVaultCapability(selected, creator);
  const ark = new RestArkProvider(testNetwork(selected).operator);
  const indexer = new RestIndexerProvider(testNetwork(selected).operator);
  const emulator = new RestEmulatorProvider(VAULT_EMULATORS[selected].endpoint);
  let currentOperation = "";
  async function persistRecovery(kind: string, request: unknown) {
    if (!currentOperation) throw Error("vault-run-missing-operation");
    await vault.transaction((state) => {
      const run = state.conditionalVaultRuns[runId];
      if (run.profileId !== account.profileId || run.network !== selected)
        throw Error("vault-run-identity-changed");
      run.recovery ??= {};
      run.recovery[currentOperation] ??= [];
      run.recovery[currentOperation].push({ kind, request });
    });
  }
  const submit = ark.submitTx.bind(ark);
  ark.submitTx = async (...args) => {
    await persistRecovery("operator-submit", args);
    return submit(...args);
  };
  const finalize = ark.finalizeTx.bind(ark);
  ark.finalizeTx = async (...args) => {
    await persistRecovery("operator-finalize", args);
    return finalize(...args);
  };
  const emulate = emulator.submitTx.bind(emulator);
  emulator.submitTx = async (...args) => {
    await persistRecovery("emulator-submit", args);
    return emulate(...args);
  };
  stage = "wallet";
  wallet = await Wallet.create({
    identity,
    arkProvider: ark,
    indexerProvider: indexer,
    walletMode: "static",
    settlementConfig: false,
    storage: {
      walletRepository: new InMemoryWalletRepository(),
      contractRepository: new InMemoryContractRepository(),
    },
  });
  const address = await wallet.getAddress();
  const balance = await wallet.getBalance();
  if (balance.available < 1000) throw Error("vault-run-insufficient-funds");
  const info = await ark.getInfo();
  const parameters = {
    network: selected,
    id,
    creatorKey: hex.encode(creator),
    creatorDestination: hex.encode(ArkAddress.decode(address).vtxoTaprootKey),
    serverKey: info.signerPubkey.slice(2),
    emulatorKey: VAULT_EMULATORS[selected].key,
    deadline: Math.floor(Date.now() / 1000) + 120,
    exitDelaySeconds: Number(info.unilateralExitDelay),
  };
  const built = compileConditionalVault(parameters);
  const client = await arkade.Arkade.connect({
    arkade: ark,
    indexer,
    emulator,
    emulatorPubkey: `03${VAULT_EMULATORS[selected].key}`,
    identity,
    network: getNetwork(selected),
    contractManager: await wallet.getContractManager(),
  });
  const contracts = built.states.map((state) =>
    client.contract(state.program, state.args),
  );
  for (const [index, contract] of contracts.entries()) {
    if (hex.encode(contract.pkScript) !== built.states[index].pkScript)
      throw Error("vault-run-compilation-mismatch");
    await contract.register();
  }
  await vault.transaction((state) => {
    state.conditionalVaultRuns ??= {};
    if (state.conditionalVaultRuns[runId])
      throw Error("vault-run-already-recorded-reconcile-required");
    state.conditionalVaultRuns[runId] = {
      contractVersion: VAULT_PROGRAM_VERSION,
      network: selected,
      profileId: account.profileId,
      parameters,
      startedAt: Date.now(),
      receipts: [],
      recovery: {},
    };
  });
  async function verifyOutput(txid: string, script: string) {
    for (let attempt = 0; attempt < 15; attempt++) {
      const result = await indexer.getVirtualTxs([txid]);
      const tx = result.txs
        .map((raw) =>
          /^[0-9a-f]+$/i.test(raw)
            ? Transaction.fromRaw(hex.decode(raw))
            : Transaction.fromPSBT(base64.decode(raw)),
        )
        .find((tx) => tx.id === txid);
      if (tx) {
        const matches = Array.from(
          { length: tx.outputsLength },
          (_, index) => ({ index, ...tx.getOutput(index) }),
        ).filter(
          (out) =>
            out.amount === 1000n &&
            out.script &&
            hex.encode(out.script) === script,
        );
        if (matches.length !== 1)
          throw Error("vault-run-output-proof-mismatch");
        const outpoint = { txid, vout: matches[0].index, value: 1000 };
        const rows = await indexer.getVtxos({
          outpoints: [{ txid, vout: outpoint.vout }],
        });
        if (
          rows.vtxos.some(
            (coin) =>
              coin.txid === txid &&
              coin.vout === outpoint.vout &&
              coin.value === 1000 &&
              coin.script === script,
          )
        )
          return outpoint;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw Error("vault-run-network-proof-pending");
  }
  async function mutate(
    label: string,
    recipient: string,
    script: string,
    send: () => Promise<string>,
  ) {
    stage = label;
    currentOperation = `${runId}-${label}`;
    await operations.prepare({
      id: currentOperation,
      account: account.label,
      profileId: account.profileId,
      generation: account.generation,
      network: selected,
      kind: label === "claim" ? "claim" : "arkade-send",
      recipient,
      amountSats: 1000,
      feeSats: 0,
      sourceOrigin: null,
    });
    let safeError = "vault-run-submission-unknown";
    const pending = await operations.submit(currentOperation, async () => {
      try {
        return { providerId: await send() };
      } catch (error) {
        const text = error instanceof Error ? error.message : "";
        for (const [pattern, reason] of [
          [
            /script.*execution|execute arkade script|OP_EQUALVERIFY|OP_VERIFY/i,
            "vault-run-contract-rejected",
          ],
          [/opcode|compute.*limit/i, "vault-run-vm-incompatible"],
          [/prev.*tx|prevout|checkpoint/i, "vault-run-ancestry-rejected"],
          [/dust/i, "vault-run-dust-policy-rejected"],
          [/insufficient/i, "vault-run-insufficient-funds"],
          [/fee/i, "vault-run-policy-rejected"],
        ] as const)
          if (pattern.test(text)) {
            safeError = reason;
            break;
          }
        // Provider payload stays only in protected recovery, never public output.
        await persistRecovery("private-diagnostic", { message: text });
        throw error;
      }
    });
    if (!pending.providerId) throw Error(safeError);
    const outpoint = await verifyOutput(pending.providerId, script);
    await operations.reconcile(currentOperation, async (record) => ({
      id: record.intent.id,
      fingerprint: record.fingerprint,
      providerId: outpoint.txid,
      outcome: "settled",
      verified: true,
    }));
    await vault.transaction((state) =>
      state.conditionalVaultRuns[runId].receipts.push({
        operation: label,
        ...outpoint,
        script,
      }),
    );
    return outpoint;
  }
  async function fundExactTaproot() {
    // Wallet.send automatically uses an OP_RETURN carrier below the Bitcoin
    // dust threshold. A covenant requires an actual Taproot output, so ask the
    // operator for that exact output explicitly and verify its real response.
    const coins = (await wallet!.getSpendableVtxos()).filter(
      (coin) => !coin.assets?.length && coin.value >= 1330,
    );
    if (!coins.length) throw Error("vault-run-insufficient-funds");
    const coin = coins[0];
    return signAndSubmitOffchainTx({
      identity,
      provider: ark,
      inputs: [{ ...coin, tapLeafScript: coin.forfeitTapLeafScript }],
      outputs: [
        { script: contracts[0].pkScript, amount: 1000n },
        {
          script: ArkAddress.decode(address).pkScript,
          amount: BigInt(coin.value) - 1000n,
        },
      ],
      serverUnrollScript: client.checkpoint,
    });
  }
  let coin = await mutate(
    "create",
    contracts[0].address,
    built.states[0].pkScript,
    fundExactTaproot,
  );
  for (let progress = 0; progress < 3; progress++) {
    // Independent public client demonstrates permissionless Increment.
    const publicClient = await arkade.Arkade.connect({
      arkade: ark,
      indexer,
      emulator,
      emulatorPubkey: `03${VAULT_EMULATORS[selected].key}`,
      network: getNetwork(selected),
    });
    const publicContract = publicClient.contract(
      built.states[progress].program,
      built.states[progress].args,
    );
    coin = await mutate(
      `increment-${progress + 1}`,
      contracts[progress + 1].address,
      built.states[progress + 1].pkScript,
      async () =>
        (
          await sendConditionalVaultSpend(
            publicContract,
            emulator,
            "increment",
            coin,
            contracts[progress + 1].pkScript,
          )
        ).txid,
    );
  }
  const returned = await mutate(
    "claim",
    address,
    `5120${parameters.creatorDestination}`,
    async () =>
      (
        await sendConditionalVaultSpend(
          contracts[3],
          emulator,
          "claim",
          coin,
          hex.decode(`5120${parameters.creatorDestination}`),
          identity,
        )
      ).txid,
  );
  await vault.transaction((state) => {
    state.conditionalVaultRuns[runId].completedAt = Date.now();
  });
  process.stdout.write(
    JSON.stringify({
      runId,
      network: selected,
      sequence: "create-increment-increment-increment-claim",
      returnOutpoint: returned,
      compatibility: true,
      productionAcceptance: false,
    }) + "\n",
  );
} catch (error) {
  const reason =
    error instanceof Error &&
    /^(vault-run-[a-z-]+|vault-capability-[a-z-]+|operation-[a-z-]+|vault-[a-z-]+)$/.test(
      error.message,
    )
      ? error.message
      : "vault-run-unavailable";
  process.stdout.write(
    JSON.stringify({
      stage,
      reason,
      compatibility: false,
      productionAcceptance: false,
    }) + "\n",
  );
  process.exitCode = 1;
} finally {
  await wallet?.dispose();
}
