import {
  RestArkProvider,
  RestIndexerProvider,
  Transaction,
} from "@arkade-os/sdk";
import { hex, base64 } from "@scure/base";
import type {
  VaultPublicDescriptor,
  VaultInspection,
  VaultOutpoint,
  VaultEvidence,
} from "../state-layer-core/conditional-vault.ts";
import { testNetwork } from "../state-layer-core/test-network.ts";
import { validateVaultDescriptor } from "./conditional-vault-descriptor.ts";

export function decodeVaultTransaction(raw: string) {
  if (raw.length > 4_000_000) throw Error("vault-evidence-too-large");
  return /^[0-9a-f]+$/i.test(raw)
    ? Transaction.fromRaw(hex.decode(raw))
    : Transaction.fromPSBT(base64.decode(raw));
}
/** Network reads only. Never finalizes, signs, replays, or infers success from absence. */
export async function inspectConditionalVault(
  input: VaultPublicDescriptor,
  dependencies = {
    ark: new RestArkProvider(testNetwork(input.network).operator),
    indexer: new RestIndexerProvider(testNetwork(input.network).operator),
    now: () => Date.now(),
  },
): Promise<VaultInspection> {
  const descriptor = await validateVaultDescriptor(input);
  const evidence: VaultEvidence[] = [];
  // Fetch one network snapshot for all immutable state scripts. Batch transaction
  // reads avoid serial round trips consuming the two-minute signing window.
  const transactions = new Map<string, Transaction>();
  const result = (
    status: VaultInspection["status"],
    progress: number | null,
    activeOutput: VaultOutpoint | null,
    reason?: string,
  ): VaultInspection => ({
    descriptor,
    status,
    progress,
    activeOutput,
    evidence,
    checkedAt: dependencies.now(),
    ...(reason ? { reason } : {}),
  });
  async function transaction(id: string) {
    if (!/^[a-f0-9]{64}$/.test(id))
      throw Error("vault-evidence-invalid-transaction-id");
    const cached = transactions.get(id);
    if (cached) return cached;
    const response = await dependencies.indexer.getVirtualTxs([id]);
    const matches = response.txs
      .map(decodeVaultTransaction)
      .filter((t) => t.id === id);
    if (matches.length !== 1)
      throw Error("vault-evidence-transaction-unavailable");
    return matches[0];
  }
  async function consumes(tx: Transaction, prior: VaultOutpoint) {
    if (tx.inputsLength !== 1) return false;
    const input = tx.getInput(0);
    if (!input.txid || input.index !== 0) return false;
    const checkpoint = await transaction(hex.encode(input.txid));
    if (checkpoint.inputsLength !== 1 || checkpoint.outputsLength !== 2)
      return false;
    const previous = checkpoint.getInput(0);
    return (
      previous.txid &&
      hex.encode(previous.txid) === prior.transactionId &&
      previous.index === prior.outputIndex &&
      checkpoint.getOutput(0).amount === 1000n &&
      hex.encode(checkpoint.getOutput(1).script ?? new Uint8Array()) ===
        "51024e73"
    );
  }
  try {
    const [info, snapshot] = await Promise.all([
      dependencies.ark.getInfo(),
      dependencies.indexer.getVtxos({ scripts: [...descriptor.stateScripts] }),
    ]);
    if (info.network !== descriptor.network)
      return result("unavailable", null, null, "vault-network-mismatch");
    if (snapshot.page && snapshot.page.total > 1)
      return result("unavailable", null, null, "vault-state-history-paginated");
    const ids = [
      ...new Set([
        descriptor.funding.transactionId,
        ...snapshot.vtxos.flatMap((coin) =>
          coin.isSpent
            ? [coin.spentBy, coin.arkTxId].filter((id): id is string =>
                Boolean(id),
              )
            : [],
        ),
      ]),
    ];
    if (ids.length > 32)
      return result("conflict", null, null, "vault-ambiguous-state-history");
    const archive = await dependencies.indexer.getVirtualTxs(ids);
    for (const raw of archive.txs) {
      const tx = decodeVaultTransaction(raw);
      if (!ids.includes(tx.id) || transactions.has(tx.id))
        throw Error("vault-evidence-archive-conflict");
      transactions.set(tx.id, tx);
    }
    let current = descriptor.funding;
    const funding = await transaction(current.transactionId);
    const initial = funding.getOutput(current.outputIndex);
    if (
      initial.amount !== 1000n ||
      !initial.script ||
      hex.encode(initial.script) !== descriptor.stateScripts[0]
    )
      return result("conflict", null, null, "vault-funding-mismatch");
    for (let progress = 0; progress <= 3; progress++) {
      const matches = snapshot.vtxos.filter(
        (coin) =>
          coin.txid === current.transactionId &&
          coin.vout === current.outputIndex,
      );
      if (matches.length !== 1)
        return result(
          "unknown",
          null,
          null,
          "vault-output-evidence-unavailable",
        );
      const coin = matches[0];
      if (
        coin.value !== 1000 ||
        coin.script !== descriptor.stateScripts[progress] ||
        coin.assets?.length
      )
        return result("conflict", null, null, "vault-output-mismatch");
      if (coin.isSwept || coin.isUnrolled)
        return result(
          "unavailable",
          progress,
          current,
          "vault-exit-or-batch-expiry",
        );
      if (!coin.isSpent) {
        if (coin.spentBy)
          return result("pending", progress, current, "vault-spend-pending");
        const expired =
          Math.floor(dependencies.now() / 1000) >= descriptor.deadline;
        return result(
          expired ? "expired" : progress === 3 ? "claimable" : "locked",
          progress,
          current,
        );
      }
      // spentBy names the checkpoint, not the Ark transaction spending it.
      if (!coin.spentBy || !coin.arkTxId)
        return result(
          "unknown",
          progress,
          null,
          "vault-spend-reference-unavailable",
        );
      const spent = await transaction(coin.arkTxId);
      if (!(await consumes(spent, current)))
        return result("conflict", null, null, "vault-spend-link-mismatch");
      const outputs = Array.from(
        { length: spent.outputsLength },
        (_, outputIndex) => {
          const output = spent.getOutput(outputIndex);
          return {
            outputIndex,
            script: hex.encode(output.script ?? new Uint8Array()),
            amountSats: String(output.amount),
          };
        },
      );
      if (
        outputs.length !== 3 ||
        outputs[2].script !== "51024e73" ||
        outputs[1].amountSats !== "0" ||
        outputs[2].amountSats !== "0" ||
        outputs[0].amountSats !== "1000"
      )
        return result("conflict", null, null, "vault-spend-layout-mismatch");
      evidence.push({
        network: descriptor.network,
        transactionId: spent.id,
        consumed: [current],
        outputs,
        source: "verified-indexer-transaction",
      });
      if (outputs[0].script === descriptor.creatorDestination) {
        const receipt = await dependencies.indexer.getVtxos({
          outpoints: [{ txid: spent.id, vout: 0 }],
        });
        if (
          !receipt.vtxos.some(
            (c) =>
              c.value === 1000 && c.script === descriptor.creatorDestination,
          )
        )
          return result(
            "pending",
            progress,
            null,
            "vault-return-receipt-pending",
          );
        // Select the proven committed leaf, not the wall-clock time of this read.
        const script = spent.getInput(0).tapLeafScript?.[0]?.[1];
        if (!script)
          return result(
            "unknown",
            progress,
            null,
            "vault-spend-branch-unavailable",
          );
        const { compileVaultDescriptor } = await import(
          "./conditional-vault-descriptor.ts"
        );
        const compiled = compileVaultDescriptor(descriptor).states[progress];
        const body = hex.encode(script.slice(0, -1));
        const branch = compiled.functions.find(
          (f) => f.tapscript === body,
        )?.name;
        if (branch === "claim" && progress === 3)
          return result("claimed", 3, null);
        if (branch === "recover") return result("recovered", progress, null);
        return result(
          "unknown",
          progress,
          null,
          "vault-return-branch-unavailable",
        );
      }
      if (
        progress === 3 ||
        outputs[0].script !== descriptor.stateScripts[progress + 1]
      )
        return result("conflict", null, null, "vault-transition-invalid");
      current = { transactionId: spent.id, outputIndex: 0 };
    }
    return result("unknown", null, null, "vault-evidence-incomplete");
  } catch {
    return result(
      "unavailable",
      null,
      null,
      "vault-network-evidence-unavailable",
    );
  }
}
