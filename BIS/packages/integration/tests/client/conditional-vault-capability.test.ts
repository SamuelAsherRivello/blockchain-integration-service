import test from "node:test";
import assert from "node:assert/strict";
import {
  inspectVaultCapability,
  VAULT_EMULATORS,
} from "../../src/client/wallet-layer-arkade/conditional-vault-capability.ts";
const G = "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
function fixture(network: string, overrides = {}, emulatorOverrides = {}) {
  return {
    ark: {
      getInfo: async () => ({
        network,
        signerPubkey: `02${G}`,
        unilateralExitDelay: 2048n,
        vtxoMinAmount: 1n,
        vtxoMaxAmount: -1n,
        dust: 330n,
        fees: {
          txFeeRate: "0",
          intentFee: { offchainInput: "", offchainOutput: "0.0" },
        },
        ...overrides,
      }),
    },
    indexer: { getVtxos: async () => ({ vtxos: [] }) },
    emulatorInfo: async () => ({
      signerPubkey: `03${VAULT_EMULATORS[network as keyof typeof VAULT_EMULATORS].key}`,
      version: "fixture",
      ...emulatorOverrides,
    }),
  };
}
for (const network of ["signet", "mutinynet"] as const)
  test(`${network} independently probes public capability without spending`, async () => {
    const result = await inspectVaultCapability(
      network,
      Buffer.from(G, "hex"),
      fixture(network) as never,
    );
    assert.equal(result.network, network);
    assert.equal(result.classification, "read-only-compatible");
    assert.equal(result.fundedAcceptance, false);
    assert.equal(result.execution, "unverified");
    assert.equal(result.minimum, "1");
    assert.equal(result.maximum, "-1");
    assert.equal(result.states.length, 4);
  });
test("capability fails closed for mismatched network, pin, fees and principal limits", async () => {
  const key = Buffer.from(G, "hex");
  for (const network of ["signet", "mutinynet"] as const) {
  await assert.rejects(
    inspectVaultCapability(network, key, fixture(network === "signet" ? "mutinynet" : "signet") as never),
    /network-mismatch/,
  );
  await assert.rejects(
    inspectVaultCapability(
      network,
      key,
      fixture(network, {}, { signerPubkey: `02${G}` }) as never,
    ),
    /pin-mismatch/,
  );
  await assert.rejects(
    inspectVaultCapability(
      network,
      key,
      fixture(network, { vtxoMinAmount: 1001n }) as never,
    ),
    /principal-outside-policy/,
  );
  await assert.rejects(
    inspectVaultCapability(
      network,
      key,
      fixture(network, { dust: 1001n }) as never,
    ),
    /principal-below-taproot-dust/,
  );
  await assert.rejects(
    inspectVaultCapability(
      network,
      key,
      fixture(network, { vtxoMaxAmount: 99n }) as never,
    ),
    /principal-outside-policy/,
  );
  await assert.rejects(
    inspectVaultCapability(
      network,
      key,
      fixture(network, { fees: { txFeeRate: "1", intentFee: {} } }) as never,
    ),
    /unsupported-fees/,
  );
  }
});
