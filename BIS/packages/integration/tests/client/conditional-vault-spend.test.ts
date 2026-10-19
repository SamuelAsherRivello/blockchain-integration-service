import test from "node:test";
import assert from "node:assert/strict";
import { Transaction } from "@arkade-os/sdk";
import { normalizeVaultOutputLayout } from "../../src/client/wallet-layer-arkade/conditional-vault-spend.ts";
test("validates canonical extension-before-anchor layout without changing the transaction", () => {
  const tx = new Transaction({ allowUnknownOutputs: true });
  tx.addOutput({
    script: Uint8Array.from([0x51, 0x20, ...new Uint8Array(32)]),
    amount: 1000n,
  });
  tx.addOutput({ script: Uint8Array.from([0x6a]), amount: 0n });
  tx.addOutput({ script: Uint8Array.from([0x51, 2, 0x4e, 0x73]), amount: 0n });
  const original = tx.id;
  normalizeVaultOutputLayout(tx);
  assert.deepEqual(
    tx.getOutput(2).script,
    Uint8Array.from([0x51, 2, 0x4e, 0x73]),
  );
  assert.deepEqual(tx.getOutput(1).script, Uint8Array.from([0x6a]));
  assert.equal(tx.id, original);
  assert.equal(normalizeVaultOutputLayout(tx).id, tx.id);
  const invalid = new Transaction({ allowUnknownOutputs: true });
  invalid.addOutput({ script: new Uint8Array([0x6a]), amount: 1000n });
  assert.throws(() => normalizeVaultOutputLayout(invalid), /invalid-layout/);
});
