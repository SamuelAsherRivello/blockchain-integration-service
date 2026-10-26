import { ArkAddress, CSVMultisigTapscript, Estimator, Intent, Extension, Transaction, TxTree, createAssetPacket, getNetwork, hasBoardingTxExpired, isSubdust, type OffchainInput, type SettleParams, type Recipient, type TxTreeNode, type Wallet } from '@arkade-os/sdk';
import { Address, OutScript } from '@scure/btc-signer';
import type { TestNetwork } from '../state-layer-core/test-network.ts';
import type { SettlementEvent } from '@arkade-os/sdk';

export type ServerSettlement = {
  outpoints: { txid: string; vout: number }[];
  registerProof: Transaction;
  plan?: Promise<{ token: string; sessionPublicKey: string }>;
  owner?: boolean;
  connectionToken?: string;
  sessionPublicKey?: string;
  starts?: Map<string, bigint>;
  candidate?: Readonly<{ id: string; batchExpiry: bigint; commitment: Transaction; encoded: string }>;
  captureError?: boolean;
  batchPlan?: Promise<string>;
  connectorChunks?: TxTreeNode[];
  connectorChunksByBatch?: Map<string, TxTreeNode[]>;
  connectorBytes?: number;
  finalization?: Readonly<{ id: string; commitment: Transaction; connectors?: TxTree }>;
};

// SDK 0.4.79's implicit settle selector caps VTXOs at this private constant.
// Re-audit this adapter if the pinned SDK version changes.
const MAX_VTXOS_PER_SETTLEMENT = 50;

function bytesFromHex(value: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})+$/i.test(value)) throw Error('Invalid wallet settlement script.');
  return Uint8Array.from(value.match(/.{2}/g)!, byte => Number.parseInt(byte, 16));
}

/** Mirror the SDK's public no-params settle selection before server authority
 * is requested. Passing the resulting immutable-by-caller params back to the
 * SDK keeps its normal registration, batch, submission and journal flow.
 */
export async function selectImplicitServerSettlement(wallet: Wallet): Promise<SettleParams> {
  const offchainAddress = await wallet.getAddress();
  const offchainPkScript = ArkAddress.decode(offchainAddress).pkScript;
  const offchainScript = [...offchainPkScript].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const { fees, vtxoMaxAmount } = await wallet.arkProvider.getInfo();
  const estimator = new Estimator(fees.intentFee);
  const exitScript = CSVMultisigTapscript.decode(bytesFromHex(wallet.boardingTapscript.exitScript));
  const boardingTimelock = exitScript.params.timelock;
  let chainTipHeight: number | undefined;
  if (boardingTimelock.type === 'blocks') chainTipHeight = (await wallet.onchainProvider.getChainTip()).height;

  const boarding = (await wallet.getBoardingUtxos()).filter(input =>
    input.status.confirmed && !hasBoardingTxExpired(input, boardingTimelock, chainTipHeight));
  const inputs: SettleParams['inputs'] = [];
  let amount = 0;
  for (const input of boarding) {
    const fee = estimator.evalOnchainInput({ amount: BigInt(input.value) });
    if (fee.value >= input.value) continue;
    inputs.push(input);
    amount += input.value - fee.satoshis;
  }

  const spendable = await wallet.getSpendableVtxos({ withRecoverable: true, genericallySpendableOnly: true });
  const ordered = [...spendable].sort((left, right) => right.value - left.value);
  let selectedVtxos = 0;
  for (const vtxo of ordered) {
    if (selectedVtxos >= MAX_VTXOS_PER_SETTLEMENT) break;
    const expiry = vtxo.expiresAt?.getTime() ?? (vtxo.expiresAtHeight === undefined ? undefined : vtxo.expiresAtHeight * 1000);
    const feeInput: OffchainInput = { amount: BigInt(vtxo.value), type: vtxo.isSwept ? 'recoverable' : 'vtxo', weight: 0,
      birth: vtxo.createdAt, expiry: expiry === undefined ? undefined : new Date(expiry) };
    const fee = estimator.evalOffchainInput(feeInput);
    if (fee.satoshis >= vtxo.value) continue;
    const net = vtxo.value - fee.satoshis;
    if (vtxoMaxAmount >= 0n) {
      const projectedAmount = BigInt(amount + net);
      const projectedOutputFee = estimator.evalOffchainOutput({ amount: projectedAmount, script: offchainScript });
      if (projectedAmount - BigInt(projectedOutputFee.satoshis) > vtxoMaxAmount) continue;
    }
    inputs.push(vtxo);
    selectedVtxos++;
    amount += net;
  }
  if (inputs.length === 0) throw Error('No inputs found.');
  const output = { address: offchainAddress, amount: BigInt(amount) };
  const outputFee = estimator.evalOffchainOutput({ amount: output.amount, script: offchainScript });
  output.amount -= BigInt(outputFee.satoshis);
  if (isSubdust(output.amount, wallet.dustAmount)) throw Error('Output amount is below dust limit.');
  return { inputs, outputs: [output] };
}

