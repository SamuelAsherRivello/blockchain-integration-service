import test from 'node:test';
import assert from 'node:assert/strict';
import type { ArkInfo } from '@arkade-os/sdk';
import { Address } from '@scure/btc-signer';
import { getNetwork } from '@arkade-os/sdk';
import { readSettlementBatchInfo } from '../src/server/settlement-batch-info.ts';

const facts = { network: 'signet', signerPubkey: '02' + '11'.repeat(32), forfeitPubkey: '03' + '22'.repeat(32) } as ArkInfo;
const signal = () => new AbortController().signal;

test('fresh batch parameters retain exact network keys and never invent an absent advertised expiry', async () => {
  const value = await readSettlementBatchInfo('signet', signal(), async () => facts);
  assert.deepEqual(value, { network: 'signet', publicKey: facts.signerPubkey, forfeitPublicKey: facts.forfeitPubkey, advertisedBatchExpiry: undefined });
  assert.equal((await readSettlementBatchInfo('signet', signal(), async () => ({ ...facts, vtxoTreeExpiry: 86528n }))).advertisedBatchExpiry, 86528n);
});

test('network/key mismatch and unavailable provider facts cannot return batch authority', async () => {
  for (const changed of [{ ...facts, network: 'mutinynet' }, { ...facts, signerPubkey: 'invalid' }, { ...facts, forfeitPubkey: '04' + '11'.repeat(32) }, { ...facts, vtxoTreeExpiry: 0n }]) {
    await assert.rejects(readSettlementBatchInfo('signet', signal(), async () => changed), /unavailable/);
  }
  await assert.rejects(readSettlementBatchInfo('signet', signal(), async () => { throw Error('untrusted provider detail'); }), error => (error as Error).message === 'Fresh settlement batch info unavailable.');
});

test('cancellation ends the bounded read and late provider completion cannot return authority', async () => {
  const controller = new AbortController(); let resolve!: (info: ArkInfo) => void;
  const pending = new Promise<ArkInfo>(done => { resolve = done; });
  const read = readSettlementBatchInfo('signet', controller.signal, () => pending);
  controller.abort(); await assert.rejects(read, /unavailable/); resolve(facts);
  await assert.rejects(readSettlementBatchInfo('signet', controller.signal, async () => facts));
});

test('forfeit destination is decoded only from fixed-network provider facts', async () => {
  const pubkey = Uint8Array.from(new Array(32).fill(0x33));
  const forfeitAddress = Address(getNetwork('signet')).encode({ type: 'tr', pubkey });
  assert.equal((await readSettlementBatchInfo('signet', signal(), async () => ({ ...facts, forfeitAddress }))).forfeitScript, '5120' + '33'.repeat(32));
  for (const address of ['not-a-bitcoin-address', Address(getNetwork('bitcoin')).encode({ type: 'tr', pubkey })]) {
    await assert.rejects(readSettlementBatchInfo('signet', signal(), async () => ({ ...facts, forfeitAddress: address })), /unavailable/);
  }
});
