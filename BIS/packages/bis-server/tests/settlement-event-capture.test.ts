import test from 'node:test';
import assert from 'node:assert/strict';
import { Transaction, SettlementEventType, type SettlementEvent } from '@arkade-os/sdk';
import { captureServerSettlementEvent, type ServerSettlement } from '../../integration/src/client/wallet-layer-arkade/server-settlement.ts';

const key = '02' + '11'.repeat(32);
const state = (): ServerSettlement => ({ outpoints: [], registerProof: new Transaction(), sessionPublicKey: key });
const start = (id = 'original', batchExpiry = 86528n): SettlementEvent => ({ type: SettlementEventType.BatchStarted, id, batchExpiry, intentIdHashes: [] });
function tree(id = 'original', cosignersPublicKeys = [key], existing?: Transaction): SettlementEvent {
  const tx = existing ?? new Transaction();
  if (!existing) { tx.addInput({ txid: '22'.repeat(32), index: 0 }); tx.addOutput({ amount: 20000n, script: Uint8Array.from([0x6a]) }); }
  return { type: SettlementEventType.TreeSigningStarted, id, cosignersPublicKeys, unsignedCommitmentTx: Buffer.from(tx.toPSBT()).toString('base64') };
}

test('batch events synchronously capture a detached candidate with compressed or x-only cosigners', () => {
  for (const publicKey of [key, key.slice(2), key.toUpperCase()]) {
    const selected = state(), event = tree('original', [publicKey]);
    captureServerSettlementEvent(selected, start()); captureServerSettlementEvent(selected, event);
    assert.equal(selected.captureError, undefined); assert.equal(selected.candidate?.id, 'original'); assert.equal(selected.candidate?.batchExpiry, 86528n);
    assert.equal(selected.candidate?.commitment.outputsLength, 1);
    event.id = 'mutated'; assert.equal(selected.candidate?.id, 'original');
    captureServerSettlementEvent(selected, tree('original', [publicKey])); assert.equal(selected.captureError, undefined);
  }
});

test('unrelated batches do not provide this operation with a signing candidate', () => {
  const selected = state(); captureServerSettlementEvent(selected, start());
  captureServerSettlementEvent(selected, tree('original', ['03' + '33'.repeat(32)]));
  assert.equal(selected.candidate, undefined); assert.equal(selected.captureError, undefined);
});

test('missing start, changed expiry, replacement batch and duplicate session keys remain refused', () => {
  const missing = state(); captureServerSettlementEvent(missing, tree()); assert.equal(missing.captureError, true);
  const expiry = state(); captureServerSettlementEvent(expiry, start()); captureServerSettlementEvent(expiry, start('original', 87040n)); assert.equal(expiry.captureError, true);
  const changed = state(); captureServerSettlementEvent(changed, start()); captureServerSettlementEvent(changed, tree());
  captureServerSettlementEvent(changed, start('replacement')); captureServerSettlementEvent(changed, tree('replacement')); assert.equal(changed.captureError, true); assert.equal(changed.candidate?.id, 'original');
  const duplicate = state(); captureServerSettlementEvent(duplicate, start()); captureServerSettlementEvent(duplicate, tree('original', [key, key.slice(2)])); assert.equal(duplicate.captureError, true);
  // Observational SDK callback failures are swallowed. Preserve refusal state.
  captureServerSettlementEvent(missing, start()); captureServerSettlementEvent(missing, tree()); assert.equal(missing.captureError, true); assert.equal(missing.candidate, undefined);
});

test('event storage and commitment decoding are bounded without throwing through the SDK callback', () => {
  const selected = state(); for (let i = 0; i <= 100; i++) captureServerSettlementEvent(selected, start(String(i)));
  assert.equal(selected.starts?.size, 100); assert.equal(selected.captureError, true);
  for (const encoded of ['not-base64!', 'a'.repeat(700001)]) {
    const malformed = state(), event = tree(); event.unsignedCommitmentTx = encoded;
    captureServerSettlementEvent(malformed, start()); assert.doesNotThrow(() => captureServerSettlementEvent(malformed, event)); assert.equal(malformed.captureError, true);
  }
});

