import test from "node:test";
import assert from "node:assert/strict";
import {
  CSVMultisigTapscript,
  buildOffchainTx,
  DefaultVtxo,
  SingleKey,
  Transaction,
  verifyTapscriptSignatures,
} from "@arkade-os/sdk";
import { base64, hex } from "@scure/base";
import { compileConditionalVault } from "../../src/client/wallet-layer-arkade/conditional-vault-program.ts";
import { replayOriginalVaultRequest } from "../../src/client/wallet-layer-arkade/conditional-vault-replay.ts";
import type { VaultJournalEntry } from "../../src/client/state-layer-core/conditional-vault-journal.ts";
const G = "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
const H = "c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5";
function fixture() {
  const built = compileConditionalVault({
    network: "signet",
    id: "0000",
    creatorKey: G,
    creatorDestination: H,
    serverKey: H,
    emulatorKey: G,
    deadline: 2000000000,
    exitDelaySeconds: 2048,
  });
  const fn = built.states[0].script.functionByName("increment")!;
  const unroll = CSVMultisigTapscript.encode({
    pubkeys: [hex.decode(H)],
    timelock: { type: "seconds", value: 2048n },
  });
  const tx = buildOffchainTx(
    [
      {
        txid: "ab".repeat(32),
        vout: 0,
        value: 1000,
        tapLeafScript: fn.tapLeafScript,
        tapTree: built.states[0].script.encode(),
      },
    ],
    [{ script: hex.decode(built.states[1].pkScript), amount: 1000n }],
    unroll,
  );
  const request: [string, string[]] = [
    base64.encode(tx.arkTx.toPSBT()),
    tx.checkpoints.map((c) => base64.encode(c.toPSBT())),
  ];
  const record: VaultJournalEntry = {
    operationId: "original",
    operation: "increment",
    scope: "scope",
    network: "signet",
    createdAt: 1,
    phase: "submitting",
    transactionId: tx.arkTx.id,
    expectedInput: { transactionId: "ab".repeat(32), outputIndex: 0 },
    recovery: [{ target: "emulator", request }],
  };
  const calls: unknown[] = [];
  const dependencies = {
    ark: {
      submitTx: async () => {
        throw Error("must not create");
      },
      getPendingTxs: async () => {
        throw Error("must not query another account");
      },
      finalizeTx: async (...args: unknown[]) => {
        calls.push(["finalize", ...args]);
      },
    },
    emulator: {
      submitTx: async (...args: unknown[]) => {
        calls.push(["emulator", ...args]);
        return { signedArkTx: request[0], signedCheckpointTxs: request[1] };
      },
    },
    persistFinalization: async () => {
      throw Error("must not replace");
    },
  };
  return { record, request, calls, dependencies };
}
test("interrupted mutation replays only its exact protected request, never a new spend", async () => {
  const f = fixture();
  await replayOriginalVaultRequest(f.record, f.dependencies);
  assert.deepEqual(f.calls, [["emulator", ...f.request]]);
  // A lost acknowledgement can be replayed after restart without creating a new ID.
  await replayOriginalVaultRequest(structuredClone(f.record), f.dependencies);
  assert.deepEqual(f.calls[1], f.calls[0]);
});
test("altered original ID, checkpoint and absent preparation fail before any financial request", async () => {
  for (const edit of [
    (r: VaultJournalEntry) => {
      r.transactionId = "cd".repeat(32);
    },
    (r: VaultJournalEntry) => {
      r.expectedInput!.outputIndex = 1;
    },
    (r: VaultJournalEntry) => {
      r.recovery = [];
    },
  ]) {
    const f = fixture();
    edit(f.record);
    await assert.rejects(replayOriginalVaultRequest(f.record, f.dependencies));
    assert.equal(f.calls.length, 0);
  }
});
test("original finalization has priority and cannot replace checkpoint IDs", async () => {
  const f = fixture();
  f.record.recovery.push({
    target: "finalize",
    request: [f.record.transactionId!, f.request[1]],
  });
  await replayOriginalVaultRequest(f.record, f.dependencies);
  assert.deepEqual(f.calls, [
    ["finalize", f.record.transactionId, f.request[1]],
  ]);
  const wrong = fixture();
  wrong.record.recovery.push({
    target: "finalize",
    request: [wrong.record.transactionId!, []],
  });
  await assert.rejects(
    replayOriginalVaultRequest(wrong.record, wrong.dependencies),
  );
  assert.equal(wrong.calls.length, 0);
});

