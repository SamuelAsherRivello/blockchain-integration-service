import test from 'node:test';
import assert from 'node:assert/strict';
import { SingleKey, DefaultVtxo, CSVMultisigTapscript, Transaction, Extension, signAndSubmitOffchainTx } from '@arkade-os/sdk';
import { base64, hex } from '@scure/base';
import { executeTreasureSdk, compileTreasureSdk, validateTreasureSdkRecord, treasureSdkReservation, type TreasureSdkRecord } from '../src/client/treasure-sdk.ts';
import { maintenanceJournal } from '../src/client/wallet-maintenance-state.ts';

// Real SDK signing against an in-process synthetic operator. These are NOT live
// network receipts and never use a saved wallet, faucet or external connection.
async function fixture(t: any, network: 'signet' | 'mutinynet' = 'signet', assetCarrier = false) {
  t.mock.method(globalThis, 'fetch', async () => assert.fail('Offline fixture attempted HTTP'));
  const owner = SingleKey.fromPrivateKey(new Uint8Array(32).fill(2));
  const operator = SingleKey.fromPrivateKey(new Uint8Array(32).fill(1));
  const operatorKey = await operator.xOnlyPublicKey(), ownerKey = await owner.xOnlyPublicKey();
  const source = new DefaultVtxo.Script({ pubKey: ownerKey, serverPubKey: operatorKey, csvTimelock: { type: 'seconds', value: 512n } });
  const sourceScript = hex.encode(source.pkScript), coins = new Map<string, any>();
  const assets = assetCarrier ? [{ assetId: 'a'.repeat(64) + '0000', amount: 9007199254740993n }] : [];
  coins.set('b'.repeat(64) + ':0', { txid: 'b'.repeat(64), vout: 0, value: 5000, script: sourceScript, ...(assets.length ? { assets } : {}) });
  let revision = 0, records: TreasureSdkRecord[] = [];
  const storage = { load: async () => ({ revision, records: structuredClone(records) }), save: async (next: TreasureSdkRecord[], expected: number) => {
    assert.equal(expected, revision); records = structuredClone(next); return ++revision;
  } };
  const state = { submits: 0, finalizes: 0, loseFinalizeAck: false, loseSubmitAck: false, hideReceipts: false, blockFinalize: false };
  const publicRows = new Map<string, string>();
  const reservations = maintenanceJournal('c'.repeat(64), { getItem: key => publicRows.get(key) ?? null, setItem: (key, value) => { publicRows.set(key, value); } });
  const info = { network, fees: { txFeeRate: '0', intentFee: {} }, signerPubkey: hex.encode(await operator.compressedPublicKey()),
    dust: 330n, vtxoMinAmount: 330n, vtxoMaxAmount: -1n, unilateralExitDelay: 512n,
    checkpointTapscript: hex.encode(CSVMultisigTapscript.encode({ pubkeys: [operatorKey], timelock: { type: 'seconds', value: 512n } }).script) };
  const latest = () => records.at(-1)!.spends.at(-1)!;
  const submitted = new Map<string, any>();
  const arkProvider = {
    getInfo: async () => info,
    submitTx: async (encoded: string, checkpoints: string[]) => {
      const tx = Transaction.fromPSBT(base64.decode(encoded));
      const row = latest();
      assert.equal(row.state, 'submitting', 'private request must be saved before submission');
      assert.equal(row.transactionId, tx.id); assert.equal(row.arkTx, encoded); assert.deepEqual(row.checkpoints, checkpoints);
      assert.ok(reservations.pending().some(item => item.id === `treasure-${row.id}` && item.attempted), 'shared wallet reservation must precede dispatch');
      state.submits++; submitted.set(tx.id, { tx, row: structuredClone(row) });
      if (state.loseSubmitAck) throw Error('Synthetic lost response');
      return { arkTxid: tx.id, finalArkTx: base64.encode((await operator.sign(tx)).toPSBT()),
        signedCheckpointTxs: await Promise.all(checkpoints.map(async value => base64.encode((await operator.sign(Transaction.fromPSBT(base64.decode(value)))).toPSBT()))) };
    },
    finalizeTx: async (id: string, checkpoints: string[]) => {
      const entry = submitted.get(id); assert.ok(entry); state.finalizes++;
      assert.deepEqual(latest().finalization, checkpoints, 'signed finalization is saved before transmission');
      if (state.blockFinalize) throw Error('Synthetic interrupted finalization');
      for (const input of entry.row.inputs) {
        const key = `${input.txid}:${input.vout}`, coin = coins.get(key); assert.ok(coin && !coin.isSpent);
        coins.set(key, { ...coin, isSpent: true, spentBy: 'f'.repeat(64), arkTxId: id });
      }
      const groups = entry.row.inputs.some((c: any) => c.assets?.length) ? Extension.fromTx(entry.tx)!.getAssetPacket()!.groups : [];
      for (let vout = 0; vout < entry.tx.outputsLength; vout++) {
        const output = entry.tx.getOutput(vout), outputAssets = groups.flatMap(group => group.outputs.filter(o => o.vout === vout).map(o => ({ assetId: group.assetId.toString(), amount: o.amount })));
        coins.set(`${id}:${vout}`, { txid: id, vout, value: Number(output.amount), script: hex.encode(output.script!), ...(outputAssets.length ? { assets: outputAssets } : {}) });
      }
      if (state.loseFinalizeAck) throw Error('Synthetic lost finalization acknowledgement');
    },
  };
  const wallet: any = { identity: owner, arkProvider,
    getAddress: async () => source.address('tark', operatorKey).encode(),
    getSpendableVtxos: async () => [...coins.values()].filter(c => c.script === sourceScript && !c.isSpent),
    indexerProvider: { getVtxos: async (query: any) => ({ vtxos: state.hideReceipts ? [] : query.outpoints.map((p: any) => coins.get(`${p.txid}:${p.vout}`)).filter(Boolean) }) },
    buildAndSubmitOffchainTx: async (inputs: any[], outputs: any[]) => ({ arkTxid: await signAndSubmitOffchainTx({ identity: owner, provider: wallet.arkProvider,
      inputs: inputs.map(c => ({ txid: c.txid, vout: c.vout, value: c.value, tapLeafScript: source.leaves[0], tapTree: source.encode() })), outputs,
      serverUnrollScript: CSVMultisigTapscript.decode(hex.decode(info.checkpointTapscript)), verifyServerSignatures: { serverPubkey: operatorKey } }) }),
  };
  const run = (action: 'start' | 'check' | 'claim' | 'reject') => executeTreasureSdk(wallet, network, action, storage, (record, spend) => {
    const reservation = treasureSdkReservation(record, spend); if (reservation) reservations.save(reservation);
  });
  return { run, state, info, coins, records: () => records, storage, ownerKey: hex.encode(ownerKey), sourceScript, assets, reservations };
}

