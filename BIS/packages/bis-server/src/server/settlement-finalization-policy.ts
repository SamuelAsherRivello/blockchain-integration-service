import { isDeepStrictEqual } from 'node:util';
import { Transaction, TxTree, VtxoScript, buildForfeitTx, validateConnectorsTxGraph, type IntentCoin, type TapLeafScript } from '@arkade-os/sdk';
import { Transaction as BitcoinTransaction } from '@scure/btc-signer';
import { RawPSBTV0 } from '@scure/btc-signer/psbt.js';
import { assertCanonicalSigningTransaction } from './offchain-policy.ts';

export type SettlementFinalizationSource = Readonly<{
  txid: string; vout: number; value: number; script: Uint8Array;
  forfeitTapLeafScript: TapLeafScript; kind: 'boarding' | 'virtual';
}>;
export type TrustedSettlementFinalization = Readonly<{
  /** Must come from the original sealed, recipient-validated batch plan. */
  commitmentId: string;
  sources: readonly SettlementFinalizationSource[];
  dustAmount: bigint;
  /** Derived from the fixed network operator's public info, never a client destination. */
  forfeitScript: Uint8Array;
}>;
const deny = () => Error('Settlement finalization is outside the signing policy.');
const hex = (value: Uint8Array) => Buffer.from(value).toString('hex');
const point = (txid: string, vout: number) => `${txid}:${vout}`;

/** Called with already verified initial sources. This is not a source reader,
 * signing grant, journal, transaction submission or proof of settlement.
 */
export function settlementFinalizationSources(inputs: readonly IntentCoin[], bitcoinScript: Uint8Array, arkadeScript: Uint8Array): SettlementFinalizationSource[] {
  return inputs.map(input => {
    const script = VtxoScript.decode(input.tapTree).pkScript;
    const kind = isDeepStrictEqual(script, bitcoinScript) ? 'boarding' : isDeepStrictEqual(script, arkadeScript) ? 'virtual' : undefined;
    // Current verified sources are DefaultVtxo scripts: intent and forfeit use
    // the same cooperative leaf. No arbitrary contract source is admitted here.
    const forfeitTapLeafScript = input.forfeitTapLeafScript ?? input.intentTapLeafScript;
    if (!kind || !forfeitTapLeafScript) throw deny();
    return { txid: input.txid, vout: input.vout, value: input.value, script, forfeitTapLeafScript, kind };
  });
}

function boundedTransaction(tx: Transaction, maxInputs = 1000) {
  if (!(tx instanceof BitcoinTransaction) || tx.inputsLength < 1 || tx.inputsLength > maxInputs || tx.outputsLength < 1 || tx.outputsLength > 1000 || tx.toPSBT().length > 512 * 1024) throw deny();
}

/** Bound recursive SDK traversal first, then verify the original commitment's
 * connector-output link and amounts. The SDK alone does not check root value.
 */
function connectorLeaves(commitment: Transaction, tree: TxTree) {
  if (!(tree instanceof TxTree)) throw deny();
  const pending = [{ node: tree, depth: 0 }], seen = new Set<TxTree>(), ids = new Set<string>();
  let size = 0;
  while (pending.length) {
    const { node, depth } = pending.pop()!;
    if (!(node instanceof TxTree) || seen.has(node) || seen.size >= 100 || depth > 32) throw deny();
    seen.add(node); boundedTransaction(node.root, 1);
    if (ids.has(node.root.id)) throw deny();
    ids.add(node.root.id); size += node.root.toPSBT().length;
    if (size > 512 * 1024) throw deny();
    for (const [index, child] of node.children) {
      if (!Number.isSafeInteger(index) || index < 0 || index >= node.root.outputsLength) throw deny();
      pending.push({ node: child, depth: depth + 1 });
    }
  }
  validateConnectorsTxGraph(Buffer.from(commitment.toPSBT()).toString('base64'), tree);
  const output = commitment.getOutput(1);
  if (!output.script || !output.amount || output.amount <= 0n) throw deny();
  let sum = 0n;
  for (let i = 0; i < tree.root.outputsLength; i++) sum += tree.root.getOutput(i).amount ?? 0n;
  if (sum !== output.amount) throw deny();
  return tree.leaves();
}

/** Reconstruct exactly the SDK's Game commitment-input or forfeit transaction.
 * Foreign signatures are ignored for equality and retained by the signer.
 * Financial exposure remains the original plan's fee, not shared batch value.
 */
