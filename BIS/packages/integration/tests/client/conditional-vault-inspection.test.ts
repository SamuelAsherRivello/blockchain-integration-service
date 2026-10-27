import test from "node:test";
import assert from "node:assert/strict";
import { Transaction } from "@arkade-os/sdk";
import { hex, base64 } from "@scure/base";
import { descriptorFixture } from "./conditional-vault-descriptor.test.ts";
import {
  vaultDescriptorHash,
  compileVaultDescriptor,
} from "../../src/client/wallet-layer-arkade/conditional-vault-descriptor.ts";
import { inspectConditionalVault } from "../../src/client/wallet-layer-arkade/conditional-vault-inspection.ts";

export async function fixture(
  network: "signet" | "mutinynet",
  terminal: "claim" | "recover" | null,
  steps = 3,
) {
  let descriptor = await descriptorFixture(network);
  const archive = new Map<string, Transaction>(),
    coins: any[] = [];
  function transaction(
    previous: string,
    index: number,
    outputs: Array<{ script: string; amount: bigint }>,
    leaf?: Uint8Array,
  ) {
    const tx = new Transaction({
      allowUnknownOutputs: true,
      allowUnknownInputs: true,
    });
    tx.addInput({
      txid: previous,
      index,
      ...(leaf
        ? {
            tapLeafScript: [
              [
                {
                  version: 192,
                  internalKey: new Uint8Array(32),
                  merklePath: [],
                },
                leaf,
              ],
            ],
          }
        : {}),
    });
    for (const output of outputs)
      tx.addOutput({
        script: hex.decode(output.script),
        amount: output.amount,
      });
    archive.set(tx.id, tx);
    return tx;
  }
  const funding = transaction("ab".repeat(32), 0, [
    { script: descriptor.stateScripts[0], amount: 1000n },
  ]);
  descriptor = {
    ...descriptor,
    funding: { transactionId: funding.id, outputIndex: 0 },
  };
  descriptor = { ...descriptor, hash: await vaultDescriptorHash(descriptor) };
  let current = funding;
  const built = compileVaultDescriptor(descriptor);
  for (let progress = 0; progress <= steps; progress++) {
    const coin = {
      txid: current.id,
      vout: 0,
      value: 1000,
      script: descriptor.stateScripts[progress],
      isSpent: false,
      isSwept: false,
      isUnrolled: false,
      assets: [],
    };
    coins.push(coin);
    const last = progress === steps;
    if (last && !terminal) break;
    const checkpoint = transaction(current.id, 0, [
      { script: descriptor.stateScripts[progress], amount: 1000n },
      { script: "51024e73", amount: 0n },
    ]);
    const fn = built.states[progress].functions.find(
      (f) => f.name === (last ? terminal : "increment"),
    )!;
    const leaf = Uint8Array.from([...hex.decode(fn.tapscript), 192]);
    const destination = last
      ? descriptor.creatorDestination
      : descriptor.stateScripts[progress + 1];
    const spent = transaction(
      checkpoint.id,
      0,
      [
        { script: destination, amount: 1000n },
        { script: "6a", amount: 0n },
        { script: "51024e73", amount: 0n },
      ],
      leaf,
    );
    Object.assign(coin, {
      isSpent: true,
      spentBy: checkpoint.id,
      arkTxId: spent.id,
    });
    current = spent;
    if (last) {
      coins.push({
        txid: spent.id,
        vout: 0,
        value: 1000,
        script: descriptor.creatorDestination,
      });
      break;
    }
  }
  const calls: string[] = [];
  const dependencies = {
    now: () => 1_900_000_000_000,
    ark: { getInfo: async () => ({ network }) },
    indexer: {
      getVtxos: async ({ scripts, outpoints }: any) => {
        calls.push("read-coins");
        return {
          vtxos: coins.filter((c) =>
            scripts
              ? scripts.includes(c.script)
              : outpoints.some((p) => p.txid === c.txid && p.vout === c.vout),
          ),
        };
      },
      getVirtualTxs: async (ids: string[]) => {
        calls.push("read-transactions");
        return {
          txs: ids.flatMap((id) =>
            archive.has(id) ? [base64.encode(archive.get(id)!.toPSBT())] : [],
          ),
        };
      },
    },
  };
  return { descriptor, dependencies, archive, coins, calls };
}
for (const network of ["signet", "mutinynet"] as const)
  test(`${network}: public inspection verifies the checkpoint-to-Ark graph and creator receipt`, async () => {
    for (const terminal of ["claim", "recover", null] as const) {
      const f = await fixture(network, terminal);
      const result = await inspectConditionalVault(
        f.descriptor,
        f.dependencies as never,
      );
      assert.equal(
        result.status,
        terminal === "claim"
          ? "claimed"
          : terminal === "recover"
            ? "recovered"
            : "claimable",
      );
      assert.equal(result.progress, 3);
      assert.equal(result.evidence.length, terminal ? 4 : 3);
      assert.ok(f.calls.every((call) => call.startsWith("read-")));
    }
  });
for (const network of ["signet", "mutinynet"] as const)
  test(`${network}: missing receipt, unavailable archive, changed principal and wrong network never prove completion`, async () => {
    const missing = await fixture(network, "claim");
    missing.coins.pop();
    assert.equal(
      (
        await inspectConditionalVault(
          missing.descriptor,
          missing.dependencies as never,
        )
      ).status,
      "pending",
    );
    const archive = await fixture(network, "claim");
    archive.archive.delete(archive.descriptor.funding.transactionId);
    assert.equal(
      (
        await inspectConditionalVault(
          archive.descriptor,
          archive.dependencies as never,
        )
      ).status,
      "unavailable",
    );
    const amount = await fixture(network, null, 0);
    amount.coins[0].value = 999;
    assert.equal(
      (
        await inspectConditionalVault(
          amount.descriptor,
          amount.dependencies as never,
        )
      ).status,
      "conflict",
    );
    const mismatch = await fixture(network, null, 0);
    mismatch.dependencies.ark.getInfo = async () => ({
      network: network === "signet" ? "mutinynet" : "signet",
    });
    assert.equal(
      (
        await inspectConditionalVault(
          mismatch.descriptor,
          mismatch.dependencies as never,
        )
      ).status,
      "unavailable",
    );
  });
test("expiry recovery receipts work at every progress and absence is not a claimed flag", async () => {
  for (let progress = 0; progress <= 3; progress++) {
    const f = await fixture("mutinynet", "recover", progress);
    assert.equal(
      (await inspectConditionalVault(f.descriptor, f.dependencies as never))
        .status,
      "recovered",
    );
    f.coins.length = 0;
    assert.equal(
      (await inspectConditionalVault(f.descriptor, f.dependencies as never))
        .status,
      "unknown",
    );
  }
});