for (const network of ['signet', 'mutinynet'] as const) test(`offline SDK ${network}: Create, Check, Claim and separate Reject share real compiled outputs`, async t => {
  const f = await fixture(t, network);
  const funded = await f.run('start'); assert.equal(funded.status, 'claimable'); assert.equal(funded.verified, true);
  const first = f.records()[0], compiled = await compileTreasureSdk(first);
  assert.equal(compiled.script.leaves.length, 4);
  assert.equal(f.coins.get(`${first.spends[0].transactionId}:0`).script, hex.encode(compiled.script.pkScript));
  assert.equal((await f.run('check')).status, 'claimable'); assert.equal(f.state.submits, 1);
  assert.equal((await f.run('start')).contractId, first.id); assert.equal(f.state.submits, 1, 'duplicate Create cannot refund or replace the active offer');
  assert.equal((await f.run('claim')).status, 'claimed'); assert.equal(f.state.submits, 2);
  assert.equal((await f.run('start')).status, 'claimable');
  assert.equal((await f.run('reject')).status, 'refunded'); assert.equal(f.state.submits, 4);
  assert.equal(f.records().length, 2, 'original terminal recovery is retained');
  assert.ok(!JSON.stringify(funded).includes(first.secret), 'public projection never exposes the preimage');
});

test('missing recovery does not claim a network result or submit a transaction', async t => {
  const f = await fixture(t);
  for (const action of ['check', 'claim', 'reject'] as const) {
    const result = await f.run(action);
    assert.equal(result.status, 'unknown');
    assert.equal(result.verified, false);
    assert.match(result.message, /cannot be determined/);
  }
  assert.equal(f.state.submits, 0);
});

test('offline SDK funding preserves a large asset amount entirely in wallet change', async t => {
  const f = await fixture(t, 'signet', true);
  assert.equal((await f.run('start')).status, 'claimable');
  const id = f.records()[0].spends[0].transactionId;
  assert.equal(f.coins.get(`${id}:0`).assets, undefined);
  assert.deepEqual(f.coins.get(`${id}:1`).assets, f.assets);
  assert.equal((await f.run('claim')).status, 'claimed');
  assert.deepEqual(f.coins.get(`${id}:1`).assets, f.assets);
});

test('lost finalization acknowledgement is recovered from exact receipts, without another submission', async t => {
  const f = await fixture(t); f.state.loseFinalizeAck = true;
  assert.equal((await f.run('start')).status, 'unknown');
  f.state.loseFinalizeAck = false;
  assert.equal((await f.run('check')).status, 'claimable'); assert.equal(f.state.submits, 1);
});

