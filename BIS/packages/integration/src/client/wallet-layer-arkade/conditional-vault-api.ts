import {
  arkade,
  ArkAddress,
  RestArkProvider,
  RestIndexerProvider,
  RestEmulatorProvider,
  getNetwork,
  type Wallet,
} from "@arkade-os/sdk";
import { hex } from "@scure/base";
import type {
  ConditionalVaultApi,
  VaultPublicDescriptor,
  VaultMutationResult,
  VaultMutationRequest,
  VaultOperation,
  VaultInspection,
} from "../state-layer-core/conditional-vault.ts";
import {
  createVaultJournal,
  type VaultJournal,
  type VaultJournalEntry,
} from "../state-layer-core/conditional-vault-journal.ts";
import {
  testNetwork,
  type TestNetwork,
} from "../state-layer-core/test-network.ts";
import {
  VAULT_EMULATORS,
  inspectVaultCapability,
} from "./conditional-vault-capability.ts";
import {
  compileConditionalVault,
  VAULT_PROGRAM_VERSION,
} from "./conditional-vault-program.ts";
import {
  compileVaultDescriptor,
  validateVaultDescriptor,
  vaultDescriptorHash,
} from "./conditional-vault-descriptor.ts";
import {
  decodeVaultTransaction,
  inspectConditionalVault,
} from "./conditional-vault-inspection.ts";
import { sendConditionalVaultSpend } from "./conditional-vault-spend.ts";
import { replayOriginalVaultRequest } from "./conditional-vault-replay.ts";

type WalletResolver = (
  reference: string,
  network: TestNetwork,
) => Promise<{ wallet: Wallet; release(): Promise<void> }>;
type Lock = <T>(key: string, work: () => Promise<T>) => Promise<T>;
const defaultLock: Lock = async (key, work) => {
  if (!globalThis.navigator?.locks)
    throw Error("vault-cross-tab-lock-unavailable");
  return navigator.locks.request(`bis-vault-operation:${key}`, work);
};
const safe = (error: unknown) => {
  if (error instanceof Error && /^vault-[a-z-]+$/.test(error.message))
    return error.message;
  if (
    error instanceof Error &&
    /^insufficient (?:funds|balance)/i.test(error.message)
  )
    return "vault-insufficient-funds";
  return "vault-network-operation-unavailable";
};
const terminal = new Set(["verified", "rejected"]);

