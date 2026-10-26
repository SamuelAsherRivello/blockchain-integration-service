import { isDeepStrictEqual } from 'node:util';
import { ArkAddress, CSVMultisigTapscript, CosignerPublicKey, Extension, Transaction, TxTree, getArkPsbtFields, getNetwork,
  validateBatchRecipients, validateVtxoTxGraph, type Recipient } from '@arkade-os/sdk';
import { Address, OutScript, Transaction as BitcoinTransaction } from '@scure/btc-signer';
import { RawPSBTV0 } from '@scure/btc-signer/psbt.js';
import { tapLeafHash } from '@scure/btc-signer/payment.js';
import { keyAggregate, sortKeys } from '@scure/btc-signer/musig2.js';
import { schnorr } from '@noble/curves/secp256k1.js';
import { encodeSigningValue } from '../../../integration/src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import { signingDigest } from './signing-authorization.ts';
import type { GameNetwork } from './environment.ts';

export type TrustedSettlementBatch = Readonly<{
  network: GameNetwork;
  registration: Transaction;
  sessionPublicKey: string;
  operatorPublicKey: string;
  forfeitPublicKey: string;
  batchExpiry: bigint;
  boardingOutpoints: readonly string[];
}>;
const deny = () => Error('Settlement batch is outside the signing policy.');
const hex = (value: Uint8Array) => Buffer.from(value).toString('hex');
const xonly = (key: string) => {
  if (!/^(?:0[23])?[a-f0-9]{64}$/.test(key)) throw deny();
  return Buffer.from(key.slice(-64), 'hex');
};

/** Structural and recipient validation ONLY. The caller must separately bind
 * a fresh batch to this original sealed plan and its operation-specific session
 * key before granting MuSig authority. A client-supplied commitment is not
 * operator evidence; passing this function alone never authorizes signing.
 */
