import test from 'node:test';
import assert from 'node:assert/strict';
import { MnemonicIdentity, DefaultVtxo, Transaction, Intent, type ArkInfo, type Coin, type VirtualCoin } from '@arkade-os/sdk';
import { readSettlementContext, type SettlementSourceReader } from '../src/server/settlement-context.ts';
import { validateSettlementIntent } from '../src/server/settlement-intent-policy.ts';

// Deterministic provider facts and real SDK transaction bytes. Nothing is
// registered, broadcast or funded by this suite.
const game = MnemonicIdentity.fromMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about', { isMainnet: false });
const operator = MnemonicIdentity.fromMnemonic('legal winner thank year wave sausage worth useful legal winner thank yellow', { isMainnet: false });
const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');
const gamePublicKey = hex(await game.compressedPublicKey()), operatorPublicKey = hex(await operator.compressedPublicKey());
const script = (delay: bigint) => new DefaultVtxo.Script({ pubKey: Buffer.from(gamePublicKey.slice(2), 'hex'), serverPubKey: Buffer.from(operatorPublicKey.slice(2), 'hex'), csvTimelock: { type: 'seconds', value: delay } });
const arkade = script(1024n), bitcoin = script(4096n);

function fixture(boarding = true) {
  const info = { network: 'signet', signerPubkey: operatorPublicKey, unilateralExitDelay: 1024n, boardingExitDelay: 4096n, dust: 330n } as ArkInfo;
  const raw = new Transaction(); raw.addInput({ txid: '22'.repeat(32), index: 0 }); raw.addOutput({ script: bitcoin.pkScript, amount: 20000n });
  const coin = { txid: raw.id, vout: 0, value: 20000, status: { confirmed: true, block_height: 499, block_time: Math.floor(Date.now() / 1000) - 600 } } as Coin;
  const vtxo = { txid: '11'.repeat(32), vout: 0, value: 20000, script: hex(arkade.pkScript), status: { confirmed: true }, createdAt: new Date(), virtualStatus: { state: 'settled' }, isSpent: false, isSwept: false, isUnrolled: false, spentBy: '', expiresAt: new Date('2100-01-01'), assets: [] } as unknown as VirtualCoin;
  const point = boarding ? coin : vtxo, calls: string[] = [];
  const reader: SettlementSourceReader = {
    info: async () => { calls.push('info'); return info; }, tip: async () => ({ height: 500 }),
    virtual: async () => ({ vtxos: boarding ? [] : [vtxo] }), boarding: async address => { calls.push(address); return boarding ? [coin] : []; },
    raw: async () => { calls.push('raw'); return raw.unsignedTx; }, outspends: async () => { calls.push('outspends'); return [{ spent: false }]; },
  };
  const options = { network: 'signet' as const, gamePublicKey, outpoints: [{ txid: point.txid, vout: point.vout }], maximumExposureSats: 5000, signal: new AbortController().signal };
  return { info, raw, coin, vtxo, reader, options, calls };
}

test('fresh confirmed Bitcoin sources match raw value/script and unspent evidence before a zero-exposure SDK intent', async () => {
  const f = fixture(), context = await readSettlementContext(f.options, f.reader);
  assert.deepEqual(context.arkadeScript, arkade.pkScript); assert.deepEqual(context.bitcoinScript, bitcoin.pkScript);
  assert.equal(context.inputs[0].value, 20000);
  assert.ok(f.calls.includes('raw')); assert.ok(f.calls.includes('outspends'));
  assert.match(f.calls[1], /^tb1p/);
  const proof = Intent.create({ type: 'register', onchain_output_indexes: [], cosigners_public_keys: [gamePublicKey], valid_at: 0, expire_at: 0 }, [...context.inputs], [{ amount: 20000n, script: arkade.pkScript }]);
  assert.equal(validateSettlementIntent(proof, context).exposureSats, 0);
});