/** The SDK invokes, but does not await, its observational event callback.
 * Capture synchronously and remember failures for the signing boundary. The
 * callback does not authorize a batch; the server validates the full candidate.
 */
export function captureServerSettlementEvent(settlement: ServerSettlement, event: SettlementEvent): void {
  if (settlement.captureError) return;
  try {
    if (event.type === 'batch_started') {
      if (typeof event.id !== 'string' || !event.id || event.id.length > 256 || typeof event.batchExpiry !== 'bigint' || event.batchExpiry < 0n || event.batchExpiry > 99999999n) throw Error();
      const starts = settlement.starts ??= new Map();
      if (starts.has(event.id) && starts.get(event.id) !== event.batchExpiry) throw Error();
      if (!starts.has(event.id) && starts.size >= 100) throw Error();
      starts.set(event.id, event.batchExpiry);
    } else if (event.type === 'tree_tx') {
      if (event.batchIndex !== 1 || typeof event.id !== 'string' || !settlement.starts?.has(event.id)) return;
      const byBatch = settlement.connectorChunksByBatch ??= new Map<string, TxTreeNode[]>();
      if (!byBatch.has(event.id) && byBatch.size >= 100) throw Error();
      const chunks = byBatch.get(event.id) ?? [];
      if (!byBatch.has(event.id)) byBatch.set(event.id, chunks);
      const chunk = event.chunk;
      if (chunks.length >= 100 || !chunk || typeof chunk.txid !== 'string' || !/^[a-f0-9]{64}$/i.test(chunk.txid) ||
          typeof chunk.tx !== 'string' || !chunk.tx || chunk.tx.length > 700000 || !chunk.children || typeof chunk.children !== 'object') throw Error();
      if (chunks.some(item => item.txid === chunk.txid)) throw Error();
      chunks.push({ txid: chunk.txid, tx: chunk.tx, children: { ...chunk.children } });
      settlement.connectorBytes = (settlement.connectorBytes ?? 0) + chunk.tx.length;
      if (settlement.connectorBytes > 700000) throw Error();
      if (settlement.candidate?.id === event.id) settlement.connectorChunks = chunks;
    } else if (event.type === 'batch_finalization') {
      if (!settlement.candidate || event.id !== settlement.candidate.id || typeof event.commitmentTx !== 'string' || !event.commitmentTx || event.commitmentTx.length > 700000 || settlement.finalization) throw Error();
      const commitment = Transaction.fromPSBT(Uint8Array.from(atob(event.commitmentTx), byte => byte.charCodeAt(0)));
      if (commitment.id !== settlement.candidate.commitment.id) throw Error();
      const connectors = settlement.connectorChunks?.length ? TxTree.create(settlement.connectorChunks) : undefined;
      settlement.finalization = Object.freeze({ id: event.id, commitment, connectors });
    } else if (event.type === 'tree_signing_started') {
      const key = settlement.sessionPublicKey;
      // Other participants' batches are not this operation's authority.
      if (!key || !Array.isArray(event.cosignersPublicKeys)) return;
      if (event.cosignersPublicKeys.length > 100) throw Error();
      const keys = event.cosignersPublicKeys.map(value => {
        if (typeof value !== 'string' || !/^(?:0[23])?[a-f0-9]{64}$/i.test(value)) throw Error();
        return value.slice(-64).toLowerCase();
      });
      if (!keys.includes(key.slice(-64))) return;
      if (new Set(keys).size !== keys.length) throw Error();
      const batchExpiry = settlement.starts?.get(event.id);
      if (batchExpiry === undefined || typeof event.unsignedCommitmentTx !== 'string' || !event.unsignedCommitmentTx || event.unsignedCommitmentTx.length > 700000) throw Error();
      const encoded = event.unsignedCommitmentTx;
      if (settlement.candidate) {
        if (settlement.candidate.id !== event.id || settlement.candidate.encoded !== encoded || settlement.candidate.batchExpiry !== batchExpiry) throw Error();
        return;
      }
      const bytes = Uint8Array.from(atob(encoded), byte => byte.charCodeAt(0));
      settlement.candidate = Object.freeze({ id: event.id, batchExpiry, commitment: Transaction.fromPSBT(bytes), encoded });
      settlement.connectorChunks = settlement.connectorChunksByBatch?.get(event.id);
    }
  } catch { settlement.captureError = true; }
}

