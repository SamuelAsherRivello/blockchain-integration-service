import test from "node:test";
import assert from "node:assert/strict";
import { createArkadeConditionalVaultApi } from "../../src/client/wallet-layer-arkade/conditional-vault-api.ts";
import type { VaultJournalEntry } from "../../src/client/state-layer-core/conditional-vault-journal.ts";
import type { VaultInspection } from "../../src/client/state-layer-core/conditional-vault.ts";
import { descriptorFixture } from "./conditional-vault-descriptor.test.ts";

async function fixture(network: "signet" | "mutinynet" = "signet") {
  const descriptor = await descriptorFixture(network),
    rows: VaultJournalEntry[] = [],
    events: string[] = [];
  let status: VaultInspection["status"] = "claimable",
    identity = descriptor.creatorPublicKey,
    walletNetwork: string = network;
  const api = createArkadeConditionalVaultApi(
    network,
    async () => {
      events.push("lease");
      return {
        wallet: {
          identity: {
            xOnlyPublicKey: async () => Buffer.from(identity, "hex"),
          },
          arkProvider: {
            getInfo: async () => ({
              network: walletNetwork,
              signerPubkey: `02${descriptor.operatorPublicKey}`,
            }),
          },
        } as never,
        release: async () => {
          events.push("release");
        },
      };
    },
    {
      journal: { transaction: async (use) => use(rows) },
      lock: async (_key, work) => work(),
      inspect: async (value) => ({
        descriptor: value,
        status,
        progress: status === "locked" ? 0 : 3,
        activeOutput: descriptor.funding,
        evidence: [],
        checkedAt: 1,
      }),
    },
  );
  return {
    api,
    descriptor,
    rows,
    events,
    setStatus: (value: typeof status) => {
      status = value;
    },
    wrongIdentity: () => {
      identity = descriptor.operatorPublicKey;
    },
    wrongNetwork: () => {
      walletNetwork = network === "signet" ? "mutinynet" : "signet";
    },
  };
}
for (const network of ["signet", "mutinynet"] as const)
  test(`${network}: wrong creator, wallet network and expected input fail before submission`, async () => {
    const f = await fixture(network);
    f.wrongIdentity();
    const request = {
      operationId: "wrong-creator",
      descriptor: f.descriptor,
      expectedOutput: f.descriptor.funding,
      walletReference: "wrong",
    };
    const denied = await f.api.claim(request);
    assert.equal(denied.outcome, "rejected");
    assert.equal(denied.reason, "vault-creator-identity-mismatch");
    assert.deepEqual(f.events, ["lease", "release"]);
    assert.equal(f.rows[0].recovery.length, 0);
    assert.equal((await f.api.claim(request)).outcome, "rejected");
    assert.equal(f.events.length, 2);
    const other = await fixture(network);
    other.wrongNetwork();
    assert.equal(
      (
        await other.api.claim({
          ...request,
          descriptor: other.descriptor,
          expectedOutput: other.descriptor.funding,
        })
      ).reason,
      "vault-wallet-network-mismatch",
    );
    assert.equal(other.rows[0].recovery.length, 0);
    const mismatch = await fixture(network);
    assert.equal(
      (
        await mismatch.api.increment({
          operationId: "bad-input",
          descriptor: mismatch.descriptor,
          expectedOutput: { transactionId: "cd".repeat(32), outputIndex: 0 },
        })
      ).reason,
      "vault-expected-outpoint-mismatch",
    );
    assert.equal(mismatch.rows.length, 0);
  });