test('fresh Arkade sources remain separate from Bitcoin and retain exact bigint holdings', async () => {
  const f = fixture(false); f.vtxo.assets = [{ assetId: 'ab'.repeat(34), amount: 9007199254740993n }];
  const context = await readSettlementContext(f.options, f.reader);
  assert.deepEqual(context.inputs[0].tapTree, arkade.encode());
  assert.equal('assets' in context.inputs[0] && context.inputs[0].assets![0].amount, 9007199254740993n);
  assert.equal(f.calls.includes('raw'), false);
});

test('spent, unconfirmed, expired or inconsistent Bitcoin evidence never qualifies', async () => {
  for (const patch of [{ value: 20001 }, { status: { confirmed: false } }, { status: { confirmed: true, block_height: 501, block_time: Math.floor(Date.now() / 1000) } }, { status: { confirmed: true, block_height: 499, block_time: 1 } }, { status: { confirmed: true, block_height: 499 } }]) {
    const f = fixture(); Object.assign(f.coin, patch);
    await assert.rejects(readSettlementContext(f.options, f.reader), /context/);
  }
  const spent = fixture(); spent.reader.outspends = async () => [{ spent: true }];
  await assert.rejects(readSettlementContext(spent.options, spent.reader), /context/);
  const wrongScript = fixture(); const raw = new Transaction(); raw.addInput({ txid: '22'.repeat(32), index: 0 }); raw.addOutput({ script: arkade.pkScript, amount: 20000n });
  wrongScript.coin.txid = raw.id; wrongScript.options.outpoints[0].txid = raw.id; wrongScript.reader.raw = async () => raw.unsignedTx;
  await assert.rejects(readSettlementContext(wrongScript.options, wrongScript.reader), /context/);
});

test('wrong, spent or malformed Arkade facts and ambiguous or incomplete source answers fail closed', async () => {
  for (const patch of [{ script: hex(bitcoin.pkScript) }, { isSpent: true }, { spentBy: '33'.repeat(32) }, { isSwept: true }, { isUnrolled: true }, { expiresAt: new Date(0) }, { value: NaN }, { assets: [{ assetId: 'bad', amount: 1n }] }]) {
    const f = fixture(false); Object.assign(f.vtxo, patch);
    await assert.rejects(readSettlementContext(f.options, f.reader), /context/);
  }
  const ambiguous = fixture(false); ambiguous.reader.boarding = async () => [{ ...ambiguous.coin, txid: ambiguous.vtxo.txid }];
  await assert.rejects(readSettlementContext(ambiguous.options, ambiguous.reader), /context/);
  for (const answer of [{ vtxos: [] }, { vtxos: [fixture(false).vtxo], page: { next: 'incomplete' } }, { vtxos: [fixture(false).vtxo, fixture(false).vtxo] }]) {
    const f = fixture(false); f.reader.virtual = async () => answer;
    await assert.rejects(readSettlementContext(f.options, f.reader), /context/);
  }
});

test('wrong network, duplicate references and cap escalation cannot authorize provider facts', async () => {
  const f = fixture(); f.info.network = 'mutinynet';
  await assert.rejects(readSettlementContext(f.options, f.reader), /context/);
  const duplicate = fixture();
  await assert.rejects(readSettlementContext({ ...duplicate.options, outpoints: [...duplicate.options.outpoints, ...duplicate.options.outpoints] }, duplicate.reader), /context/);
  await assert.rejects(readSettlementContext({ ...duplicate.options, maximumExposureSats: 5001 }, duplicate.reader), /context/);
  assert.deepEqual(duplicate.calls, []);
});

test('cancellation cannot turn a late raw-transaction response into signing authority', async () => {
  const f = fixture(), controller = new AbortController(); let release!: () => void, waiting!: () => void;
  const started = new Promise<void>(resolve => { waiting = resolve; });
  f.reader.raw = async () => { waiting(); await new Promise<void>(resolve => { release = resolve; }); return f.raw.unsignedTx; };
  const pending = readSettlementContext({ ...f.options, signal: controller.signal }, f.reader);
  await started; controller.abort(); await assert.rejects(pending, /context/); release();
});