/** Capture the SDK's original registration before it requests a session key or
 * signs concurrent register/delete proofs. This is client preparation only;
 * the server must independently verify source values, scripts and authority.
 */
export function prepareServerSettlement(params: SettleParams, network: TestNetwork, publicKey: string, gameAddress: string): ServerSettlement {
  if (!params || !Array.isArray(params.inputs) || !params.inputs.length || params.inputs.length > 100 ||
      !Array.isArray(params.outputs) || !params.outputs.length || params.outputs.length > 100) throw Error('Original settlement plan required.');
  const ownScript = ArkAddress.decode(gameAddress).pkScript;
  const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((byte, index) => byte === b[index]);
  const onchain: number[] = [];
  const outputs = params.outputs.map((output, index) => {
    let script: Uint8Array;
    try { script = ArkAddress.decode(output.address).pkScript; }
    catch { script = OutScript.encode(Address(getNetwork(network)).decode(output.address)); onchain.push(index); }
    return { amount: output.amount, script };
  });
  const assets = new Map<number, { assetId: string; amount: bigint }[]>(), holdings = new Map<string, bigint>();
  params.inputs.forEach((input, index) => {
    const list: { assetId: string; amount: bigint }[] = 'assets' in input && Array.isArray(input.assets) ? input.assets : [];
    if (list.length) {
      assets.set(index + 1, list.map(asset => ({ ...asset })));
      for (const asset of list) holdings.set(asset.assetId, (holdings.get(asset.assetId) ?? 0n) + asset.amount);
    }
  });
  if (holdings.size) {
    const destination = outputs.findIndex(output => same(output.script, ownScript));
    if (destination < 0) throw Error('Settlement must retain Game assets.');
    const recipients: Recipient[] = params.outputs.map(output => ({ address: output.address, amount: Number(output.amount) }));
    recipients[destination].assets = [...holdings].map(([assetId, amount]) => ({ assetId, amount }));
    outputs.push(Extension.create([createAssetPacket(assets, recipients)]).txOut());
  }
  const proof = Intent.create({ type: 'register', onchain_output_indexes: onchain, valid_at: 0, expire_at: 0,
    cosigners_public_keys: onchain.length < params.outputs.length ? [publicKey] : [] }, params.inputs, outputs);
  // Serialize now: callers cannot mutate the captured plan through SDK objects.
  return { outpoints: params.inputs.map(({ txid, vout }) => ({ txid, vout })), registerProof: Transaction.fromPSBT(proof.toPSBT()) };
}
