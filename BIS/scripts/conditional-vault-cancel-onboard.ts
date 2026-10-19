import {
  Wallet,
  MnemonicIdentity,
  InMemoryWalletRepository,
  InMemoryContractRepository,
} from "@arkade-os/sdk";
import { Vault } from "./test-wallets/vault.ts";
import { testNetwork } from "../packages/integration/src/client/state-layer-core/test-network.ts";
import { protectedConditionalVaultContext } from "./test-wallets/conditional-vault-context.ts";
let wallet: Wallet | undefined;
let stage = "record";
try {
  const id = process.argv[2];
  if (process.argv.length !== 3) throw Error();
  const { vault } = protectedConditionalVaultContext("signet");
  const { record, account } = await vault.transaction((state) => {
    const record = state.conditionalVaultOnboarding?.[id];
    if (
      !record ||
      record.status === "verified" ||
      record.requests.some((r) => r.kind !== "register")
    )
      throw Error();
    const account = state.accounts.find((a) => a.profileId === record.source);
    if (
      !account?.grant?.active ||
      !account.grant.networks.includes(record.network)
    )
      throw Error();
    return { record, account };
  });
  stage = "wallet";
  wallet = await Wallet.create({
    identity: MnemonicIdentity.fromMnemonic(account.phrase, {
      isMainnet: false,
    }),
    arkServerUrl: testNetwork(record.network).operator,
    walletMode: "static",
    settlementConfig: false,
    storage: {
      walletRepository: new InMemoryWalletRepository(),
      contractRepository: new InMemoryContractRepository(),
    },
  });
  stage = "inputs";
  const original = new Set(record.inputs.map((c) => `${c.txid}:${c.vout}`));
  const coins = (await wallet.getBoardingUtxos()).filter((c) =>
    original.has(`${c.txid}:${c.vout}`),
  );
  if (coins.length !== original.size) throw Error();
  stage = "signing";
  const deletion = await wallet.makeDeleteIntentSignature(coins);
  await vault.transaction((state) => {
    state.conditionalVaultOnboarding[id].cancelRequest = deletion;
  });
  stage = "cancellation";
  try {
    await wallet.arkProvider.deleteIntent(deletion);
  } catch (error) {
    // An authenticated absence response plus the exact still-unspent original
    // inputs and no batch signatures resolves a registration-only intent.
    if (
      !(error instanceof Error) ||
      !error.message.includes("no matching intents found for intent proof")
    )
      throw error;
    await vault.transaction((state) => {
      state.conditionalVaultOnboarding[id].cancellationProof =
        "operator-no-matching-intent-original-inputs-unspent";
    });
  }
  await vault.transaction((state) => {
    state.conditionalVaultOnboarding[id].status = "cancelled";
  });
  process.stdout.write(
    JSON.stringify({ id, cancelled: true, originalInputsPreserved: true }) +
      "\n",
  );
} catch (error) {
  const vault = new Vault();
  await vault
    .transaction((state) => {
      state.conditionalVaultOnboarding[process.argv[2]].cancellationError =
        String(error);
    })
    .catch(() => {});
  process.stdout.write(
    JSON.stringify({
      cancelled: false,
      stage,
      reason: "vault-original-onboarding-unresolved",
    }) + "\n",
  );
  process.exitCode = 1;
} finally {
  await wallet?.dispose();
}
