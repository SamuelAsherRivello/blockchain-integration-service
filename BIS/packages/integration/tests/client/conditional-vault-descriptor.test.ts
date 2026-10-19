import test from "node:test";
import assert from "node:assert/strict";
import { compileConditionalVault } from "../../src/client/wallet-layer-arkade/conditional-vault-program.ts";
import {
  vaultDescriptorHash,
  validateVaultDescriptor,
  exportVaultDescriptor,
  importVaultDescriptor,
} from "../../src/client/wallet-layer-arkade/conditional-vault-descriptor.ts";
import type { VaultPublicDescriptor } from "../../src/client/state-layer-core/conditional-vault.ts";
const G = "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
const H = "c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5";
export async function descriptorFixture(
  network: "signet" | "mutinynet" = "signet",
) {
  const params = {
    network,
    id: "0000",
    creatorKey: G,
    creatorDestination: H,
    serverKey: H,
    emulatorKey: G,
    deadline: 2_000_000_000,
    exitDelaySeconds: 2048,
  };
  const compiled = compileConditionalVault(params);
  const descriptor: VaultPublicDescriptor = {
    schemaVersion: 1,
    contractVersion: 5,
    network,
    id: "0000",
    creatorPublicKey: G,
    creatorDestination: `5120${H}`,
    operatorPublicKey: H,
    emulatorPublicKey: G,
    deadline: params.deadline,
    exitDelaySeconds: 2048,
    amountSats: 1000,
    target: 3,
    stateScripts: compiled.states.map((s) => s.pkScript),
    funding: { transactionId: "aa".repeat(32), outputIndex: 0 },
    hash: "",
  };
  return { ...descriptor, hash: await vaultDescriptorHash(descriptor) };
}
test("portable public descriptors round-trip and recompile without a signing identity", async () => {
  for (const network of ["signet", "mutinynet"] as const) {
    const original = await descriptorFixture(network);
    assert.deepEqual(
      await importVaultDescriptor(await exportVaultDescriptor(original)),
      original,
    );
  }
});
test("tampered parameters, outpoints and rehashed invalid scripts fail closed", async () => {
  const original = await descriptorFixture();
  for (const patch of [
    { network: "mutinynet" },
    { id: "0001" },
    { deadline: original.deadline + 1 },
    { creatorPublicKey: H },
    { creatorDestination: `5120${G}` },
    { funding: { transactionId: "bb".repeat(32), outputIndex: 0 } },
    { amountSats: 999 },
    { contractVersion: 3 },
    { stateScripts: [...original.stateScripts].reverse() },
  ]) {
    await assert.rejects(validateVaultDescriptor({ ...original, ...patch }));
  }
  const bad = {
    ...original,
    stateScripts: [...original.stateScripts].reverse(),
  };
  await assert.rejects(
    validateVaultDescriptor({ ...bad, hash: await vaultDescriptorHash(bad) }),
    /script-mismatch/,
  );
  await assert.rejects(importVaultDescriptor("x".repeat(16385)), /too-large/);
});
