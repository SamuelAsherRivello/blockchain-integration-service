import { MAX_OPERATION_EXPOSURE_SATS } from './signing-limits.ts';
import { isDeepStrictEqual } from 'node:util';
import { asset, Extension, buildOffchainTx, type Transaction } from '@arkade-os/sdk';
import { assertCanonicalSigningTransaction, type TrustedPaymentContext } from './offchain-policy.ts';

type Holding = { assetId: string; amount: bigint };
export type TrustedAssetContext = Omit<TrustedPaymentContext, 'inputs'> & {
  inputs: readonly (TrustedPaymentContext['inputs'][number] & { assets: readonly Holding[] })[];
};
const deny = () => Error('Asset transaction is outside the signing policy.');
function sources(context: TrustedAssetContext) {
  if (!Number.isSafeInteger(context.maximumExposureSats) || context.maximumExposureSats <= 0 || context.maximumExposureSats > MAX_OPERATION_EXPOSURE_SATS || !context.inputs.length || context.inputs.length > 100) throw deny();
  const holdings = new Map<string, { amount: bigint; inputs: ReturnType<typeof asset.AssetInput.create>[] }>();
  let sats = 0n;
  const outpoints = new Set<string>();
  context.inputs.forEach((input, index) => {
    if (!/^[0-9a-f]{64}$/.test(input.txid) || !Number.isSafeInteger(input.vout) || input.vout < 0 || input.vout > 0xffffffff || !Number.isSafeInteger(input.value) || input.value <= 0 || !Array.isArray(input.assets) || input.assets.length > 100) throw deny();
    const outpoint = `${input.txid}:${input.vout}`;
    if (outpoints.has(outpoint)) throw deny();
    outpoints.add(outpoint); sats += BigInt(input.value);
    const seen = new Set<string>();
    for (const holding of input.assets) {
      if (!/^[a-f0-9]{68}$/.test(holding.assetId) || typeof holding.amount !== 'bigint' || holding.amount <= 0n || seen.has(holding.assetId)) throw deny();
      seen.add(holding.assetId);
      const total = holdings.get(holding.assetId) ?? { amount: 0n, inputs: [] };
      total.amount += holding.amount; total.inputs.push(asset.AssetInput.create(index, holding.amount));
      holdings.set(holding.assetId, total);
      if (holdings.size > 100) throw deny();
    }
  });
  return { holdings, sats, outpoints: [...outpoints] };
}
function packet(tx: Transaction) {
  const extension = Extension.fromTx(tx), packets = extension.getPackets(), parsed = extension.getAssetPacket();
  if (!parsed || packets.length !== 1 || packets[0].type() !== parsed.type() || parsed.groups.length > 100) throw deny();
  return parsed;
}
function metadata(group: InstanceType<typeof asset.AssetGroup>) {
  // SDK 0.4.79 exposes no metadata iterator on AssetGroup. Guard the pinned
  // representation, then prove that public reconstruction serializes exactly.
  const list = Reflect.get(group, 'metadataList'), items = list?.items;
  if (!Array.isArray(items) || items.length === 0 || items.length > 40) throw deny();
  const values = new Map<string, string>(); let size = 0;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  for (const item of items) {
    if (!(item.key instanceof Uint8Array) || !(item.value instanceof Uint8Array)) throw deny();
    const key = decoder.decode(item.key), value = decoder.decode(item.value);
    size += item.key.length + item.value.length;
    if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(key) || ['__proto__', 'prototype', 'constructor'].includes(key) || values.has(key) || item.value.length > 8192 || size > 16384) throw deny();
    values.set(key, value);
  }
  if (values.get('bisKind') !== 'asset' || values.get('bisSchemaVersion') !== '1' || !['0.0.1', '0.0.2'].includes(values.get('bisAssetFormatVersion') ?? '') || values.get('decimals') !== '0' ||
      !values.get('name')?.trim() || values.get('name')!.length > 128 || !values.get('ticker')?.trim() || values.get('ticker')!.length > 16 || !/^[\w-]{1,128}$/.test(values.get('bisOperationId') ?? '')) throw deny();
  return items.map(item => asset.Metadata.create(item.key, item.value));
}
function finish(tx: Transaction, context: TrustedAssetContext, outputs: { script: Uint8Array; amount: bigint }[], exposure: bigint, recipientSats: bigint, outpoints: string[]) {
  if (exposure < 0n || exposure > BigInt(context.maximumExposureSats)) throw deny();
  const plan = buildOffchainTx([...context.inputs], outputs, context.serverUnrollScript);
  assertCanonicalSigningTransaction(tx, plan.arkTx);
  return { ...plan, exposureSats: Number(exposure), recipientSats: Number(recipientSats), sourceOutpoints: outpoints, assetPolicy: true as const };
}

/** One new non-reissuable BIS NFT, wholly retained at the Game address. Any
 * existing assets selected by the SDK must be preserved exactly at that address.
 */
export function validateAssetIssuance(tx: Transaction, context: TrustedAssetContext) {
  const { holdings, sats, outpoints } = sources(context), parsed = packet(tx);
  if (tx.outputsLength !== 3 || parsed.groups.length !== holdings.size + 1) throw deny();
  const first = parsed.groups[0];
  if (!first.isIssuance() || first.assetId !== null || first.controlAsset !== null || first.inputs.length || first.outputs.length !== 1 || first.outputs[0].vout !== 0 || first.outputs[0].amount !== 1n) throw deny();
  const issued = asset.AssetGroup.create(null, null, [], [asset.AssetOutput.create(0, 1n)], metadata(first));
  if (!isDeepStrictEqual(issued.serialize(), first.serialize())) throw deny();
  const groups = [issued];
  for (const [id, total] of holdings) groups.push(asset.AssetGroup.create(asset.AssetId.fromString(id), null, total.inputs, [asset.AssetOutput.create(0, total.amount)], []));
  const own = tx.getOutput(0);
  if (!own.script || !isDeepStrictEqual(own.script, context.changeScript) || typeof own.amount !== 'bigint' || own.amount <= 0n) throw deny();
  const outputs = [{ script: context.changeScript, amount: own.amount }, Extension.create([asset.Packet.create(groups)]).txOut()];
  const plan = finish(tx, context, outputs, sats - own.amount, 0n, outpoints);
  return { ...plan, issuedAssets: [asset.AssetId.create(plan.arkTx.id, 0).toString()] };
}

