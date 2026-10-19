import test from "node:test";
import assert from "node:assert/strict";
import {
  hasVerifiedVaultResolution,
  type VaultInspection,
} from "../../src/client/state-layer-core/conditional-vault.ts";

function fixture(): VaultInspection {
  return {
    descriptor: {
      schemaVersion: 1,
      contractVersion: 3,
      network: "signet",
      id: "0000",
      creatorPublicKey: "public",
      creatorDestination: "creator-script",
      operatorPublicKey: "operator",
      emulatorPublicKey: "emulator",
      deadline: 2_000_000_000,
      exitDelaySeconds: 2048,
      amountSats: 1000,
      target: 3,
      stateScripts: ["s0", "s1", "s2", "s3"],
      funding: { transactionId: "funding", outputIndex: 0 },
      hash: "descriptor-hash",
    },
    status: "claimed",
    progress: 3,
    activeOutput: null,
    checkedAt: 1,
    evidence: Array.from({ length: 4 }, (_, index) => ({
      network: "signet" as const,
      transactionId: `tx${index}`,
      consumed: [
        {
          transactionId: index === 0 ? "funding" : `tx${index - 1}`,
          outputIndex: 0,
        },
      ],
      outputs: [
        {
          outputIndex: 0,
          script: index === 3 ? "creator-script" : `s${index + 1}`,
          amountSats: "1000",
        },
      ],
      source: "verified-indexer-transaction" as const,
    })),
  };
}
test("financial completion requires linked network receipts, not a local txid or missing output", () => {
  const valid = fixture();
  assert.equal(hasVerifiedVaultResolution(valid), true);
  for (const change of [
    { evidence: [] },
    { status: "unknown" as const },
    { activeOutput: { transactionId: "funding", outputIndex: 0 } },
    { evidence: valid.evidence.slice(1) },
    { evidence: valid.evidence.slice(0, 3) },
    {
      evidence: valid.evidence.map((row) => ({
        ...row,
        network: "mutinynet" as const,
      })),
    },
    {
      evidence: valid.evidence.map((row) => ({
        ...row,
        outputs: [{ outputIndex: 0, script: "attacker", amountSats: "1000" }],
      })),
    },
    {
      evidence: valid.evidence.map((row) => ({
        ...row,
        outputs: row.outputs.map((out) => ({ ...out, amountSats: "99" })),
      })),
    },
  ]) {
    assert.equal(hasVerifiedVaultResolution({ ...valid, ...change }), false);
  }
});
