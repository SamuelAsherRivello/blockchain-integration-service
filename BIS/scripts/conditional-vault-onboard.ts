import {
  Wallet,
  ReadonlyWallet,
  MnemonicIdentity,
  RestArkProvider,
  RestIndexerProvider,
  InMemoryWalletRepository,
  InMemoryContractRepository,
  CSVMultisigTapscript,
  hasBoardingTxExpired,
  Transaction,
} from "@arkade-os/sdk";
import { hex } from "@scure/base";
import { Vault } from "./test-wallets/vault.ts";
import { verifiedInventory } from "./test-wallets/inventory.ts";
import { testNetwork } from "../packages/integration/src/client/state-layer-core/test-network.ts";
import { inspectWalletNetworkPolicy } from "../packages/integration/src/client/state-layer-core/wallet-network-policy.ts";
import { protectedConditionalVaultContext } from "./test-wallets/conditional-vault-context.ts";

let wallet: Awaited<ReturnType<typeof Wallet.create>> | undefined;
let receiver: Awaited<ReturnType<typeof ReadonlyWallet.create>> | undefined;
let stage = "arguments";
try {
  const [sourceLabel, targetLabel, network, id] = process.argv.slice(2);
  if (
    process.argv.length !== 6 ||
    !["signet", "mutinynet"].includes(network) ||
    !/^[a-z][a-z0-9-]{0,40}$/.test(id ?? "")
  )
    throw Error("vault-onboard-invalid-arguments");
  const selected = network as "signet" | "mutinynet";
  const { vault } = protectedConditionalVaultContext(selected);
  stage = "authorization";
  const { source, target } = await vault.transaction(async (state) => {
    await verifiedInventory(state);
    const source = state.accounts.find((a) => a.label === sourceLabel),
      target = state.accounts.find((a) => a.label === targetLabel);
    if (
      !source?.grant?.active ||
      !target?.grant?.active ||
      !source.grant.networks.includes(selected) ||
      !target.grant.networks.includes(selected)
    )
      throw Error("vault-onboard-not-authorized");
    const prior = state.conditionalVaultOnboarding?.[id];
    if (prior && (prior.status !== "prepared" || prior.requests.length))
      throw Error("vault-onboard-original-operation-must-be-reconciled");
    if (
      (state.operations ?? []).some(
        (r) =>
          r.intent.profileId === source.profileId &&
          r.intent.network === selected &&
          !["settled", "failed", "cancelled"].includes(r.state),
      )
    )
      throw Error("vault-onboard-source-reserved");
    return { source: { ...source }, target: { ...target } };
  });
  const ark = new RestArkProvider(testNetwork(selected).operator),
    indexer = new RestIndexerProvider(testNetwork(selected).operator);
  const info = await ark.getInfo();
  if (inspectWalletNetworkPolicy(selected, info).reason !== "supported")
    throw Error("vault-onboard-policy-unavailable");
  const storage = () => ({
    walletRepository: new InMemoryWalletRepository(),
    contractRepository: new InMemoryContractRepository(),
  });
  stage = "wallet";
  wallet = await Wallet.create({
    identity: MnemonicIdentity.fromMnemonic(source.phrase, {
      isMainnet: false,
    }),
    arkProvider: ark,
    indexerProvider: indexer,
    settlementConfig: false,
    storage: storage(),
    walletMode: "static",
  });
  receiver = await ReadonlyWallet.create({
    identity: await MnemonicIdentity.fromMnemonic(target.phrase, {
      isMainnet: false,
    }).toReadonly(),
    arkServerUrl: testNetwork(selected).operator,
    settlementConfig: false,
    storage: storage(),
  });
  const address = await receiver.getAddress();
  const tip = await wallet.onchainProvider.getChainTip();
  const exit = CSVMultisigTapscript.decode(
    hex.decode(wallet.boardingTapscript.exitScript),
  );
  // A historical hold is never cleared. Only deposits confirmed after that hold
  // are eligible for this independent, explicitly input-scoped funding operation.
  const cutoff = source.reportedPending?.[selected]
    ? Date.parse(source.reportedPending[selected].reportedAt) / 1000
    : 0;
  const inputs = (await wallet.getBoardingUtxos()).filter(
    (c) =>
      c.status.confirmed &&
      (c.status.block_time ?? 0) > cutoff &&
      !hasBoardingTxExpired(c, exit.params.timelock, tip.height),
  );
  if (!inputs.length)
    throw Error("vault-onboard-no-independent-spendable-bitcoin");
  const amount = inputs.reduce((sum, c) => sum + c.value, 0);
  if (amount < 1000) throw Error("vault-onboard-insufficient-funds");
  await vault.transaction((state) => {
    state.conditionalVaultOnboarding ??= {};
    const prior = state.conditionalVaultOnboarding[id];
    if (prior) {
      if (
        prior.status !== "prepared" ||
        prior.requests.length ||
        prior.address !== address ||
        prior.amount !== amount ||
        JSON.stringify(prior.inputs) !==
          JSON.stringify(
            inputs.map(({ txid, vout, value }) => ({ txid, vout, value })),
          )
      )
        throw Error("vault-onboard-original-operation-must-be-reconciled");
      return;
    }
    const keys = new Set(inputs.map((c) => `${c.txid}:${c.vout}`));
    if (
      Object.values(state.conditionalVaultOnboarding).some(
        (r: any) =>
          r.network === selected &&
          !["verified", "cancelled"].includes(r.status) &&
          r.inputs.some((c) => keys.has(`${c.txid}:${c.vout}`)),
      )
    )
      throw Error("vault-onboard-input-reserved");
    state.conditionalVaultOnboarding[id] = {
      source: source.profileId,
      target: target.profileId,
      network: selected,
      address,
      amount,
      inputs: inputs.map(({ txid, vout, value }) => ({ txid, vout, value })),
      status: "prepared",
      requests: [],
      createdAt: Date.now(),
    };
  });
  async function record(kind: string, args: unknown) {
    await vault.transaction((state) => {
      const r = state.conditionalVaultOnboarding[id];
      r.status = "pending";
      r.requests.push({ kind, args });
    });
  }
  const register = ark.registerIntent.bind(ark);
  ark.registerIntent = async (intent) => {
    stage = "registration";
    await record("register", intent);
    let intentId: string;
    try {
      intentId = await register(intent);
    } catch (error) {
      await vault.transaction((state) => {
        state.conditionalVaultOnboarding[id].registrationError = String(error);
      });
      throw error;
    }
    await vault.transaction((state) => {
      state.conditionalVaultOnboarding[id].intentId = intentId;
    });
    return intentId;
  };
  const nonces = ark.submitTreeNonces.bind(ark);
  ark.submitTreeNonces = async (...args) => {
    stage = "nonces";
    await record("nonces", args);
    return nonces(...args);
  };
  const signatures = ark.submitTreeSignatures.bind(ark);
  ark.submitTreeSignatures = async (...args) => {
    stage = "signing";
    await record("signatures", args);
    return signatures(...args);
  };
  const forfeits = ark.submitSignedForfeitTxs.bind(ark);
  ark.submitSignedForfeitTxs = async (...args) => {
    await record("forfeits", args);
    return forfeits(...args);
  };
  ark.deleteIntent = async () => {
    throw Error("vault-onboard-automatic-intent-deletion-disabled");
  };
  stage = "settlement";
  const commitment = await wallet.settle({
    inputs,
    outputs: [{ address, amount: BigInt(amount) }],
  });
  stage = "evidence";
  const raw = await wallet.onchainProvider.getRawTransaction(commitment);
  const transaction = Transaction.fromRaw(raw);
  if (
    !inputs.every((coin) =>
      Array.from({ length: transaction.inputsLength }, (_, i) =>
        transaction.getInput(i),
      ).some(
        (i) =>
          i.txid && hex.encode(i.txid) === coin.txid && i.index === coin.vout,
      ),
    )
  )
    throw Error("vault-onboard-commitment-input-mismatch");
  const coins = await receiver.getSpendableVtxos({
    withRecoverable: false,
    withUnrolled: false,
  });
  const receipts = coins.filter(
    (c) => c.commitmentTxIds?.includes(commitment) && !c.assets?.length,
  );
  if (receipts.reduce((sum, c) => sum + c.value, 0) !== amount)
    throw Error("vault-onboard-recipient-receipt-pending");
  await vault.transaction((state) => {
    const r = state.conditionalVaultOnboarding[id];
    r.status = "verified";
    r.commitment = commitment;
    r.receipts = receipts.map(({ txid, vout, value }) => ({
      txid,
      vout,
      value,
    }));
  });
  process.stdout.write(
    JSON.stringify({
      id,
      network: selected,
      source: sourceLabel,
      target: targetLabel,
      amountSats: amount,
      commitment,
      verified: true,
    }) + "\n",
  );
} catch (error) {
  const reason =
    error instanceof Error && /^vault-onboard-[a-z-]+$/.test(error.message)
      ? error.message
      : "vault-onboard-pending-or-unavailable";
  process.stdout.write(
    JSON.stringify({ stage, reason, verified: false }) + "\n",
  );
  process.exitCode = 1;
} finally {
  await receiver?.dispose();
  await wallet?.dispose();
}
