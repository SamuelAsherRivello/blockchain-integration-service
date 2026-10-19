import {
  Wallet,
  MnemonicIdentity,
  InMemoryWalletRepository,
  InMemoryContractRepository,
} from "@arkade-os/sdk";
import { Vault } from "./vault.ts";
import { verifiedInventory } from "./inventory.ts";
import { createArkadeConditionalVaultApi } from "../../packages/integration/src/client/wallet-layer-arkade/conditional-vault-api.ts";
import {
  testNetwork,
  type TestNetwork,
} from "../../packages/integration/src/client/state-layer-core/test-network.ts";
import type {
  VaultJournal,
  VaultJournalEntry,
} from "../../packages/integration/src/client/state-layer-core/conditional-vault-journal.ts";

let protectedQueue: Promise<void> = Promise.resolve();
// SDK diagnostics are not an acceptance result and can contain request context.
// Runners write only their explicit sanitized JSON through process.stdout.
for (const method of ['log','info','warn','error','debug','trace','dir'] as const) console[method] = () => {};
let closingForAcceptanceFault = false;
/** A crash failpoint must not strand another in-process DPAPI write's lock. */
export async function exitAfterProtectedStoreIdle(
  code: number,
): Promise<never> {
  closingForAcceptanceFault = true;
  await protectedQueue;
  process.exit(code);
}

export function protectedConditionalVaultContext(
  network: TestNetwork,
  fault?: { operationId: string; phase: "prepared" | "submitting" },
) {
  const vault = new Vault();
  async function protectedTransaction<T>(
    use: (state: any) => T | Promise<T>,
  ): Promise<T> {
    if (closingForAcceptanceFault)
      throw Error("vault-acceptance-process-closing");
    const prior = protectedQueue;
    let release!: () => void;
    protectedQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await prior;
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          return await vault.transaction(use);
        } catch (error) {
          if (
            !(error instanceof Error) ||
            error.message !== "vault-locked" ||
            attempt >= 30
          )
            throw error;
          await new Promise((resolve) =>
            setTimeout(resolve, 100 + attempt * 25),
          );
        }
      }
    } finally {
      release();
    }
  }
  const journal: VaultJournal = {
    transaction: async (use) => {
      let interrupt = false;
      const result = await protectedTransaction(async (state) => {
        state.conditionalVaultApiJournals ??= {};
        state.conditionalVaultApiJournals[network] ??= [];
        const entries = state.conditionalVaultApiJournals[
          network
        ] as VaultJournalEntry[];
        const value = await use(entries);
        interrupt = Boolean(
          fault &&
            entries.some(
              (entry) =>
                entry.operationId === fault.operationId &&
                entry.phase === fault.phase,
            ),
        );
        return value;
      });
      // Explicit acceptance-test failpoint. Exit only after DPAPI commit and
      // lock release. No response or successful outcome is synthesized.
      if (interrupt) await exitAfterProtectedStoreIdle(75);
      return result;
    },
  };
  const pending = new Map<string, Promise<unknown>>();
  async function lock<T>(key: string, work: () => Promise<T>): Promise<T> {
    const previous = pending.get(key) ?? Promise.resolve();
    const current = previous.catch(() => {}).then(work);
    pending.set(key, current);
    try {
      return await current;
    } finally {
      if (pending.get(key) === current) pending.delete(key);
    }
  }
  async function resolveWallet(reference: string, selected: TestNetwork) {
    const account = await protectedTransaction(async (state) => {
      await verifiedInventory(state);
      const a = state.accounts.find((account) => account.label === reference);
      if (!a?.grant?.active || !a.grant.networks.includes(selected))
        throw Error("vault-test-account-not-authorized");
      return { ...a };
    });
    const wallet = await Wallet.create({
      identity: MnemonicIdentity.fromMnemonic(account.phrase, {
        isMainnet: false,
      }),
      arkServerUrl: testNetwork(selected).operator,
      settlementConfig: false,
      walletMode: "static",
      storage: {
        walletRepository: new InMemoryWalletRepository(),
        contractRepository: new InMemoryContractRepository(),
      },
    });
    return { wallet, release: () => wallet.dispose() };
  }
  const api = createArkadeConditionalVaultApi(network, resolveWallet, {
    journal,
    lock,
  });
  return {
    api,
    vault: { transaction: protectedTransaction },
    journal,
    resolveWallet,
  };
}
