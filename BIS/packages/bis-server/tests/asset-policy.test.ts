import test from 'node:test';
import assert from 'node:assert/strict';
import { MnemonicIdentity, DefaultVtxo, CSVMultisigTapscript, Extension, asset, buildOffchainTx, Transaction, verifyTapscriptSignatures, AssetManager } from '@arkade-os/sdk';
import { validateAssetBurn, validateAssetIssuance, validateAssetDelivery, type TrustedAssetContext } from '../src/server/asset-policy.ts';

const game = MnemonicIdentity.fromMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about', { isMainnet: false });
const player = MnemonicIdentity.fromMnemonic('legal winner thank year wave sausage worth useful legal winner thank yellow', { isMainnet: false });
const operator = await player.xOnlyPublicKey();
const own = new DefaultVtxo.Script({ pubKey: await game.xOnlyPublicKey(), serverPubKey: operator, csvTimelock: { type: 'seconds', value: 1024n } });
const destination = new DefaultVtxo.Script({ pubKey: await player.xOnlyPublicKey(), serverPubKey: operator, csvTimelock: { type: 'seconds', value: 1024n } });
const a = asset.AssetId.create('aa'.repeat(32), 0).toString(), b = asset.AssetId.create('bb'.repeat(32), 0).toString();
const context: TrustedAssetContext = { inputs: [{ txid: '11'.repeat(32), vout: 0, value: 10000, tapTree: own.encode(), tapLeafScript: own.forfeit(), assets: [{ assetId: a, amount: 2n }, { assetId: b, amount: 5n }] }], changeScript: own.pkScript, recipientScript: destination.pkScript, maximumExposureSats: 1000, serverUnrollScript: CSVMultisigTapscript.encode({ pubkeys: [operator], timelock: { type: 'seconds', value: 86016n } }) };
const metadata = (patch: Record<string, string> = {}) => Object.entries({ name: 'Level 1 trophy', ticker: 'TROPHY', decimals: '0', bisKind: 'asset', bisSchemaVersion: '1', bisAssetFormatVersion: '0.0.2', bisOperationId: 'reward-1', ...patch }).map(([key, value]) => asset.Metadata.create(new TextEncoder().encode(key), new TextEncoder().encode(value)));
const preserve = (id: string, amount: bigint) => asset.AssetGroup.create(asset.AssetId.fromString(id), null, [asset.AssetInput.create(0, amount)], [asset.AssetOutput.create(0, amount)], []);
function mint(quantity = 1n, patch: Record<string, string> = {}, firstScript = own.pkScript) {
  const groups = [asset.AssetGroup.create(null, null, [], [asset.AssetOutput.create(0, quantity)], metadata(patch)), preserve(a, 2n), preserve(b, 5n)];
  return buildOffchainTx([...context.inputs], [{ script: firstScript, amount: 10000n }, Extension.create([asset.Packet.create(groups)]).txOut()], context.serverUnrollScript);
}
function delivery(options: { amount?: bigint; change?: bigint; aRemaining?: bigint; bRemaining?: bigint; script?: Uint8Array } = {}) {
  const amount = options.amount ?? 1n;
  const groups = [asset.AssetGroup.create(asset.AssetId.fromString(a), null, [asset.AssetInput.create(0, 2n)], [asset.AssetOutput.create(0, amount), asset.AssetOutput.create(1, options.aRemaining ?? 2n - amount)], []),
    asset.AssetGroup.create(asset.AssetId.fromString(b), null, [asset.AssetInput.create(0, 5n)], [asset.AssetOutput.create(1, options.bRemaining ?? 5n)], [])];
  return buildOffchainTx([...context.inputs], [{ script: options.script ?? destination.pkScript, amount: 330n }, { script: own.pkScript, amount: options.change ?? 9670n }, Extension.create([asset.Packet.create(groups)]).txOut()], context.serverUnrollScript);
}

test('real SDK NFT issuance preserves all prior holdings and Bitcoin change with zero net exposure', async () => {
  const tx = mint(), plan = validateAssetIssuance(Transaction.fromPSBT(tx.arkTx.toPSBT()), context);
  assert.equal(plan.exposureSats, 0);
  assert.deepEqual(plan.issuedAssets, [asset.AssetId.create(tx.arkTx.id, 0).toString()]);
  assert.deepEqual(plan.checkpoints.map(tx => tx.id), tx.checkpoints.map(tx => tx.id));
  const signed = await game.sign(plan.arkTx);
  await verifyTapscriptSignatures(signed, 0, [Buffer.from(await game.xOnlyPublicKey()).toString('hex')]);
});

