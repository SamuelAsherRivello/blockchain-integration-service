import type { VaultPublicDescriptor } from "../state-layer-core/conditional-vault.ts";
import {
  compileConditionalVault,
  VAULT_PROGRAM_VERSION,
} from "./conditional-vault-program.ts";

export function descriptorPayload(value: VaultPublicDescriptor) {
  return {
    schemaVersion: value.schemaVersion,
    contractVersion: value.contractVersion,
    network: value.network,
    id: value.id,
    creatorPublicKey: value.creatorPublicKey,
    creatorDestination: value.creatorDestination,
    operatorPublicKey: value.operatorPublicKey,
    emulatorPublicKey: value.emulatorPublicKey,
    deadline: value.deadline,
    exitDelaySeconds: value.exitDelaySeconds,
    amountSats: value.amountSats,
    target: value.target,
    stateScripts: [...value.stateScripts],
    funding: {
      transactionId: value.funding.transactionId,
      outputIndex: value.funding.outputIndex,
    },
  };
}
export async function vaultDescriptorHash(value: VaultPublicDescriptor) {
  const bytes = new TextEncoder().encode(
    JSON.stringify(descriptorPayload(value)),
  );
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}
export async function validateVaultDescriptor(
  input: unknown,
): Promise<VaultPublicDescriptor> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error("vault-descriptor-invalid");
  const value = structuredClone(input) as VaultPublicDescriptor;
  if (
    value.schemaVersion !== 1 ||
    value.contractVersion !== VAULT_PROGRAM_VERSION ||
    !["signet", "mutinynet"].includes(value.network) ||
    value.amountSats !== 1000 ||
    value.target !== 3 ||
    !/^\d{4}$/.test(value.id ?? "") ||
    !/^5120[0-9a-f]{64}$/.test(value.creatorDestination ?? "") ||
    !Array.isArray(value.stateScripts) ||
    value.stateScripts.length !== 4 ||
    !/^[0-9a-f]{64}$/.test(value.hash ?? "") ||
    !/^[0-9a-f]{64}$/.test(value.funding?.transactionId ?? "") ||
    !Number.isInteger(value.funding?.outputIndex) ||
    value.funding.outputIndex < 0 ||
    value.funding.outputIndex > 0xffffffff
  )
    throw Error("vault-descriptor-invalid");
  const compiled = compileConditionalVault({
    network: value.network,
    id: value.id,
    creatorKey: value.creatorPublicKey,
    creatorDestination: value.creatorDestination.slice(4),
    serverKey: value.operatorPublicKey,
    emulatorKey: value.emulatorPublicKey,
    deadline: value.deadline,
    exitDelaySeconds: value.exitDelaySeconds,
  });
  if (
    compiled.states.some(
      (state, index) => state.pkScript !== value.stateScripts[index],
    )
  )
    throw Error("vault-descriptor-script-mismatch");
  if ((await vaultDescriptorHash(value)) !== value.hash)
    throw Error("vault-descriptor-hash-mismatch");
  // Reconstruct a bounded allowlisted object. Unknown fields never propagate.
  const payload = descriptorPayload(value);
  return Object.freeze({
    ...payload,
    stateScripts: Object.freeze(payload.stateScripts),
    funding: Object.freeze(payload.funding),
    hash: value.hash,
  }) as VaultPublicDescriptor;
}
export function compileVaultDescriptor(value: VaultPublicDescriptor) {
  return compileConditionalVault({
    network: value.network,
    id: value.id,
    creatorKey: value.creatorPublicKey,
    creatorDestination: value.creatorDestination.slice(4),
    serverKey: value.operatorPublicKey,
    emulatorKey: value.emulatorPublicKey,
    deadline: value.deadline,
    exitDelaySeconds: value.exitDelaySeconds,
  });
}
export async function exportVaultDescriptor(value: VaultPublicDescriptor) {
  return JSON.stringify(await validateVaultDescriptor(value), null, 2);
}
export async function importVaultDescriptor(text: string) {
  if (text.length > 16384) throw Error("vault-descriptor-too-large");
  try {
    return await validateVaultDescriptor(JSON.parse(text));
  } catch {
    throw Error("vault-descriptor-import-invalid");
  }
}
