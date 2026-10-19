import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectContractSetup } from '../../src/client/wallet-layer-arkade/contract-setup.ts';

const userKey = Uint8Array.from(Buffer.from('79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798', 'hex'));
const operatorKey = '02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5';
function fixture(network = 'signet', overrides = {}) {
  return { ark: { getInfo: async () => ({ network, signerPubkey: operatorKey, unilateralExitDelay: 1024n,
    fees: { txFeeRate: '0', intentFee: { offchainInput: '', offchainOutput: '0.0' } }, ...overrides }) },
    indexer: { getVtxos: async () => ({ vtxos: [] }) } };
}
for (const network of ['signet', 'mutinynet'] as const) {
  test(`${network}: setup round-trips scripts and SDK PSBTs using public keys only`, async () => {
    const result = await inspectContractSetup(network, userKey, fixture(network) as never);
    assert.equal(result.network, network);
    assert.equal(result.scriptRoundtrip, true);
    assert.equal(result.fundedAcceptance, false);
    assert.match(result.pkScript, /^5120[0-9a-f]{64}$/);
  });
}
test('setup rejects mismatched network, untrusted input encoding and unsupported fees', async () => {
  await assert.rejects(inspectContractSetup('signet', userKey, fixture('mutinynet') as never), /network-mismatch/);
  await assert.rejects(inspectContractSetup('signet', userKey, fixture('signet', { signerPubkey: 'bad' }) as never), /invalid-operator-key/);
  await assert.rejects(inspectContractSetup('signet', userKey, fixture('signet', { fees: { txFeeRate: '1', intentFee: {} } }) as never), /unsupported-fees/);
  await assert.rejects(inspectContractSetup('signet', new Uint8Array(31), fixture() as never), /invalid-public-key/);
});