test('asset issuance and delivery enforce the shared 5000-sat exposure ceiling including fees', () => {
  const trusted = { ...context, maximumExposureSats: 5000 };
  assert.equal(validateAssetDelivery(delivery({ change: 5000n }).arkTx, trusted, new Set([a])).exposureSats, 5000);
  assert.throws(() => validateAssetDelivery(delivery({ change: 4999n }).arkTx, trusted, new Set([a])), /policy/);
  assert.throws(() => validateAssetDelivery(delivery().arkTx, { ...trusted, maximumExposureSats: 5001 }, new Set([a])), /policy/);
  const packet = Extension.fromTx(mint().arkTx);
  const issued = (change: bigint) => buildOffchainTx([...context.inputs], [{ amount: change, script: own.pkScript }, packet.txOut()], context.serverUnrollScript);
  assert.equal(validateAssetIssuance(issued(5000n).arkTx, trusted).exposureSats, 5000);
  assert.throws(() => validateAssetIssuance(issued(4999n).arkTx, trusted), /policy/);
  assert.throws(() => validateAssetIssuance(mint().arkTx, { ...trusted, maximumExposureSats: 5001 }), /policy/);
});

test('the installed SDK AssetManager.issue output passes the policy with existing selected asset holdings', async () => {
  let validated = false;
  const wallet = {
    indexerProvider: {}, dustAmount: 330n,
    getSpendableVtxos: async () => [...context.inputs],
    getAddress: async () => own.address('tark', operator).encode(),
    buildAndSubmitOffchainTx: async (inputs: typeof context.inputs, outputs: { script: Uint8Array; amount: bigint }[]) => {
      const prepared = buildOffchainTx([...inputs], outputs, context.serverUnrollScript);
      const plan = validateAssetIssuance(prepared.arkTx, context);
      assert.equal(plan.exposureSats, 0); validated = true;
      return { arkTxid: plan.arkTx.id };
    },
  };
  const manager = new AssetManager(wallet as any);
  const result = await manager.issue({ amount: 1n, metadata: { name: 'Achievement: Level 1', ticker: 'LVL1', decimals: 0, bisKind: 'asset', bisSchemaVersion: '1', bisAssetFormatVersion: '0.0.2', bisOperationId: 'level_1-reward' } });
  assert.equal(validated, true);
  assert.equal(result.assetId, asset.AssetId.create(result.arkTxId, 0).toString());
});

test('the installed SDK AssetManager.burn output burns only a Player-authorized asset and preserves other holdings', async () => {
  let validated: ReturnType<typeof validateAssetBurn> | undefined;
  const wallet = {
    indexerProvider: {}, dustAmount: 330n,
    getSpendableVtxos: async () => [...context.inputs],
    getAddress: async () => own.address('tark', operator).encode(),
    buildAndSubmitOffchainTx: async (inputs: typeof context.inputs, outputs: { script: Uint8Array; amount: bigint }[]) => {
      const prepared = buildOffchainTx([...inputs], outputs, context.serverUnrollScript);
      validated = validateAssetBurn(prepared.arkTx, context, new Set([a]));
      return { arkTxid: validated.arkTx.id };
    },
  };
  const transactionId = await new AssetManager(wallet as any).burn({ assetId: a, amount: 1n });
  assert.equal(validated?.arkTx.id, transactionId);
  assert.equal(validated?.exposureSats, 0);
  assert.deepEqual(Extension.fromTx(validated!.arkTx).getAssetPacket()!.groups.map(group => group.outputs.map(output => output.amount)), [[1n], [5n]]);
});