test("lost funding acknowledgement signs every BIP-322 proof input and finalizes only matching checkpoints", async () => {
  const creator = SingleKey.fromHex("1".padStart(64, "0")),
    server = SingleKey.fromHex("2".padStart(64, "0"));
  const script = new DefaultVtxo.Script({
    pubKey: hex.decode(G),
    serverPubKey: hex.decode(H),
    csvTimelock: { type: "seconds", value: 2048n },
  });
  const unroll = CSVMultisigTapscript.encode({
    pubkeys: [hex.decode(H)],
    timelock: { type: "seconds", value: 2048n },
  });
  const built = compileConditionalVault({
    network: "signet",
    id: "0000",
    creatorKey: G,
    creatorDestination: H,
    serverKey: H,
    emulatorKey: G,
    deadline: 2000000000,
    exitDelaySeconds: 2048,
  });
  const original = buildOffchainTx(
    [
      {
        txid: "ab".repeat(32),
        vout: 0,
        value: 1000,
        tapLeafScript: script.forfeit(),
        tapTree: script.encode(),
      },
    ],
    [{ script: hex.decode(built.states[0].pkScript), amount: 1000n }],
    unroll,
  );
  const signedArk = await creator.sign(original.arkTx, [0]);
  const finalArk = await server.sign(signedArk, [0]);
  const serverCheckpoint = await server.sign(original.checkpoints[0], [0]);
  const record: VaultJournalEntry = {
    operationId: "interrupted-create",
    operation: "create",
    scope: "scope",
    network: "signet",
    phase: "submitting",
    createdAt: 1,
    expectedScript: built.states[0].pkScript,
    transactionId: signedArk.id,
    draft: { parameters: JSON.stringify(built.parameters) },
    recovery: [
      {
        target: "operator",
        request: [
          base64.encode(signedArk.toPSBT()),
          original.checkpoints.map((tx) => base64.encode(tx.toPSBT())),
        ],
      },
    ],
  };
  const events: string[] = [];
  await replayOriginalVaultRequest(record, {
    identity: creator,
    emulator: {
      submitTx: async () => {
        throw Error("must not call");
      },
    },
    ark: {
      submitTx: async () => {
        throw Error("duplicate original transaction");
      },
      getPendingTxs: async (request) => {
        const proof = Transaction.fromPSBT(base64.decode(request.proof));
        assert.equal(proof.inputsLength, 2);
        for (let index = 0; index < proof.inputsLength; index++)
          verifyTapscriptSignatures(proof, index, [G], [], [0, 1]);
        events.push("proof");
        return [
          {
            arkTxid: signedArk.id,
            finalArkTx: base64.encode(finalArk.toPSBT()),
            signedCheckpointTxs: [base64.encode(serverCheckpoint.toPSBT())],
          },
        ];
      },
      finalizeTx: async (id, checkpoints) => {
        assert.equal(id, signedArk.id);
        const checkpoint = Transaction.fromPSBT(base64.decode(checkpoints[0]));
        assert.equal(checkpoint.id, original.checkpoints[0].id);
        verifyTapscriptSignatures(checkpoint, 0, [G, H]);
        events.push("finalize");
      },
    },
    persistFinalization: async () => {
      events.push("protected");
    },
  });
  assert.deepEqual(events, ["proof", "protected", "finalize"]);
});