export function validateSettlementFinalization(actual: Transaction, indexes: unknown, candidate: { commitment: Transaction; connectors?: TxTree }, trusted: TrustedSettlementFinalization) {
  try {
    boundedTransaction(actual); boundedTransaction(candidate.commitment);
    if (!/^[a-f0-9]{64}$/.test(trusted.commitmentId) || candidate.commitment.id !== trusted.commitmentId ||
        !Array.isArray(trusted.sources) || !trusted.sources.length || trusted.sources.length > 100 ||
        typeof trusted.dustAmount !== 'bigint' || trusted.dustAmount <= 0n || !(trusted.forfeitScript instanceof Uint8Array) || !trusted.forfeitScript.length || trusted.forfeitScript.length > 10000 ||
        !Array.isArray(indexes) || !indexes.length || indexes.length > 100 || indexes.some((value, index) => !Number.isSafeInteger(value) || value < 0 || value >= actual.inputsLength || index > 0 && value <= indexes[index - 1])) throw deny();
    const sources = new Map<string, SettlementFinalizationSource>();
    for (const source of trusted.sources) {
      if (!/^[a-f0-9]{64}$/.test(source.txid) || !Number.isSafeInteger(source.vout) || source.vout < 0 || source.vout > 0xffffffff ||
          !Number.isSafeInteger(source.value) || source.value <= 0 || !['boarding', 'virtual'].includes(source.kind) ||
          !(source.script instanceof Uint8Array) || !source.script.length || !source.forfeitTapLeafScript || sources.has(point(source.txid, source.vout))) throw deny();
      sources.set(point(source.txid, source.vout), source);
    }
    const spent = new Set<string>(), boarding = new Map<number, SettlementFinalizationSource>();
    for (let i = 0; i < candidate.commitment.inputsLength; i++) {
      const input = candidate.commitment.getInput(i);
      if (!input.txid || input.index === undefined) throw deny();
      const id = point(hex(input.txid), input.index);
      if (spent.has(id)) throw deny();
      spent.add(id);
      const source = sources.get(id);
      if (source?.kind === 'boarding') boarding.set(i, source);
      else if (source) throw deny(); // Arkade sources settle through forfeits, not Bitcoin inputs.
    }
    if ([...sources].some(([id, source]) => source.kind === 'boarding' && !spent.has(id))) throw deny();
    if (actual.id === trusted.commitmentId) {
      const canonical = new Transaction({ version: actual.version, lockTime: actual.lockTime });
      for (let i = 0; i < actual.inputsLength; i++) {
        const input = actual.getInput(i), source = boarding.get(i);
        if (indexes.includes(i) && !source) throw deny();
        if (source && indexes.includes(i)) {
          if (input.sighashType !== undefined && input.sighashType !== 0) throw deny();
          canonical.addInput({ txid: source.txid, index: source.vout, sequence: input.sequence,
            witnessUtxo: { amount: BigInt(source.value), script: source.script }, tapLeafScript: [source.forfeitTapLeafScript],
            ...(input.sighashType === 0 ? { sighashType: 0 } : {}) });
        } else canonical.addInput(Object.fromEntries(Object.entries(input).filter(([key]) => !['partialSig', 'tapScriptSig', 'tapKeySig'].includes(key))));
      }
      for (let i = 0; i < actual.outputsLength; i++) canonical.addOutput(actual.getOutput(i));
      assertCanonicalSigningTransaction(actual, canonical);
      if (!isDeepStrictEqual(RawPSBTV0.decode(actual.toPSBT(0)).global, RawPSBTV0.decode(canonical.toPSBT(0)).global)) throw deny();
      return Object.freeze({ kind: 'commitment' as const, indexes: Object.freeze([...indexes]) });
    }
    if (!candidate.connectors || indexes.length !== 1 || indexes[0] !== 0) throw deny();
    const leaves = connectorLeaves(candidate.commitment, candidate.connectors);
    const virtual = trusted.sources.filter(source => source.kind === 'virtual' && BigInt(source.value) >= trusted.dustAmount);
    if (!virtual.length || leaves.length < virtual.length) throw deny();
    const canonicals = virtual.map((source, index) => {
      const connector = leaves[index], output = connector.getOutput(0);
      if (!output.script || !output.amount || output.amount <= 0n) throw deny();
      return buildForfeitTx([{ txid: source.txid, index: source.vout,
        witnessUtxo: { amount: BigInt(source.value), script: source.script }, sighashType: 0, tapLeafScript: [source.forfeitTapLeafScript] },
      { txid: connector.id, index: 0, witnessUtxo: { amount: output.amount, script: output.script } }], trusted.forfeitScript);
    });
    const canonical = canonicals.find(tx => tx.id === actual.id);
    if (!canonical) throw deny();
    assertCanonicalSigningTransaction(actual, canonical);
    if (!isDeepStrictEqual(RawPSBTV0.decode(actual.toPSBT(0)).global, RawPSBTV0.decode(canonical.toPSBT(0)).global)) throw deny();
    return Object.freeze({ kind: 'forfeit' as const, indexes: Object.freeze([0]) });
  } catch { throw deny(); }
}
