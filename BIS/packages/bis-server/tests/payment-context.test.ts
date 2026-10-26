import test from 'node:test';
import assert from 'node:assert/strict';
import { MnemonicIdentity, DefaultVtxo, CSVMultisigTapscript, buildOffchainTx, type ArkInfo, type VirtualCoin } from '@arkade-os/sdk';
import { readPaymentContext } from '../src/server/payment-context.ts';
import { validateOffchainPayment } from '../src/server/offchain-policy.ts';

const game = MnemonicIdentity.fromMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about', { isMainnet: false });
const player = MnemonicIdentity.fromMnemonic('legal winner thank year wave sausage worth useful legal winner thank yellow', { isMainnet: false });
const gamePublicKey = Buffer.from(await game.compressedPublicKey()).toString('hex');
const playerPublicKey = Buffer.from(await player.compressedPublicKey()).toString('hex');
const operator = await player.xOnlyPublicKey();
const change = new DefaultVtxo.Script({ pubKey: await game.xOnlyPublicKey(), serverPubKey: operator, csvTimelock: { type: 'seconds', value: 1024n } });
const unroll = CSVMultisigTapscript.encode({ pubkeys: [operator], timelock: { type: 'seconds', value: 86016n } });
const info = { network: 'signet', signerPubkey: playerPublicKey, forfeitPubkey: playerPublicKey, unilateralExitDelay: 1024n, checkpointTapscript: Buffer.from(unroll.script).toString('hex') } as ArkInfo;
const outpoint = { txid: '11'.repeat(32), vout: 0 };
const coin = { ...outpoint, value: 10000, status: { confirmed: true }, script: Buffer.from(change.pkScript).toString('hex'), createdAt: new Date(), isSpent: false, isSwept: false, isPreconfirmed: false, spentBy: '', isUnrolled: false, expiresAt: new Date('2100-01-01'), virtualStatus: { state: 'settled' }, assets: [] } as unknown as VirtualCoin;
const options = () => ({ network: 'signet' as const, gamePublicKey, playerPublicKey, outpoints: [outpoint], maximumExposureSats: 1000, signal: new AbortController().signal });

test('fresh context accepts the approved 5000-sat maximum and rejects 5001 before reading network facts', async () => {
  let reads = 0;
  const reader = { info: async () => { reads++; return info; }, coins: async () => ({ vtxos: [coin] }) };
  const trusted = await readPaymentContext({ ...options(), maximumExposureSats: 5000 }, reader);
  assert.equal(trusted.maximumExposureSats, 5000);
  assert.equal(reads, 1);
  await assert.rejects(readPaymentContext({ ...options(), maximumExposureSats: 5001 }, reader), /context/);
  assert.equal(reads, 1);
});

test('fresh network facts derive Game inputs/change and Player destination without a client address or value', async () => {
  let fetched: unknown;
  const trusted = await readPaymentContext(options(), { info: async () => info, coins: async outpoints => { fetched = outpoints; return { vtxos: [coin] }; } });
  assert.deepEqual(fetched, [outpoint]);
  assert.equal(trusted.inputs[0].value, 10000);
  assert.deepEqual(trusted.changeScript, change.pkScript);
  const actual = buildOffchainTx([...trusted.inputs], [{ amount: 600n, script: trusted.recipientScript }, { amount: 9400n, script: trusted.changeScript }], trusted.serverUnrollScript);
  assert.equal(validateOffchainPayment(actual.arkTx, trusted).exposureSats, 600);
});

test('fresh context rejects spent, expired, unrolled, foreign-script, asset-bearing and missing source facts', async () => {
  for (const patch of [{ isSpent: true }, { spentBy: 'spent' }, { isSwept: true }, { isUnrolled: true }, { expiresAt: new Date(0) }, { expiresAtHeight: 1 }, { script: '51' }, { assets: [{ assetId: 'a'.repeat(68), amount: 1n }] }, { value: -1 }, { txid: '22'.repeat(32) }]) {
    await assert.rejects(readPaymentContext(options(), { info: async () => info, coins: async () => ({ vtxos: [{ ...coin, ...patch }] }) }), /context/);
  }
  for (const response of [{ vtxos: [] }, { vtxos: [coin, coin] }, { vtxos: [coin], page: { next: 'untrusted-incomplete-page' } }]) {
    await assert.rejects(readPaymentContext(options(), { info: async () => info, coins: async () => response }), /context/);
  }
});

test('wrong network, shortened checkpoint delay and wrong forfeit key fail before any coin lookup', async () => {
  const short = CSVMultisigTapscript.encode({ pubkeys: [operator], timelock: { type: 'seconds', value: 512n } });
  for (const changed of [{ ...info, network: 'mutinynet' }, { ...info, checkpointTapscript: Buffer.from(short.script).toString('hex') }, { ...info, forfeitPubkey: gamePublicKey }]) {
    let lookedUp = false;
    await assert.rejects(readPaymentContext(options(), { info: async () => changed, coins: async () => { lookedUp = true; return { vtxos: [coin] }; } }), /context/);
    assert.equal(lookedUp, false);
  }
});

test('explicit asset policy reads fresh typed holdings but rejects malformed or duplicate holdings', async () => {
  const holding = { assetId: 'a'.repeat(68), amount: 2n };
  const reader = { info: async () => info, coins: async () => ({ vtxos: [{ ...coin, assets: [holding] }] }) };
  const result = await readPaymentContext({ ...options(), allowAssets: true }, reader);
  assert.deepEqual(result.inputs[0].assets, [holding]);
  await assert.rejects(readPaymentContext(options(), reader), /context/);
  for (const assets of [[{ ...holding, amount: -1n }], [holding, holding], [{ ...holding, assetId: 'bad' }]]) {
    await assert.rejects(readPaymentContext({ ...options(), allowAssets: true }, { info: async () => info, coins: async () => ({ vtxos: [{ ...coin, assets }] }) }), /context/);
  }
});

test('duplicate references fail before network reads and cancellation cannot use a late response', async () => {
  let read = false;
  await assert.rejects(readPaymentContext({ ...options(), outpoints: [outpoint, outpoint] }, { info: async () => { read = true; return info; }, coins: async () => ({ vtxos: [coin] }) }), /context/);
  assert.equal(read, false);
  const controller = new AbortController();
  let finish!: (value: ArkInfo) => void;
  const pending = readPaymentContext({ ...options(), signal: controller.signal }, { info: () => new Promise(resolve => { finish = resolve; }), coins: async () => { read = true; return { vtxos: [coin] }; } });
  controller.abort();
  await assert.rejects(pending, /context/);
  finish(info);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(read, false);
});
