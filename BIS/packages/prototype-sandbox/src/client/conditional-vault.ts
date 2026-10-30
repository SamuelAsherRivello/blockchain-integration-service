import type { VaultDemoExecution } from '../../../integration/src/client/wallet-layer-arkade/conditional-vault-api.ts';
import { RestArkProvider, RestIndexerProvider, type Wallet } from "@arkade-os/sdk";
import { inspectConditionalVault } from "./demos/conditional-vault-check.ts";
import { testNetwork } from "../../../integration/src/client/state-layer-core/test-network.ts";
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
export async function demoReadConditionalVaultDescriptor(
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
export function demoVaultClient(network: TestNetwork, wallet?: Wallet, indexer?: RestIndexerProvider, execution?: VaultDemoExecution) {
  return createArkadeConditionalVaultApi(network, async (reference) => {
    if (reference !== "wallet-2" || !wallet)
      throw Error("vault-creator-wallet-required");
    return { wallet, release: async () => {} };
  }, { execution, inspect: descriptor => inspectConditionalVault(descriptor, {
    ark: new RestArkProvider(testNetwork(network).operator), indexer: indexer ?? new RestIndexerProvider(testNetwork(network).operator), now: Date.now,
  }) });
}
export function demoVaultOperationId(network: TestNetwork, action: string, binding: string) {
  const key = `bis-vault-original-operation:${network}:${action}:${binding}`;
  let value = localStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(key, value);
  }
  return value;
}
export function demoForgetVaultOperationId(network: TestNetwork, action: string, binding: string, operationId: string) {
  const key = `bis-vault-original-operation:${network}:${action}:${binding}`;
  if (localStorage.getItem(key) === operationId) localStorage.removeItem(key);
}
export async function demoRememberVaultResult(result: VaultMutationResult) {
  if (result.inspection) {
    await rememberVaultDescriptor(result.inspection.descriptor);
    demoRememberObservedOutput(result.inspection);
  }
  return result;
}
export function demoRememberObservedOutput(
  inspection: import("../../../integration/src/client/state-layer-core/conditional-vault.ts").VaultInspection,
) {
  const key = `bis-vault-output-hint:${inspection.descriptor.network}:${inspection.descriptor.hash}`;
  if (inspection.activeOutput)
    localStorage.setItem(key, JSON.stringify(inspection.activeOutput));
  else localStorage.removeItem(key);
}
export function demoObservedOutputHint(descriptor: VaultPublicDescriptor) {
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

// Compatibility entry points delegate to the executable teaching modules.
export { demoCreateConditionalVault } from './demos/conditional-vault-create.ts';
export { demoCheckConditionalVault } from './demos/conditional-vault-check.ts';
export { demoIncrementConditionalVault } from './demos/conditional-vault-increment.ts';
export { demoClaimConditionalVault } from './demos/conditional-vault-claim.ts';
