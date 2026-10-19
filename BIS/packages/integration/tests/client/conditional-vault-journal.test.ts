import test from "node:test";
import assert from "node:assert/strict";
import {
  createVaultJournal,
  type VaultJournalBackend,
} from "../../src/client/state-layer-core/conditional-vault-journal.ts";
test("private recovery encrypts before storage and retains signed checkpoints across restart", async () => {
  let stored: Awaited<ReturnType<VaultJournalBackend["read"]>>;
  const backend: VaultJournalBackend = {
    read: async () => stored,
    write: async (value, revision) => {
      assert.equal(stored?.revision ?? 0, revision);
      stored = value;
    },
  };
  const lock = async <T>(use: () => Promise<T>) => use();
  const journal = createVaultJournal("signet", backend, lock);
  await journal.transaction((entries) =>
    entries.push({
      operationId: "operation-a",
      operation: "increment",
      scope: "public-scope",
      network: "signet",
      createdAt: 1,
      phase: "prepared",
      recovery: [],
    }),
  );
  await journal.transaction((entries) => {
    entries[0].phase = "submitting";
    entries[0].recovery.push({
      target: "emulator",
      request: ["private-signed-fixture", ["checkpoint-fixture"]],
    });
  });
  assert.equal(stored!.key.extractable, false);
  assert.equal(
    Buffer.from(stored!.ciphertext).includes(
      Buffer.from("private-signed-fixture"),
    ),
    false,
  );
  const restarted = createVaultJournal("signet", backend, lock);
  assert.equal(
    (await restarted.transaction((entries) => entries[0])).recovery.length,
    1,
  );
  await assert.rejects(
    restarted.transaction((entries) => {
      entries[0].recovery = [];
    }),
    /history-mismatch/,
  );
  await assert.rejects(
    restarted.transaction((entries) => {
      entries.length = 0;
    }),
    /history-mismatch/,
  );
  await assert.rejects(
    restarted.transaction((entries) => {
      entries[0].scope = "other-wallet";
    }),
    /history-mismatch/,
  );
});
test("wrong network and corrupted ciphertext cannot reveal or replace a journal", async () => {
  let stored: Awaited<ReturnType<VaultJournalBackend["read"]>>;
  const backend: VaultJournalBackend = {
    read: async () => stored,
    write: async (v) => {
      stored = v;
    },
  };
  const lock = async <T>(f: () => Promise<T>) => f();
  await createVaultJournal("signet", backend, lock).transaction((entries) =>
    entries.push({
      operationId: "one",
      operation: "create",
      scope: "scope",
      network: "signet",
      createdAt: 1,
      phase: "prepared",
      recovery: [],
    }),
  );
  await assert.rejects(
    createVaultJournal("mutinynet", backend, lock).transaction(
      (entries) => entries,
    ),
  );
  const corrupted = new Uint8Array(stored!.ciphertext.slice(0));
  corrupted[0] ^= 1;
  stored = { ...stored!, ciphertext: corrupted.buffer };
  await assert.rejects(
    createVaultJournal("signet", backend, lock).transaction(
      (entries) => entries,
    ),
  );
});
