import assert from 'node:assert/strict';
import test from 'node:test';
import { RestArkProvider, RestEmulatorProvider, RestIndexerProvider, Transaction } from '@arkade-os/sdk';
import { hex, base64 } from '@scure/base';
import { createArkadeConditionalVaultApi } from '../../integration/src/client/wallet-layer-arkade/conditional-vault-api.ts';
import { compileConditionalVault } from '../../integration/src/client/wallet-layer-arkade/conditional-vault-program.ts';
import { VAULT_EMULATORS } from '../../integration/src/client/wallet-layer-arkade/conditional-vault-capability.ts';
import { vaultDescriptorHash } from '../../integration/src/client/wallet-layer-arkade/conditional-vault-descriptor.ts';
import { descriptorFixture } from '../../integration/tests/client/conditional-vault-descriptor.test.ts';
import type { VaultJournalEntry } from '../../integration/src/client/state-layer-core/conditional-vault-journal.ts';

test('teaching execution stays inside durable checkpoints, network reconciliation and replay exclusion', async t => {
  const base = await descriptorFixture('signet');
  const parameters = {
    network: base.network, id: base.id, creatorKey: base.creatorPublicKey,
    creatorDestination: base.creatorDestination.slice(4), serverKey: base.operatorPublicKey,
    emulatorKey: VAULT_EMULATORS.signet.key, deadline: base.deadline, exitDelaySeconds: base.exitDelaySeconds,
  };
  const compiled = compileConditionalVault(parameters);
  const descriptor = { ...base, emulatorPublicKey: parameters.emulatorKey, stateScripts: compiled.states.map(state => state.pkScript) };
  descriptor.hash = await vaultDescriptorHash(descriptor);
  const rows: VaultJournalEntry[] = [];
  const tx = new Transaction({ allowUnknownInputs: true, allowUnknownOutputs: true });
  tx.addInput({ txid: descriptor.funding.transactionId, index: 0 });
  tx.addOutput({ script: hex.decode(descriptor.stateScripts[1]), amount: 1000n });
  const raw = base64.encode(tx.toPSBT());
  let observed = false, blocked = false, executions = 0, submissions = 0;
  t.mock.method(RestArkProvider.prototype, 'getInfo', async () => ({
    network: 'signet', signerPubkey: `02${descriptor.operatorPublicKey}`, unilateralExitDelay: 2048n,
    vtxoMinAmount: 1n, vtxoMaxAmount: -1n, dust: 330n,
    fees: { txFeeRate: '0', intentFee: { offchainInput: '', offchainOutput: '0.0' } },
  }) as never);
  t.mock.method(RestIndexerProvider.prototype, 'getVtxos', async () => ({ vtxos: [] }));
  t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(String(url), 'http://127.0.0.1:7074/v1/info');
    return new Response(JSON.stringify({ signerPubkey: `03${parameters.emulatorKey}`, version: 'fixture' }));
  });
  t.mock.method(RestEmulatorProvider.prototype, 'submitTx', async (arkTx, checkpoints) => {
    submissions++;
    assert.equal(rows[0].phase, 'submitting');
    assert.deepEqual(rows[0].recovery[0], { target: 'emulator', request: [arkTx, checkpoints] });
    assert.equal(rows[0].transactionId, tx.id);
    observed = true;
    return { signedArkTx: arkTx, signedCheckpointTxs: checkpoints };
  });
  const api = createArkadeConditionalVaultApi('signet', async () => { throw Error('permissionless increment must not lease a wallet'); }, {
    journal: { transaction: async use => use(rows) },
    lock: async (_key, use) => use(),
    inspect: async value => ({
      descriptor: value, status: blocked ? 'unavailable' : 'locked', progress: observed ? 1 : 0,
      activeOutput: descriptor.funding, checkedAt: 1,
      evidence: observed ? [{ network: 'signet', transactionId: tx.id, consumed: [descriptor.funding], outputs: [] }] : [],
    }),
    execution: { spend: async context => {
      executions++;
      assert.equal(rows[0].phase, 'prepared');
      assert.equal(rows[0].recovery.length, 0);
      assert.equal(context.operation, 'increment');
      assert.equal(context.identity, undefined);
      await context.emulator.submitTx(raw, []);
      return { txid: tx.id };
    } },
  });
  const request = { operationId: 'teaching-increment', descriptor, expectedOutput: descriptor.funding };
  assert.equal((await api.increment(request)).outcome, 'verified');
  assert.equal(rows[0].phase, 'verified');
  assert.equal((await api.increment(request)).outcome, 'verified');
  assert.equal(executions, 1);
  assert.equal(submissions, 1);
  blocked = true;
  assert.equal((await api.increment({ ...request, operationId: 'blocked-teaching-increment' })).reason, 'vault-state-does-not-permit-operation');
  assert.equal(executions, 1);
  assert.equal(submissions, 1);
});