/** One previously authorized asset unit to the verified Player. All other
 * quantities remain at the Game address. Allowlisting must come from the server.
 */
export function validateAssetDelivery(tx: Transaction, context: TrustedAssetContext, allowed: ReadonlySet<string>) {
  const { holdings, sats, outpoints } = sources(context), parsed = packet(tx);
  if (tx.outputsLength < 3 || tx.outputsLength > 4 || isDeepStrictEqual(context.changeScript, context.recipientScript)) throw deny();
  const recipient = tx.getOutput(0), hasChange = tx.outputsLength === 4;
  if (!recipient.script || !isDeepStrictEqual(recipient.script, context.recipientScript) || typeof recipient.amount !== 'bigint' || recipient.amount <= 0n) throw deny();
  let change = 0n;
  if (hasChange) {
    const own = tx.getOutput(1);
    if (!own.script || !isDeepStrictEqual(own.script, context.changeScript) || typeof own.amount !== 'bigint' || own.amount <= 0n) throw deny();
    change = own.amount;
  }
  const sent = parsed.groups.flatMap(group => group.outputs.filter(output => output.vout === 0).map(output => ({ id: group.assetId?.toString(), amount: output.amount })));
  if (sent.length > 1 || sent.length === 1 && (!sent[0].id || sent[0].amount !== 1n || !allowed.has(sent[0].id) || !holdings.has(sent[0].id))) throw deny();
  const groups: InstanceType<typeof asset.AssetGroup>[] = [];
  for (const [id, total] of holdings) {
    const delivered = id === sent[0]?.id ? 1n : 0n, remaining = total.amount - delivered;
    if (remaining < 0n || remaining > 0n && !hasChange) throw deny();
    const outputs = [...(delivered ? [asset.AssetOutput.create(0, delivered)] : []), ...(remaining ? [asset.AssetOutput.create(1, remaining)] : [])];
    groups.push(asset.AssetGroup.create(asset.AssetId.fromString(id), null, total.inputs, outputs, []));
  }
  const outputs = [{ script: context.recipientScript, amount: recipient.amount }, ...(hasChange ? [{ script: context.changeScript, amount: change }] : []), Extension.create([asset.Packet.create(groups)]).txOut()];
  return finish(tx, context, outputs, sats - change, recipient.amount, outpoints);
}

/** Return the asset IDs whose quantity decreases in a candidate transaction.
 * This is only a routing hint; validateAssetBurn performs full reconstruction.
 */
export function assetBurnCandidates(tx: Transaction, context: TrustedAssetContext) {
  const { holdings } = sources(context), parsed = packet(tx);
  return parsed.groups.flatMap(group => {
    const id = group.assetId?.toString(), holding = id ? holdings.get(id) : undefined;
    if (!holding) return [];
    const outputAmount = group.outputs.reduce((total, output) => total + output.amount, 0n);
    return outputAmount < holding.amount ? [id!] : [];
  });
}

/** Burn asset units already scoped to this verified Player. Every other asset
 * is conserved at the Game address; Bitcoin remains at Game and fees/carrier
 * exposure stays under the same server-enforced operation cap.
 */
export function validateAssetBurn(tx: Transaction, context: TrustedAssetContext, allowed: ReadonlySet<string>) {
  const { holdings, sats, outpoints } = sources(context), parsed = packet(tx);
  if (tx.outputsLength !== 3 || parsed.groups.length !== holdings.size) throw deny();
  const own = tx.getOutput(0);
  if (!own.script || !isDeepStrictEqual(own.script, context.changeScript) || typeof own.amount !== 'bigint' || own.amount <= 0n) throw deny();
  const seen = new Set<string>(), groups: InstanceType<typeof asset.AssetGroup>[] = [];
  let burnedAsset = false;
  for (const group of parsed.groups) {
    const id = group.assetId?.toString(), total = id ? holdings.get(id) : undefined;
    if (!id || !total || seen.has(id) || group.controlAsset !== null || group.outputs.length > 1 || group.outputs.some(output => output.vout !== 0)) throw deny();
    seen.add(id);
    const outputAmount = group.outputs.reduce((amount, output) => amount + output.amount, 0n);
    if (outputAmount > total.amount) throw deny();
    const burned = total.amount - outputAmount;
    if (burned > 0n) {
      if (burnedAsset || !allowed.has(id)) throw deny();
      burnedAsset = true;
    }
    const outputs = outputAmount > 0n ? [asset.AssetOutput.create(0, outputAmount)] : [];
    const expected = asset.AssetGroup.create(asset.AssetId.fromString(id), null, total.inputs, outputs, []);
    if (!isDeepStrictEqual(expected.serialize(), group.serialize())) throw deny();
    groups.push(expected);
  }
  if (!burnedAsset || seen.size !== holdings.size) throw deny();
  return finish(tx, context, [{ script: context.changeScript, amount: own.amount }, Extension.create([asset.Packet.create(groups)]).txOut()], sats - own.amount, 0n, outpoints);
}