test('finalization captures only the original commitment and reconstructs bounded connector chunks', () => {
  const selected = state(), commitment = new Transaction();
  commitment.addInput({ txid: '33'.repeat(32), index: 0 });
  commitment.addOutput({ amount: 20000n, script: Uint8Array.of(0x51) });
  captureServerSettlementEvent(selected, start());
  captureServerSettlementEvent(selected, start('other'));
  const otherCommitment = new Transaction(); otherCommitment.addInput({ txid: '66'.repeat(32), index: 0 }); otherCommitment.addOutput({ amount: 20000n, script: Uint8Array.of(0x51) });
  const otherConnector = new Transaction(); otherConnector.addInput({ txid: otherCommitment.id, index: 0 }); otherConnector.addOutput({ amount: 1000n, script: Uint8Array.of(0x51) });
  captureServerSettlementEvent(selected, { type: SettlementEventType.TreeTx, id: 'other', topic: [], batchIndex: 1,
    chunk: { txid: otherConnector.id, tx: Buffer.from(otherConnector.toPSBT()).toString('base64'), children: {} } });
  const connector = new Transaction(); connector.addInput({ txid: commitment.id, index: 0 }); connector.addOutput({ amount: 1000n, script: Uint8Array.of(0x51) });
  captureServerSettlementEvent(selected, { type: SettlementEventType.TreeTx, id: 'original', topic: [], batchIndex: 1,
    chunk: { txid: connector.id, tx: Buffer.from(connector.toPSBT()).toString('base64'), children: {} } });
  assert.equal(selected.candidate, undefined);
  assert.equal(selected.connectorChunks, undefined);
  const signing = tree('original', [key], commitment); captureServerSettlementEvent(selected, signing);
  assert.equal(selected.connectorChunks?.length, 1);
  assert.equal(selected.connectorChunks?.[0].txid, connector.id);
  const event: SettlementEvent = { type: SettlementEventType.BatchFinalization, id: 'original', commitmentTx: Buffer.from(commitment.toPSBT()).toString('base64') };
  captureServerSettlementEvent(selected, event);
  assert.equal(selected.captureError, undefined);
  assert.equal(selected.finalization?.id, 'original');
  assert.equal(selected.finalization?.commitment.id, commitment.id);
  assert.equal(selected.finalization?.connectors?.root.id, connector.id);
  captureServerSettlementEvent(selected, event); assert.equal(selected.captureError, true);
});

test('finalization refuses a commitment outside the validated batch and ignores unrelated connector trees', () => {
  const selected = state(), other = new Transaction(); other.addInput({ txid: '44'.repeat(32), index: 0 }); other.addOutput({ amount: 20000n, script: Uint8Array.of(0x51) });
  captureServerSettlementEvent(selected, start()); captureServerSettlementEvent(selected, tree());
  const wrong: SettlementEvent = { type: SettlementEventType.BatchFinalization, id: 'original', commitmentTx: Buffer.from(other.toPSBT()).toString('base64') };
  captureServerSettlementEvent(selected, wrong); assert.equal(selected.captureError, true); assert.equal(selected.finalization, undefined);
  const unrelated = state(); captureServerSettlementEvent(unrelated, start()); captureServerSettlementEvent(unrelated, tree());
  const connector = new Transaction(); connector.addInput({ txid: '55'.repeat(32), index: 0 }); connector.addOutput({ amount: 1000n, script: Uint8Array.of(0x51) });
  captureServerSettlementEvent(unrelated, { type: SettlementEventType.TreeTx, id: 'other-batch', topic: [], batchIndex: 1,
    chunk: { txid: connector.id, tx: Buffer.from(connector.toPSBT()).toString('base64'), children: {} } });
  assert.equal(unrelated.connectorChunks, undefined); assert.equal(unrelated.captureError, undefined);
});