test("duplicate create and operation-intent conflicts never acquire another financial request", async () => {
  const f = await fixture();
  f.setStatus("locked");
  const scope = `signet:5:${f.descriptor.creatorPublicKey}:0000`;
  f.rows.push({
    operationId: "original",
    operation: "create",
    scope,
    network: "signet",
    createdAt: 1,
    phase: "verified",
    descriptor: f.descriptor,
    recovery: [],
  });
  await assert.rejects(
    f.api.create({
      operationId: "duplicate",
      network: "signet",
      id: "0000",
      walletReference: "creator",
      durationSeconds: 120,
    }),
    /^Error: VaultID 0000 is already taken\.$/,
  );
  assert.equal(f.rows.length, 1);
  assert.equal(f.rows[0].recovery.length, 0);
  await assert.rejects(
    f.api.increment({
      operationId: "original",
      descriptor: f.descriptor,
      expectedOutput: f.descriptor.funding,
    }),
    /intent-conflict/,
  );
});
test("a rejected unsubmitted Create permits a new attempt, while a protected request still blocks it", async (t) => {
  const f = await fixture();
  const scope = `signet:5:${f.descriptor.creatorPublicKey}:0000`;
  const original: VaultJournalEntry = {
    operationId: 'insufficient', operation: 'create', scope, network: 'signet',
    createdAt: 1, phase: 'rejected', recovery: [],
  };
  f.rows.push(original);
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => { requests++; throw new Error('capability unavailable'); });
  const request = { operationId: 'retry', network: 'signet' as const, id: '0000', walletReference: 'creator', durationSeconds: 120 };
  await assert.rejects(f.api.create(request), error => {
    assert.doesNotMatch(String(error), /already taken/);
    return true;
  });
  assert.ok(requests > 0);
  original.recovery.push({ target: 'operator', request: ['protected'] });
  await assert.rejects(f.api.create({ ...request, operationId: 'competing' }), /already taken/);
});
test("interrupted preparation is rejected truthfully without a replacement spend", async () => {
  const f = await fixture();
  f.setStatus("locked");
  f.rows.push({
    operationId: "prepared",
    operation: "increment",
    scope: `signet:5:${f.descriptor.creatorPublicKey}:0000`,
    network: "signet",
    createdAt: 1,
    phase: "prepared",
    descriptor: f.descriptor,
    expectedInput: f.descriptor.funding,
    recovery: [],
  });
  const result = await f.api.increment({
    operationId: "prepared",
    descriptor: f.descriptor,
    expectedOutput: f.descriptor.funding,
  });
  assert.equal(result.outcome, "rejected");
  assert.equal(result.reason, "vault-original-request-not-submitted");
  assert.equal(f.rows[0].phase, "rejected");
  assert.equal(f.events.length, 0);
});

for (const network of ["signet", "mutinynet"] as const)
  test(`${network}: unavailable, pending, expired and early claims never sign or report success`, async () => {
    for (const status of [
      "locked",
      "expired",
      "pending",
      "unknown",
      "unavailable",
      "conflict",
    ] as const) {
      const f = await fixture(network);
      f.setStatus(status);
      const result = await f.api.claim({
        operationId: `blocked-${status}`,
        descriptor: f.descriptor,
        expectedOutput: f.descriptor.funding,
        walletReference: "creator",
      });
      assert.equal(result.outcome, "rejected");
      assert.equal(result.reason, "vault-state-does-not-permit-operation");
      assert.equal(f.rows.length, 0);
      assert.equal(f.events.length, 0);
    }
  });

test("expired unknown submissions retain their reservation instead of permitting a competing refund", async () => {
  const f = await fixture();
  f.setStatus("expired");
  f.rows.push({
    operationId: "unknown-original",
    operation: "increment",
    scope: `signet:5:${f.descriptor.creatorPublicKey}:0000`,
    network: "signet",
    createdAt: 1,
    phase: "pending",
    descriptor: f.descriptor,
    expectedInput: f.descriptor.funding,
    recovery: [],
  });
  await assert.rejects(
    f.api.recover({
      operationId: "competing-refund",
      descriptor: f.descriptor,
      expectedOutput: f.descriptor.funding,
      walletReference: "creator",
    }),
    /original-operation-unresolved/,
  );
  assert.equal(f.rows.length, 1);
  assert.equal(f.rows[0].phase, "pending");
  assert.equal(f.events.length, 0);
});

test("wallet initialization errors cannot expose provider payloads through Create", async () => {
  const api = createArkadeConditionalVaultApi(
    "signet",
    async () => {
      throw Error("raw provider payload must not escape");
    },
    {
      journal: { transaction: async (use) => use([]) },
      lock: async (_key, work) => work(),
    },
  );
  const result = await api.create({
    network: "signet",
    id: "0000",
    operationId: "wallet-unavailable",
    walletReference: "creator",
    durationSeconds: 120,
  });
  assert.equal(result.outcome, "unavailable");
  assert.equal(result.reason, "vault-network-operation-unavailable");
  assert.doesNotMatch(JSON.stringify(result), /raw provider payload/);
});