test('asset burn refuses unowned assets, simultaneous losses, redirection, and modified source quantities', () => {
  const burn = (first: bigint, second: bigint, script = own.pkScript) => {
    const groups = [asset.AssetGroup.create(asset.AssetId.fromString(a), null, [asset.AssetInput.create(0, 2n)], first > 0n ? [asset.AssetOutput.create(0, first)] : [], []),
      asset.AssetGroup.create(asset.AssetId.fromString(b), null, [asset.AssetInput.create(0, 5n)], second > 0n ? [asset.AssetOutput.create(0, second)] : [], [])];
    return buildOffchainTx([...context.inputs], [{ script, amount: 10000n }, Extension.create([asset.Packet.create(groups)]).txOut()], context.serverUnrollScript).arkTx;
  };
  assert.throws(() => validateAssetBurn(burn(1n, 5n), context, new Set()), /policy/);
  assert.throws(() => validateAssetBurn(burn(1n, 4n), context, new Set([a, b])), /policy/);
  assert.throws(() => validateAssetBurn(burn(1n, 5n, destination.pkScript), context, new Set([a])), /policy/);
  assert.throws(() => validateAssetBurn(burn(1n, 5n), { ...context, inputs: context.inputs.map(input => ({ ...input, assets: [{ assetId: a, amount: 1n }, { assetId: b, amount: 5n }] })) }, new Set([a])), /policy/);
});

test('public mint rejects multi-unit issuance, non-BIS metadata, wrong decimals and another owner', () => {
  for (const tx of [mint(2n), mint(1n, { bisKind: 'other' }), mint(1n, { decimals: '1' }), mint(1n, { bisAssetFormatVersion: '9.9.9' }), mint(1n, {}, destination.pkScript)]) {
    assert.throws(() => validateAssetIssuance(tx.arkTx, context), /policy/);
  }
});

test('issuance refuses lost prior assets and over-budget fees even if the new NFT is valid', () => {
  const tx = mint().arkTx.clone();
  tx.updateOutput(0, { amount: 8999n });
  assert.throws(() => validateAssetIssuance(tx, context), /policy/);
  const missing = { ...context, inputs: context.inputs.map(input => ({ ...input, assets: input.assets.filter(holding => holding.assetId === a) })) };
  assert.throws(() => validateAssetIssuance(mint().arkTx, missing), /policy/);
});

test('real SDK authorized NFT delivery preserves unrelated assets and accounts for carrier plus fee', async () => {
  const tx = delivery({ change: 9600n }), plan = validateAssetDelivery(Transaction.fromPSBT(tx.arkTx.toPSBT()), context, new Set([a]));
  assert.equal(plan.exposureSats, 400); assert.equal(plan.recipientSats, 330);
  assert.equal(plan.arkTx.id, tx.arkTx.id);
  const signed = await game.sign(plan.arkTx);
  await verifyTapscriptSignatures(signed, 0, [Buffer.from(await game.xOnlyPublicKey()).toString('hex')]);
});

test('delivery rejects an unapproved asset, excess units, asset loss, arbitrary recipient and over-budget sats', () => {
  assert.throws(() => validateAssetDelivery(delivery().arkTx, context, new Set()), /policy/);
  for (const options of [{ amount: 2n, aRemaining: 1n }, { aRemaining: 2n }, { bRemaining: 4n }, { script: new Uint8Array([0x51]) }, { change: 8999n }]) {
    assert.throws(() => validateAssetDelivery(delivery(options).arkTx, context, new Set([a])), /policy/);
  }
});

test('a sats payment may retain unknown assets unchanged without authorizing their delivery', () => {
  const groups = [a, b].map((id, index) => asset.AssetGroup.create(asset.AssetId.fromString(id), null, [asset.AssetInput.create(0, index === 0 ? 2n : 5n)], [asset.AssetOutput.create(1, index === 0 ? 2n : 5n)], []));
  const tx = buildOffchainTx([...context.inputs], [{ amount: 330n, script: destination.pkScript }, { amount: 9670n, script: own.pkScript }, Extension.create([asset.Packet.create(groups)]).txOut()], context.serverUnrollScript);
  const plan = validateAssetDelivery(tx.arkTx, context, new Set());
  assert.equal(plan.exposureSats, 330);
  assert.equal(plan.arkTx.id, tx.arkTx.id);
});

test('altered witness values and duplicate source references cannot bypass canonical reconstruction', () => {
  const tx = delivery().arkTx.clone(), previous = tx.getInput(0).witnessUtxo!;
  tx.updateInput(0, { witnessUtxo: { script: previous.script, amount: 9999n } });
  assert.throws(() => validateAssetDelivery(tx, context, new Set([a])), /policy/);
  assert.throws(() => validateAssetIssuance(mint().arkTx, { ...context, inputs: [...context.inputs, ...context.inputs] }), /policy/);
});
