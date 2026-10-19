import type { TestNetwork } from "./test-network.ts";

export type VaultOutpoint = Readonly<{
  transactionId: string;
  outputIndex: number;
}>;
export type VaultLifecycle =
  | "unfunded"
  | "pending"
  | "locked"
  | "claimable"
  | "expired"
  | "claimed"
  | "recovered"
  | "unknown"
  | "conflict"
  | "unavailable";
export type VaultOperation = "create" | "increment" | "claim" | "recover";
export type VaultPublicDescriptor = Readonly<{
  schemaVersion: 1;
  contractVersion: number;
  network: TestNetwork;
  id: string;
  creatorPublicKey: string;
  creatorDestination: string;
  operatorPublicKey: string;
  emulatorPublicKey: string;
  deadline: number;
  exitDelaySeconds: number;
  amountSats: 1000;
  target: 3;
  stateScripts: readonly string[];
  funding: VaultOutpoint;
  hash: string;
}>;
export type VaultEvidence = Readonly<{
  network: TestNetwork;
  transactionId: string;
  consumed: readonly VaultOutpoint[];
  outputs: readonly Readonly<{
    outputIndex: number;
    script: string;
    amountSats: string;
  }>[];
  source: "verified-indexer-transaction";
}>;
export type VaultInspection = Readonly<{
  descriptor: VaultPublicDescriptor;
  status: VaultLifecycle;
  progress: number | null;
  activeOutput: VaultOutpoint | null;
  evidence: readonly VaultEvidence[];
  checkedAt: number;
  reason?: string;
}>;
export type VaultMutationRequest = Readonly<{
  operationId: string;
  descriptor: VaultPublicDescriptor;
  expectedOutput: VaultOutpoint;
}>;
export type VaultCreateRequest = Readonly<{
  operationId: string;
  network: TestNetwork;
  id: string;
  deadline?: number;
  durationSeconds?: 120;
  walletReference: string;
}>;
export type VaultMutationResult = Readonly<{
  operationId: string;
  operation: VaultOperation;
  outcome:
    | "pending"
    | "verified"
    | "already-resolved"
    | "rejected"
    | "unavailable";
  inspection?: VaultInspection;
  reason?: string;
}>;

/** Signers and protected recovery storage belong to the adapter, never these DTOs. */
export interface ConditionalVaultApi {
  create(request: VaultCreateRequest): Promise<VaultMutationResult>;
  increment(request: VaultMutationRequest): Promise<VaultMutationResult>;
  check(descriptor: VaultPublicDescriptor): Promise<VaultInspection>;
  claim(
    request: VaultMutationRequest & Readonly<{ walletReference: string }>,
  ): Promise<VaultMutationResult>;
  recover(
    request: VaultMutationRequest & Readonly<{ walletReference: string }>,
  ): Promise<VaultMutationResult>;
}

/** A missing output or local transaction ID never establishes financial completion. */
export function hasVerifiedVaultResolution(
  inspection: VaultInspection,
): boolean {
  if (
    !["claimed", "recovered"].includes(inspection.status) ||
    inspection.activeOutput !== null
  )
    return false;
  const { descriptor } = inspection;
  if (descriptor.stateScripts.length !== 4) return false;
  let current = descriptor.funding;
  for (let index = 0; index < inspection.evidence.length; index++) {
    const receipt = inspection.evidence[index];
    if (
      receipt.source !== "verified-indexer-transaction" ||
      receipt.network !== descriptor.network ||
      !receipt.consumed.some(
        (input) =>
          input.transactionId === current.transactionId &&
          input.outputIndex === current.outputIndex,
      )
    )
      return false;
    const last = index === inspection.evidence.length - 1;
    const principal = receipt.outputs.filter(
      (output) =>
        output.amountSats === "1000" &&
        output.script ===
          (last
            ? descriptor.creatorDestination
            : descriptor.stateScripts[index + 1]),
    );
    if (principal.length !== 1) return false;
    if (last) return inspection.status === "recovered" || index === 3;
    current = {
      transactionId: receipt.transactionId,
      outputIndex: principal[0].outputIndex,
    };
  }
  return false;
}
