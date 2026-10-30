import assert from 'node:assert/strict';
import test from 'node:test';
import { arkade, Transaction } from '@arkade-os/sdk';
import { hex, base64 } from '@scure/base';
import { fixture } from '../../integration/tests/client/conditional-vault-inspection.test.ts';
import { inspectConditionalVault as inspectCore } from '../../integration/src/client/wallet-layer-arkade/conditional-vault-inspection.ts';
import { inspectConditionalVault as inspectDemo } from '../src/client/demos/conditional-vault-check.ts';
import { executeIncrement } from '../src/client/demos/conditional-vault-increment.ts';
import { executeClaim } from '../src/client/demos/conditional-vault-claim.ts';

for (const network of ['signet', 'mutinynet'] as const) {
  test(`${network}: displayed Check verifies the same real transaction graph and fails on missing evidence`, async () => {
    for (const terminal of ['claim', 'recover', null] as const) {
      const f = await fixture(network, terminal);
      const result = await inspectDemo(f.descriptor, f.dependencies as never);
      assert.equal(result.status, terminal === 'claim' ? 'claimed' : terminal === 'recover' ? 'recovered' : 'claimable');
      assert.deepEqual(result, await inspectCore(f.descriptor, f.dependencies as never));
      f.archive.delete(f.descriptor.funding.transactionId);
      assert.equal((await inspectDemo(f.descriptor, f.dependencies as never)).status, 'unavailable');
    }
  });
}

for (const branch of ['increment', 'claim', 'recover'] as const) {
  test(`displayed ${branch} constructs the committed destination and submits the correct signatures`, async t => {
    const f = await fixture('signet', null, branch === 'claim' ? 3 : 0);
    const before = await inspectDemo(f.descriptor, f.dependencies as never);
    const destination = branch === 'increment' ? f.descriptor.stateScripts[1] : f.descriptor.creatorDestination;
    const transaction = new Transaction({ allowUnknownOutputs: true, allowUnknownInputs: true });
    transaction.addInput({ txid: 'aa'.repeat(32), index: 0 });
    transaction.addOutput({ script: hex.decode(destination), amount: 1000n });
    transaction.addOutput({ script: hex.decode('6a'), amount: 0n });
    transaction.addOutput({ script: hex.decode('51024e73'), amount: 0n });
    const calls: string[] = [];
    let selectedBranch: string | undefined, selectedDestination: Uint8Array | undefined, selectedCoin: unknown;
    const builder = {
      from(coin) { selectedCoin = coin; return this; },
      to(script, amount) { selectedDestination = script; assert.equal(amount, 1000n); return this; },
      async build() { return { arkTx: transaction, checkpoints: [transaction.clone()] }; },
    };
    const connect = t.mock.method(arkade.Arkade, 'connect', async () => ({
      contract: () => ({ functions: Object.fromEntries(['increment', 'claim', 'recover'].map(name => [name, () => { selectedBranch = name; return builder; }])) }),
    }) as never);
    const context: any = {
      network: 'signet', descriptor: f.descriptor, before, operation: branch,
      ark: {}, indexer: {},
      identity: branch === 'increment' ? undefined : { sign: async tx => { calls.push('sign'); return tx; } },
      emulator: { submitTx: async (raw, checkpoints) => {
        calls.push('submit');
        assert.equal(Transaction.fromPSBT(base64.decode(raw)).id, transaction.id);
        assert.equal(checkpoints.length, 1);
        return { signedArkTx: raw, signedCheckpointTxs: checkpoints };
      } },
    };
    const execute = branch === 'increment' ? executeIncrement : executeClaim;
    assert.deepEqual(await execute(context), { txid: transaction.id });
    assert.equal(selectedBranch, branch);
    assert.equal(hex.encode(selectedDestination!), destination);
    assert.deepEqual(selectedCoin, { txid: before.activeOutput!.transactionId, vout: before.activeOutput!.outputIndex, value: 1000 });
    assert.deepEqual(calls, branch === 'increment' ? ['submit'] : ['sign', 'sign', 'submit']);
    assert.equal(connect.mock.calls[0].arguments[0].identity, context.identity);
    if (branch !== 'increment') {
      context.identity = undefined;
      const submitted = calls.filter(call => call === 'submit').length;
      await assert.rejects(execute(context), /vault-spend-creator-required/);
      assert.equal(calls.filter(call => call === 'submit').length, submitted);
    }
    const other = transaction.clone();
    other.updateOutput(0, { amount: 999n });
    context.identity = { sign: async tx => tx };
    context.emulator.submitTx = async () => ({ signedArkTx: base64.encode(other.toPSBT()), signedCheckpointTxs: [] });
    await assert.rejects(execute(context), /acknowledgement-mismatch/);
  });
}