/** Arkade adapter entry. Game-facing requests/results contain no SDK or signer material. */
export function createArkadeConditionalVaultApi(
  network: TestNetwork,
  resolveWallet: WalletResolver,
  options: {
    journal?: VaultJournal;
    lock?: Lock;
    now?: () => number;
    inspect?: (descriptor: VaultPublicDescriptor) => Promise<VaultInspection>;
  } = {},
): ConditionalVaultApi {
  const journal = options.journal ?? createVaultJournal(network),
    lock = options.lock ?? defaultLock,
    now = options.now ?? Date.now;
  const operator = testNetwork(network).operator;
  const indexer = new RestIndexerProvider(operator);
  // Isolated provider tests may supply inspection responses. The production
  // host supplies no override; all demo reads use these real network providers.
  const read =
    options.inspect ??
    ((descriptor: VaultPublicDescriptor) =>
      inspectConditionalVault(descriptor, {
        ark: new RestArkProvider(operator),
        indexer,
        now,
      }));
  const validId = (id: string) => {
    if (!/^[A-Za-z0-9:_-]{1,100}$/.test(id))
      throw Error("vault-operation-id-invalid");
  };
  const scope = (creator: string, id: string) =>
    `${network}:${VAULT_PROGRAM_VERSION}:${creator}:${id}`;
  // Cache only already persisted immutable operation bindings. Network inspection
  // remains fresh, and every mutation still reads/writes the protected journal.
  const records = new Map<string, VaultJournalEntry>();
  async function row(id: string) {
    const cached = records.get(id);
    if (cached) return structuredClone(cached);
    const entry = await journal.transaction((entries) =>
      structuredClone(entries.find((row) => row.operationId === id)),
    );
    if (entry) records.set(id, entry);
    return entry;
  }
  async function update(
    id: string,
    change: (entry: VaultJournalEntry) => void,
  ) {
    const saved = await journal.transaction((entries) => {
      const entry = entries.find((r) => r.operationId === id);
      if (!entry) throw Error("vault-operation-not-found");
      change(entry);
      return structuredClone(entry);
    });
    records.set(id, saved);
  }
  function transport(operationId: string) {
    const ark = new RestArkProvider(operator),
      emulator = new RestEmulatorProvider(VAULT_EMULATORS[network].endpoint);
    async function checkpoint(
      target: "operator" | "finalize" | "emulator",
      request: string[] | [string, string[]],
    ) {
      await update(operationId, (entry) => {
        entry.phase = "submitting";
        entry.recovery.push({ target, request });
        if (target !== "finalize")
          entry.transactionId = decodeVaultTransaction(request[0] as string).id;
      });
    }
    const submit = ark.submitTx.bind(ark);
    ark.submitTx = async (...args) => {
      await checkpoint("operator", args);
      return submit(...args);
    };
    const finalize = ark.finalizeTx.bind(ark);
    ark.finalizeTx = async (...args) => {
      await checkpoint("finalize", args);
      return finalize(...args);
    };
    const emulate = emulator.submitTx.bind(emulator);
    emulator.submitTx = async (...args) => {
      await checkpoint("emulator", args);
      try {
        return await emulate(...args);
      } catch (error) {
        await update(operationId, (entry) => {
          entry.draft = {
            ...entry.draft,
            privateTransportError: String(error),
          };
        });
        throw error;
      }
    };
    return { ark, emulator };
  }
  async function finish(
    operationId: string,
    operation: VaultOperation,
    descriptor: VaultPublicDescriptor,
  ): Promise<VaultMutationResult> {
    const observed = await read(descriptor),
      record = await row(operationId);
    const reference = record?.transactionId;
    if (record?.phase === "rejected")
      return {
        operationId,
        operation,
        outcome: "rejected",
        inspection: observed,
        reason: "vault-original-operation-rejected",
      };
    const proved =
      operation === "create"
        ? observed.status === "locked" ||
          observed.status === "claimable" ||
          observed.status === "expired" ||
          observed.evidence.length > 0
        : observed.evidence.some(
            (receipt) => receipt.transactionId === reference,
          );
    if (proved && record?.phase !== "verified")
      await update(operationId, (entry) => {
        entry.phase = "verified";
      });
    return {
      operationId,
      operation,
      outcome: proved ? "verified" : "pending",
      inspection: observed,
      ...(!proved ? { reason: "vault-reconciliation-pending" } : {}),
    };
  }
  async function recoverCreate(
    record: VaultJournalEntry,
  ): Promise<VaultMutationResult> {
    if (record.descriptor)
      return finish(record.operationId, "create", record.descriptor);
    if (!record.transactionId || !record.draft)
      return {
        operationId: record.operationId,
        operation: "create",
        outcome: "pending",
        reason: "vault-original-funding-unresolved",
      };
    const parameters = JSON.parse(String(record.draft.parameters));
    const compiled = compileConditionalVault(parameters);
    const response = await indexer.getVirtualTxs([record.transactionId]);
    const tx = response.txs
      .map(decodeVaultTransaction)
      .find((tx) => tx.id === record.transactionId);
    if (!tx)
      return {
        operationId: record.operationId,
        operation: "create",
        outcome: "pending",
        reason: "vault-funding-evidence-pending",
      };
    const matches = Array.from({ length: tx.outputsLength }, (_, index) => ({
      index,
      ...tx.getOutput(index),
    })).filter(
      (out) =>
        out.amount === 1000n &&
        out.script &&
        hex.encode(out.script) === compiled.states[0].pkScript,
    );
    if (matches.length !== 1) throw Error("vault-funding-output-conflict");
    const funding = { transactionId: tx.id, outputIndex: matches[0].index };
    // Archived or pending PSBTs alone are not a funding receipt.
    const coins = await indexer.getVtxos({
      outpoints: [{ txid: funding.transactionId, vout: funding.outputIndex }],
    });
    if (
      !coins.vtxos.some(
        (c) => c.value === 1000 && c.script === compiled.states[0].pkScript,
      )
    )
      return {
        operationId: record.operationId,
        operation: "create",
        outcome: "pending",
        reason: "vault-funding-output-pending",
      };
    const descriptor: VaultPublicDescriptor = {
      schemaVersion: 1,
      contractVersion: VAULT_PROGRAM_VERSION,
      network,
      id: parameters.id,
      creatorPublicKey: parameters.creatorKey,
      creatorDestination: `5120${parameters.creatorDestination}`,
      operatorPublicKey: parameters.serverKey,
      emulatorPublicKey: parameters.emulatorKey,
      deadline: parameters.deadline,
      exitDelaySeconds: parameters.exitDelaySeconds,
      amountSats: 1000,
      target: 3,
      stateScripts: compiled.states.map((s) => s.pkScript),
      funding,
      hash: "",
    };
    const hashed = {
      ...descriptor,
      hash: await vaultDescriptorHash(descriptor),
    };
    await update(record.operationId, (entry) => {
      entry.descriptor = hashed;
      entry.phase = "pending";
    });
    return finish(record.operationId, "create", hashed);
  }
  async function replay(
    record: VaultJournalEntry,
    operation: VaultOperation,
    descriptor?: VaultPublicDescriptor,
    identity?: Wallet["identity"],
  ) {
    if (!record.recovery.length) {
      await update(record.operationId, (entry) => {
        entry.phase = "rejected";
      });
      return {
        operationId: record.operationId,
        operation,
        outcome: "rejected" as const,
        reason: "vault-original-request-not-submitted",
      };
    }
    const observed = async () =>
      descriptor
        ? finish(record.operationId, operation, descriptor)
        : recoverCreate((await row(record.operationId))!);
    let settled = false;
    // These requests were protected before the original dispatch. Do not run
    // transport's new-submit hooks, or replace their immutable transaction ID.
    const work = replayOriginalVaultRequest(record, {
      ark: new RestArkProvider(operator),
      emulator: new RestEmulatorProvider(VAULT_EMULATORS[network].endpoint),
      identity,
      persistFinalization: async (request) => {
        await update(record.operationId, (entry) => {
          entry.recovery.push({ target: "finalize", request });
        });
      },
    })
      .catch(async (error) => {
        await update(record.operationId, (entry) => {
          entry.draft = { ...entry.draft, privateReplayError: String(error) };
        });
      })
      .then(async () => {
        settled = true;
        try {
          return await observed();
        } catch {
          return {
            operationId: record.operationId,
            operation,
            outcome: "pending" as const,
            reason: "vault-network-evidence-unavailable",
          };
        }
      });
    const receipts = (async () => {
      for (let attempt = 0; attempt < 45 && !settled; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (settled) break;
        try {
          const result = await observed();
          if (result.outcome === "verified") return result;
        } catch {}
      }
      return work;
    })();
    return Promise.race([work, receipts]);
  }
  async function mutate(
    operation: "increment" | "claim" | "recover",
    request: VaultMutationRequest & { walletReference?: string },
  ): Promise<VaultMutationResult> {
    request = structuredClone(request);
    validId(request.operationId);
    const descriptor = await validateVaultDescriptor(request.descriptor);
    if (descriptor.network !== network) throw Error("vault-network-mismatch");
    return lock(`${network}:${descriptor.hash}`, async () => {
      const existing = await row(request.operationId);
      if (existing) {
        if (
          existing.scope !==
            scope(descriptor.creatorPublicKey, descriptor.id) ||
          existing.descriptor?.hash !== descriptor.hash ||
          existing.operation !== operation ||
          JSON.stringify(existing.expectedInput) !==
            JSON.stringify(request.expectedOutput)
        )
          throw Error("vault-operation-intent-conflict");
        const result = await finish(request.operationId, operation, descriptor);
        if (result.outcome !== "pending") return result;
        return replay(existing, operation, descriptor);
      }
      const before = await read(descriptor);
      if (["claimed", "recovered"].includes(before.status))
        return {
          operationId: request.operationId,
          operation,
          outcome: "already-resolved",
          inspection: before,
        };
      if (
        !before.activeOutput ||
        JSON.stringify(before.activeOutput) !==
          JSON.stringify(request.expectedOutput)
      )
        return {
          operationId: request.operationId,
          operation,
          outcome: "rejected",
          inspection: before,
          reason: "vault-expected-outpoint-mismatch",
        };
      if (
        (operation === "increment" && before.status !== "locked") ||
        (operation === "claim" && before.status !== "claimable") ||
        (operation === "recover" && before.status !== "expired")
      )
        return {
          operationId: request.operationId,
          operation,
          outcome: "rejected",
          inspection: before,
          reason: "vault-state-does-not-permit-operation",
        };
      await journal.transaction((entries) => {
        if (
          entries.some(
            (r) =>
              !terminal.has(r.phase) &&
              r.expectedInput &&
              JSON.stringify(r.expectedInput) ===
                JSON.stringify(request.expectedOutput),
          )
        )
          throw Error("vault-original-operation-unresolved");
        entries.push({
          operationId: request.operationId,
          operation,
          scope: scope(descriptor.creatorPublicKey, descriptor.id),
          network,
          createdAt: now(),
          phase: "prepared",
          descriptor,
          expectedInput: request.expectedOutput,
          recovery: [],
        });
      });
      let lease: Awaited<ReturnType<WalletResolver>> | undefined;
      try {
        if (operation !== "increment") {
          if (!request.walletReference)
            throw Error("vault-creator-wallet-required");
          lease = await resolveWallet(request.walletReference, network);
          if (
            hex.encode(await lease.wallet.identity.xOnlyPublicKey()) !==
            descriptor.creatorPublicKey
          )
            throw Error("vault-creator-identity-mismatch");
          const walletInfo = await lease.wallet.arkProvider.getInfo();
          if (
            walletInfo.network !== network ||
            walletInfo.signerPubkey.slice(2) !== descriptor.operatorPublicKey
          )
            throw Error("vault-wallet-network-mismatch");
        }
        await inspectVaultCapability(
          network,
          hex.decode(descriptor.creatorPublicKey),
        );
        if (descriptor.emulatorPublicKey !== VAULT_EMULATORS[network].key)
          throw Error("vault-original-signer-service-required");
        const { ark, emulator } = transport(request.operationId);
        const info = await ark.getInfo();
        if (
          info.network !== network ||
          info.signerPubkey.slice(2) !== descriptor.operatorPublicKey
        )
          throw Error("vault-operator-identity-mismatch");
        const client = await arkade.Arkade.connect({
          arkade: ark,
          indexer,
          emulator,
          emulatorPubkey: `03${descriptor.emulatorPublicKey}`,
          network: getNetwork(network),
          identity: lease?.wallet.identity,
        });
        const built = compileVaultDescriptor(descriptor),
          progress = before.progress!;
        const state = built.states[progress],
          contract = client.contract(state.program, state.args);
        const destination =
          operation === "increment"
            ? hex.decode(descriptor.stateScripts[progress + 1])
            : hex.decode(descriptor.creatorDestination);
        // The operator can materialize the spend before the co-signer's final HTTP
        // response. Race that response against verified receipts, not a timer-based
        // optimistic success. The signed request is already durable before dispatch.
        let settled = false;
        const submission = sendConditionalVaultSpend(
          contract,
          emulator,
          operation,
          {
            txid: before.activeOutput.transactionId,
            vout: before.activeOutput.outputIndex,
            value: 1000,
          },
          destination,
          lease?.wallet.identity,
        ).then(
          async () => {
            settled = true;
            await update(request.operationId, (entry) => {
              if (entry.phase !== "verified") entry.phase = "pending";
            });
            return finish(request.operationId, operation, descriptor);
          },
          async (error) => {
            settled = true;
            const reconciled = await finish(
              request.operationId,
              operation,
              descriptor,
            );
            if (reconciled.outcome === "verified") return reconciled;
            throw error;
          },
        );
        const receipts = (async (): Promise<VaultMutationResult> => {
          for (let attempt = 0; attempt < 45 && !settled; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            if (settled) break;
            try {
              const reconciled = await finish(
                request.operationId,
                operation,
                descriptor,
              );
              if (reconciled.outcome === "verified") return reconciled;
            } catch {
              /* A missing receipt remains unresolved. */
            }
          }
          return submission;
        })();
        return await Promise.race([submission, receipts]);
      } catch (error) {
        const current = await row(request.operationId);
        // A lost or failed HTTP response does not mean the network rejected the spend.
        // Reconcile the original transaction before reporting an unresolved operation.
        if (current?.recovery.length) {
          try {
            const reconciled = await finish(
              request.operationId,
              operation,
              descriptor,
            );
            if (reconciled.outcome === "verified") return reconciled;
          } catch {
            /* Retain the original signed request for later reconciliation. */
          }
        }
        if (!current?.recovery.length)
          await update(request.operationId, (entry) => {
            entry.phase = "rejected";
          });
        return {
          operationId: request.operationId,
          operation,
          outcome: current?.recovery.length ? "pending" : "rejected",
          reason: safe(error),
        };
      } finally {
        try {
          await lease?.release();
        } catch {
          /* Cleanup cannot replace a financial outcome. */
        }
      }
    });
  }
  return {
    check: async (descriptor) => {
      if (descriptor.network !== network) throw Error("vault-network-mismatch");
      return read(descriptor);
    },
    increment: (request) => mutate("increment", request),
    claim: (request) => mutate("claim", request),
    recover: (request) => mutate("recover", request),
    create: async (request) => {
      request = structuredClone(request);
      validId(request.operationId);
      if (request.network !== network || !/^\d{4}$/.test(request.id))
        throw Error("vault-create-input-invalid");
      let lease: Awaited<ReturnType<WalletResolver>>;
      try {
        lease = await resolveWallet(request.walletReference, network);
      } catch (error) {
        return {
          operationId: request.operationId,
          operation: "create",
          outcome: "unavailable",
          reason: safe(error),
        };
      }
      try {
        const key = hex.encode(await lease.wallet.identity.xOnlyPublicKey()),
          binding = scope(key, request.id);
        return await lock(`${network}:creator:${key}`, async () => {
          const existing = await row(request.operationId);
          if (existing) {
            if (existing.scope !== binding || existing.operation !== "create")
              throw Error("vault-operation-intent-conflict");
            const result = await recoverCreate(existing).catch(() => ({
              operationId: existing.operationId,
              operation: "create" as const,
              outcome: "pending" as const,
              reason: "vault-original-funding-unresolved",
            }));
            if (result.outcome !== "pending") return result;
            return replay(
              existing,
              "create",
              existing.descriptor,
              lease.wallet.identity,
            );
          }
          const duplicate = await journal.transaction((entries) =>
            entries.some(
              (r) => r.operation === "create" && r.scope === binding,
            ),
          );
          if (duplicate) throw Error(`VaultID ${request.id} is already taken.`);
          const capability = await inspectVaultCapability(
            network,
            hex.decode(key),
          );
          const walletInfo = await lease.wallet.arkProvider.getInfo();
          if (
            walletInfo.network !== network ||
            walletInfo.signerPubkey !== capability.operatorKey
          )
            throw Error("vault-wallet-network-mismatch");
          const address = await lease.wallet.getAddress();
          if (
            (request.deadline !== undefined &&
              request.durationSeconds !== undefined) ||
            (request.durationSeconds !== undefined &&
              request.durationSeconds !== 120)
          )
            throw Error("vault-deadline-invalid");
          const deadline =
            request.durationSeconds === 120
              ? Math.floor(now() / 1000) + 120
              : request.deadline;
          if (
            deadline === undefined ||
            !Number.isSafeInteger(deadline) ||
            deadline <= Math.floor(now() / 1000) ||
            deadline > Math.floor(now() / 1000) + 120
          )
            throw Error("vault-deadline-invalid");
          const parameters = {
            network,
            id: request.id,
            creatorKey: key,
            creatorDestination: hex.encode(
              ArkAddress.decode(address).vtxoTaprootKey,
            ),
            serverKey: capability.operatorKey.slice(2),
            emulatorKey: VAULT_EMULATORS[network].key,
            deadline,
            exitDelaySeconds: Number(walletInfo.unilateralExitDelay),
          };
          const built = compileConditionalVault(parameters);
          const originalProvider = lease.wallet.arkProvider;
          // Hook only this isolated leased wallet, never a global/shared account provider.
          const hooks = transport(request.operationId);
          await journal.transaction((entries) => {
            if (
              entries.some(
                (entry) =>
                  entry.operation === "create" && entry.scope === binding,
              )
            )
              throw Error(`VaultID ${request.id} is already taken.`);
            entries.push({
              operationId: request.operationId,
              operation: "create",
              scope: binding,
              network,
              createdAt: now(),
              phase: "prepared",
              recovery: [],
              draft: { parameters: JSON.stringify(parameters) },
              expectedScript: built.states[0].pkScript,
            });
          });
          const submit = originalProvider.submitTx.bind(originalProvider),
            finalize = originalProvider.finalizeTx.bind(originalProvider);
          originalProvider.submitTx = hooks.ark.submitTx.bind(hooks.ark);
          originalProvider.finalizeTx = hooks.ark.finalizeTx.bind(hooks.ark);
          try {
            const target = built.states[0].script
              .address(
                getNetwork(network).hrp,
                hex.decode(parameters.serverKey),
              )
              .encode();
            let acknowledged = false;
            const funding = lease.wallet
              .send({ address: target, amount: 1000 })
              .then(
                async () => {
                  acknowledged = true;
                  return recoverCreate((await row(request.operationId))!);
                },
                (error) => {
                  acknowledged = true;
                  throw error;
                },
              );
            const receipts = (async (): Promise<VaultMutationResult> => {
              for (let attempt = 0; attempt < 45 && !acknowledged; attempt++) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
                if (acknowledged) break;
                try {
                  const recovered = await recoverCreate(
                    (await row(request.operationId))!,
                  );
                  if (recovered.outcome === "verified") return recovered;
                } catch {
                  /* No actual output means funding remains unresolved. */
                }
              }
              return funding;
            })();
            return await Promise.race([funding, receipts]);
          } catch (error) {
            const current = await row(request.operationId);
            if (current?.recovery.length) {
              try {
                const reconciled = await recoverCreate(current);
                if (reconciled.outcome === "verified") return reconciled;
              } catch {
                /* Preserve the unresolved original operation. */
              }
            }
            if (!current?.recovery.length)
              await update(request.operationId, (entry) => {
                entry.phase = "rejected";
              });
            return {
              operationId: request.operationId,
              operation: "create",
              outcome: current?.recovery.length ? "pending" : "rejected",
              reason: safe(error),
            };
          } finally {
            originalProvider.submitTx = submit;
            originalProvider.finalizeTx = finalize;
          }
        });
      } finally {
        try {
          await lease.release();
        } catch {
          /* Preserve the original funding outcome. */
        }
      }
    },
  };
}