test('lost submit acknowledgement remains unknown after reload and repeated actions do not spend again', async t => {
  const f = await fixture(t); f.state.loseSubmitAck = true;
  assert.equal((await f.run('start')).status, 'unknown');
  assert.equal((await f.run('check')).status, 'unknown');
  assert.equal((await f.run('start')).status, 'unknown');
  assert.equal((await f.run('claim')).status, 'unknown'); assert.equal(f.state.submits, 1);
  assert.equal(f.reservations.pending().length, 1);
  assert.ok(!JSON.stringify(f.reservations.read()).includes(f.records()[0].secret));
  assert.ok(!JSON.stringify(f.reservations.read()).includes('checkpoints'));
});

test('only exact recovered receipts release the shared pending-input guard', async t => {
  const f = await fixture(t); f.state.loseFinalizeAck = true;
  assert.equal((await f.run('start')).status, 'unknown'); assert.equal(f.reservations.pending().length, 1);
  f.state.hideReceipts = true;
  assert.equal((await f.run('check')).status, 'unknown'); assert.equal(f.reservations.pending().length, 1);
  f.state.hideReceipts = false;
  assert.equal((await f.run('check')).status, 'claimable'); assert.equal(f.reservations.pending().length, 0);
  assert.equal(f.state.submits, 1);
});

test('operator rotation prevents replay of the original signed finalization', async t => {
  const f = await fixture(t); f.state.blockFinalize = true;
  assert.equal((await f.run('start')).status, 'unknown'); assert.equal(f.state.finalizes, 1);
  const replacement = SingleKey.fromPrivateKey(new Uint8Array(32).fill(3));
  f.info.signerPubkey = hex.encode(await replacement.compressedPublicKey());
  assert.equal((await f.run('start')).status, 'unknown'); assert.equal(f.state.finalizes, 1);
  assert.equal(f.records()[0].spends[0].resumes, undefined);
});

test('fee-policy change blocks new spending while Check retains verified funding and recovery', async t => {
  const f = await fixture(t); await f.run('start'); const first = structuredClone(f.records()[0]);
  f.info.fees.txFeeRate = '1';
  const checked = await f.run('check'); assert.equal(checked.status, 'unavailable'); assert.equal(checked.verified, true);
  assert.equal((await f.run('claim')).status, 'unavailable'); assert.equal(f.state.submits, 1);
  assert.deepEqual(f.records()[0], first);
});

test('interrupted preparation is recovered without sending or replacing the operation', async t => {
  const f = await fixture(t);
  const save = f.storage.save;
  let interrupt = true;
  f.storage.save = async (records, revision) => {
    const next = await save(records, revision);
    if (interrupt) { interrupt = false; throw Error('Synthetic interruption after saving preparation'); }
    return next;
  };
  await assert.rejects(f.run('start'), /Synthetic interruption/);
  assert.equal(f.records()[0].spends[0].state, 'prepared');
  assert.equal((await f.run('start')).status, 'not-submitted');
  assert.equal(f.state.submits, 0);
  assert.equal((await f.run('start')).status, 'claimable');
  assert.equal(f.state.submits, 1);
});

test('interrupted spend preparation checks the funding before reporting it claimable', async t => {
  const f = await fixture(t);
  await f.run('start');
  const save = f.storage.save;
  let interrupt = true;
  f.storage.save = async (records, revision) => {
    const next = await save(records, revision);
    if (interrupt) { interrupt = false; throw Error('Synthetic interruption after saving preparation'); }
    return next;
  };
  await assert.rejects(f.run('claim'), /Synthetic interruption/);
  f.state.hideReceipts = true;
  assert.equal((await f.run('check')).status, 'unknown');
  assert.equal(f.state.submits, 1);
  f.state.hideReceipts = false;
  assert.equal((await f.run('check')).status, 'claimable');
  assert.equal((await f.run('claim')).status, 'claimed');
});

test('expired claim submits nothing, while explicit Reject refunds the original output', async t => {
  const f = await fixture(t); await f.run('start');
  t.mock.method(Date, 'now', () => f.records()[0].expiresAt);
  assert.equal((await f.run('claim')).status, 'expired'); assert.equal(f.state.submits, 1);
  assert.equal((await f.run('reject')).status, 'refunded'); assert.equal(f.state.submits, 2);
});

test('missing or unrelated receipts cannot make an old funded output claimable', async t => {
  const f = await fixture(t); await f.run('start'); f.state.hideReceipts = true;
  assert.equal((await f.run('check')).status, 'unknown'); assert.equal(f.state.submits, 1);
  assert.equal((await f.run('claim')).status, 'unknown'); assert.equal(f.state.submits, 1);
});

test('changed recovery script/network/owner is rejected before a write', async t => {
  const f = await fixture(t); await f.run('start'); const original = f.records()[0];
  await assert.rejects(validateTreasureSdkRecord({ ...original, script: '00' }, 'signet', f.ownerKey), /script changed/);
  await assert.rejects(validateTreasureSdkRecord(original, 'mutinynet', f.ownerKey), /terms/);
  await assert.rejects(validateTreasureSdkRecord(original, 'signet', '00'.repeat(32)), /terms/);
  assert.equal(f.state.submits, 1);
});