export function validateSettlementBatch(candidate: { tree: TxTree; commitment: Transaction; scriptRoot: Uint8Array; sharedAmount: bigint }, trusted: TrustedSettlementBatch) {
  try {
    if (!['signet', 'mutinynet'].includes(trusted.network) || !/^0[23][a-f0-9]{64}$/.test(trusted.sessionPublicKey) ||
        typeof trusted.batchExpiry !== 'bigint' || trusted.batchExpiry < 86400n || trusted.batchExpiry % 512n !== 0n || trusted.batchExpiry / 512n > 65535n ||
        !(candidate.tree instanceof TxTree) || !(candidate.commitment instanceof BitcoinTransaction) ||
        candidate.commitment.inputsLength < 1 || candidate.commitment.inputsLength > 1000 || candidate.commitment.outputsLength > 1000 ||
        typeof candidate.sharedAmount !== 'bigint' || candidate.sharedAmount <= 0n || candidate.sharedAmount > BigInt(Number.MAX_SAFE_INTEGER)) throw deny();
    const scriptRoot = tapLeafHash(CSVMultisigTapscript.encode({ timelock: { type: 'seconds', value: trusted.batchExpiry }, pubkeys: [xonly(trusted.forfeitPublicKey)] }).script);
    if (!isDeepStrictEqual(scriptRoot, candidate.scriptRoot)) throw deny();
    // Bound and reject cycles before recursive SDK traversal/validation.
    const pending: { node: TxTree; depth: number }[] = [{ node: candidate.tree, depth: 0 }], visited = new Set<TxTree>(), ids = new Set<string>();
    let serializedSize = commitmentSize(candidate.commitment);
    while (pending.length) {
      const { node, depth } = pending.pop()!;
      if (!(node instanceof TxTree) || visited.has(node) || visited.size >= 100 || depth > 32 || node.root.inputsLength !== 1 || node.root.outputsLength > 100 || ids.has(node.root.id)) throw deny();
      visited.add(node); ids.add(node.root.id);
      serializedSize += commitmentSize(node.root);
      if (serializedSize > 512 * 1024) throw deny();
      const input = node.root.getInput(0);
      if (input.sighashType !== undefined && input.sighashType !== 0) throw deny();
      const keys = getArkPsbtFields(node.root, 0, CosignerPublicKey).map(item => item.key);
      if (!keys.length || keys.length > 100 || keys.some(key => key.length !== 33 || !/^0[23]/.test(hex(key))) ||
          new Set(keys.map(key => hex(key.slice(1)))).size !== keys.length || !keys.some(key => hex(key) === trusted.sessionPublicKey)) throw deny();
      for (const [index, child] of node.children) {
        if (!Number.isSafeInteger(index) || index < 0 || index >= node.root.outputsLength) throw deny();
        pending.push({ node: child, depth: depth + 1 });
      }
    }
    const commitment = candidate.commitment, shared = commitment.getOutput(0);
    if (shared.amount !== candidate.sharedAmount) throw deny();
    // SDK graph validation checks child keys, but not the root aggregate key.
    const rootKeys = sortKeys(getArkPsbtFields(candidate.tree.root, 0, CosignerPublicKey).map(item => item.key));
    const internal = keyAggregate(rootKeys).aggPublicKey.toBytes(true).slice(1);
    const tweak = schnorr.utils.taggedHash('TapTweak', internal, scriptRoot);
    const aggregate = keyAggregate(rootKeys, [tweak], [true]).aggPublicKey.toBytes(true).slice(1);
    if (!isDeepStrictEqual(shared.script, Uint8Array.from([0x51, 0x20, ...aggregate]))) throw deny();
    const spent = new Set<string>();
    for (let i = 0; i < commitment.inputsLength; i++) {
      const input = commitment.getInput(i);
      if (!input.txid || input.index === undefined) throw deny();
      const point = `${hex(input.txid)}:${input.index}`;
      if (spent.has(point)) throw deny();
      spent.add(point);
    }
    if (!Array.isArray(trusted.boardingOutpoints) || trusted.boardingOutpoints.length > 100 || new Set(trusted.boardingOutpoints).size !== trusted.boardingOutpoints.length ||
        trusted.boardingOutpoints.some(point => !/^[a-f0-9]{64}:(?:0|[1-9][0-9]{0,9})$/.test(point) || !spent.has(point))) throw deny();
    validateVtxoTxGraph(candidate.tree, commitment, scriptRoot);
    const registration = trusted.registration;
    const message = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(RawPSBTV0.decode(registration.toPSBT(0)).global.genericSignedMessage));
    if (message.type !== 'register' || !Array.isArray(message.onchain_output_indexes) ||
        !isDeepStrictEqual(message.cosigners_public_keys, [trusted.sessionPublicKey]) || registration.outputsLength > 100) throw deny();
    const hasAssets = Array.from({ length: registration.outputsLength }, (_, index) => registration.getOutput(index).script).some(script => script && Extension.isExtension(script));
    const packet = hasAssets ? Extension.fromTx(registration).getAssetPacket() : undefined;
    const recipients: Recipient[] = [];
    for (let index = 0; index < registration.outputsLength; index++) {
      const output = registration.getOutput(index);
      if (!output.script || output.amount === undefined) throw deny();
      if (Extension.isExtension(output.script)) continue;
      if (output.amount <= 0n || output.amount > BigInt(Number.MAX_SAFE_INTEGER)) throw deny();
      const onchain = message.onchain_output_indexes.includes(index);
      const address = onchain ? Address(getNetwork(trusted.network)).encode(OutScript.decode(output.script))
        : new ArkAddress(xonly(trusted.operatorPublicKey), output.script.slice(2), 'tark').encode();
      const assets = packet?.groups.flatMap(group => {
        if (group.isIssuance() || !group.assetId) throw deny();
        return group.outputs.filter(asset => asset.vout === index).map(asset => ({ assetId: group.assetId!.toString(), amount: asset.amount }));
      });
      if (onchain && assets?.length) throw deny();
      recipients.push({ address, amount: Number(output.amount), ...(assets?.length ? { assets } : {}) });
    }
    if (!recipients.length) throw deny();
    validateBatchRecipients(commitment, candidate.tree.leaves(), recipients, getNetwork(trusted.network));
    return Object.freeze({ commitmentId: commitment.id, treeDigest: signingDigest(encodeSigningValue(candidate.tree)), scriptRoot: hex(scriptRoot),
      sharedAmount: String(shared.amount), transactionIds: Object.freeze([...ids]) });
  } catch { throw deny(); }
}

function commitmentSize(tx: Transaction) { return tx.toPSBT().length; }
