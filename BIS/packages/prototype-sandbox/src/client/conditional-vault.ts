import type { Wallet } from "@arkade-os/sdk";
import { createArkadeConditionalVaultApi } from "../../../integration/src/client/wallet-layer-arkade/conditional-vault-api.ts";
import {
  compileVaultDescriptor,
  exportVaultDescriptor,
  importVaultDescriptor,
  validateVaultDescriptor,
} from "../../../integration/src/client/wallet-layer-arkade/conditional-vault-descriptor.ts";
import type {
  VaultMutationResult,
  VaultPublicDescriptor,
} from "../../../integration/src/client/state-layer-core/conditional-vault.ts";
import type { TestNetwork } from "../../../integration/src/client/state-layer-core/test-network.ts";

export const CONDITIONAL_VAULT_AMOUNT = 1000n;
export const CONDITIONAL_VAULT_TARGET = 3;
const prefix = "bis-conditional-vault-public-v5:";
const suffix = (id: string) => id.replace(/^conditional-vault-/, "");
function descriptors(network: TestNetwork): VaultPublicDescriptor[] {
  const raw = localStorage.getItem(`${prefix}${network}`);
  if (!raw) return [];
  if (raw.length > 1_000_000) throw Error("vault-public-storage-limit");
  const values = JSON.parse(raw);
  if (!Array.isArray(values)) throw Error("vault-public-storage-invalid");
  return values;
}
export async function rememberVaultDescriptor(input: unknown) {
  const descriptor = await validateVaultDescriptor(input);
  await navigator.locks.request(`${prefix}${descriptor.network}`, async () => {
    const values = descriptors(descriptor.network);
    if (!values.some((value) => value.hash === descriptor.hash))
      values.push(descriptor);
    localStorage.setItem(
      `${prefix}${descriptor.network}`,
      JSON.stringify(values),
    );
  });
  return descriptor;
}
export async function readStoredConditionalVault(
  network: TestNetwork,
  id: string,
  creator?: string,
) {
  const candidates = descriptors(network).filter(
    (value) =>
      value.id === suffix(id) &&
      (!creator || value.creatorPublicKey === creator),
  );
  if (candidates.length > 1)
    throw Error(
      `VaultID ${suffix(id)} has multiple creators. Import the exact public descriptor.`,
    );
  if (candidates.length) return validateVaultDescriptor(candidates[0]);
  if (
    localStorage.getItem(
      `prototype-conditional-vault-network-v2:${network}:${id}`,
    )
  )
    throw Error(
      `VaultID ${suffix(id)} is a legacy contract. Its original record is retained; do not recreate or reinterpret it.`,
    );
  return null;
}
function api(network: TestNetwork, wallet?: Wallet) {
  return createArkadeConditionalVaultApi(network, async (reference) => {
    if (reference !== "wallet-2" || !wallet)
      throw Error("vault-creator-wallet-required");
    return { wallet, release: async () => {} };
  });
}
function operationId(network: TestNetwork, action: string, binding: string) {
  const key = `bis-vault-original-operation:${network}:${action}:${binding}`;
  let value = localStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(key, value);
  }
  return value;
}
async function remember(result: VaultMutationResult) {
  if (result.inspection) {
    await rememberVaultDescriptor(result.inspection.descriptor);
    rememberObservedOutput(result.inspection);
  }
  return result;
}
function rememberObservedOutput(
  inspection: import("../../../integration/src/client/state-layer-core/conditional-vault.ts").VaultInspection,
) {
  const key = `bis-vault-output-hint:${inspection.descriptor.network}:${inspection.descriptor.hash}`;
  if (inspection.activeOutput)
    localStorage.setItem(key, JSON.stringify(inspection.activeOutput));
  else localStorage.removeItem(key);
}
function observedOutputHint(descriptor: VaultPublicDescriptor) {
  // This is only the expected-input intent, never financial evidence or state.
  // The API re-reads the real graph and rejects a stale/altered outpoint before
  // signing. Avoid a second identical network read within each two-minute step.
  try {
    const value = JSON.parse(
      localStorage.getItem(
        `bis-vault-output-hint:${descriptor.network}:${descriptor.hash}`,
      ) ?? "null",
    );
    return value &&
      /^[a-f0-9]{64}$/.test(value.transactionId) &&
      Number.isSafeInteger(value.outputIndex) &&
      value.outputIndex >= 0
      ? value
      : null;
  } catch {
    return null;
  }
}
export async function createConditionalVault(
  network: TestNetwork,
  wallet: Wallet,
  id: string,
) {
  const displayId = suffix(id);
  const creator = Array.from(await wallet.identity.xOnlyPublicKey(), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  if (await readStoredConditionalVault(network, id, creator))
    throw Error(`VaultID ${displayId} is already taken.`);
  return remember(
    await api(network, wallet).create({
      network,
      id: displayId,
      walletReference: "wallet-2",
      operationId: operationId(network, "create", `${creator}:${displayId}`),
      durationSeconds: 120,
    }),
  );
}
export async function checkConditionalVault(
  network: TestNetwork,
  descriptor: VaultPublicDescriptor,
) {
  const checked = await api(network).check(descriptor);
  rememberObservedOutput(checked);
  return checked;
}
export async function incrementConditionalVault(
  network: TestNetwork,
  descriptor: VaultPublicDescriptor,
) {
  const client = api(network),
    pendingKey = `bis-vault-ui-pending:${network}:${descriptor.hash}:increment`;
  const pending = localStorage.getItem(pendingKey);
  if (pending) {
    const original = JSON.parse(pending);
    const result = await client.increment({ ...original, descriptor });
    if (["verified", "rejected", "already-resolved"].includes(result.outcome))
      localStorage.removeItem(pendingKey);
    return remember(result);
  }
  const expectedOutput =
    observedOutputHint(descriptor) ??
    (await checkConditionalVault(network, descriptor)).activeOutput;
  if (!expectedOutput)
    throw Error(
      `VaultID ${descriptor.id} has no verified active output. Check its network status.`,
    );
  const request = {
    expectedOutput,
    operationId: operationId(
      network,
      "increment",
      `${descriptor.hash}:${expectedOutput.transactionId}:${expectedOutput.outputIndex}`,
    ),
  };
  localStorage.setItem(pendingKey, JSON.stringify(request));
  const result = await client.increment({ ...request, descriptor });
  if (["verified", "rejected", "already-resolved"].includes(result.outcome))
    localStorage.removeItem(pendingKey);
  return remember(result);
}
export async function claimConditionalVault(
  network: TestNetwork,
  wallet: Wallet,
  descriptor: VaultPublicDescriptor,
  recover = false,
) {
  const client = api(network, wallet),
    operation = recover ? "recover" : "claim";
  let expectedOutput = observedOutputHint(descriptor);
  if (!expectedOutput) {
    const checked = await checkConditionalVault(network, descriptor);
    if (["claimed", "recovered"].includes(checked.status))
      return {
        operationId: "resolved",
        operation,
        outcome: "already-resolved",
        inspection: checked,
      } as VaultMutationResult;
    expectedOutput = checked.activeOutput;
  }
  if (!expectedOutput)
    throw Error(
      `VaultID ${descriptor.id} has no verified active output. Check its network status.`,
    );
  return remember(
    await client[operation]({
      descriptor,
      expectedOutput,
      walletReference: "wallet-2",
      operationId: operationId(
        network,
        operation,
        `${descriptor.hash}:${expectedOutput.transactionId}:${expectedOutput.outputIndex}`,
      ),
    }),
  );
}
export async function importConditionalVault(
  text: string,
  network: TestNetwork,
) {
  const descriptor = await importVaultDescriptor(text);
  if (descriptor.network !== network) throw Error("vault-network-mismatch");
  return rememberVaultDescriptor(descriptor);
}
export { exportVaultDescriptor };
export function conditionalVaultArtifact(descriptor: VaultPublicDescriptor) {
  const built = compileVaultDescriptor(descriptor);
  return JSON.stringify(
    {
      version: built.version,
      descriptor,
      stateScripts: built.states.map((state) => ({
        progress: state.progress,
        pkScript: state.pkScript,
        tree: Array.from(state.script.encode(), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join(""),
        functions: state.functions,
      })),
    },
    null,
    2,
  );
}
