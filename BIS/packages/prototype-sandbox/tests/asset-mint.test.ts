import assert from 'node:assert/strict';
import test from 'node:test';
import { DemoMintAssetError, demoMintAsset } from '../src/client/asset-mint.ts';

const issuer = '11'.repeat(32);
const script = '5120' + '22'.repeat(32);
const genesis = 'a'.repeat(64);
const assetId = genesis + '0000';
const mintedId = 'b'.repeat(64) + '0000';
const key = (network = 'signet', owner = issuer, id = '0001') => `prototype-sword:${owner}:${network}:${id}`;
const hex = (value: string) => Buffer.from(value).toString('hex');
const legacy = { ticker: '0001', name: 'Sword Level 1', level: '1', upgradePath: 'sword' };

function fixture() {
  const calls: string[] = [];
  const requests: any[] = [];
  const minted: any[] = [];
  const details = new Map<string, any>();
  const pages: any[] = [{ vtxos: [], page: { current: 1, next: 0, total: 0 } }];
  const contracts: any[] = [{ script }];
  const output = (spent = false, txid = genesis) => ({ script, txid, vout: 0, isSpent: spent, assets: [{ assetId, amount: '1' }] });
  const history = (...outputs: any[]) => { pages[0] = { vtxos: outputs, page: { current: 1, next: outputs.length ? 1 : 0, total: outputs.length ? 1 : 0 } }; };
  const wallet = {
    identity: { xOnlyPublicKey: async () => Uint8Array.from(Buffer.from(issuer, 'hex')) },
    restore: async (options: any) => { calls.push('restore'); assert.deepEqual(options, { gapLimit: 20 }); },
    getContractManager: async () => ({ getContracts: async () => { calls.push('contracts'); return contracts; } }),
    indexerProvider: { getVtxos: async (request: any) => {
      calls.push('history'); requests.push(request);
      return pages[requests.length - 1];
    } },
    assetManager: {
      getAssetDetails: async (id: string) => { calls.push(`details:${id}`); if (!details.has(id)) throw new Error('Unavailable metadata'); return details.get(id); },
      issue: async (request: any) => {
        calls.push('issue'); minted.push(request);
        details.set(mintedId, { assetId: mintedId, metadata: request.metadata, supply: 1n });
        return { assetId: mintedId, arkTxId: mintedId.slice(0, 64) };
      },
    },
  };
  return { calls, requests, minted, details, pages, contracts, output, history, wallet: wallet as unknown as Parameters<typeof demoMintAsset>[0] };
}

test('first mint checks network history before issue and verifies immutable identity afterward', async () => {
  const f = fixture();
  const result = await demoMintAsset(f.wallet, 'signet', '0001');
  assert.equal(result.assetId, mintedId);
  assert.deepEqual(f.calls, ['restore', 'contracts', 'history', 'issue', `details:${mintedId}`]);
  assert.deepEqual(f.requests, [{ scripts: [script], pageIndex: 0, pageSize: 100 }]);
  assert.equal(f.minted[0].metadata.prototypeMintKey, key());
  assert.equal(f.minted[0].metadata.prototypeAssetID, '0001');
  assert.equal(f.minted[0].amount, 1n);
});

for (const state of ['owned', 'transferred', 'burned', 'upgraded']) {
  test(`duplicate is rejected from ${state} genesis history without a saved browser mapping`, async () => {
    const f = fixture();
    f.pages[0] = { vtxos: [f.output(state !== 'owned')], page: { current: 1, next: 1, total: 1 } };
    f.details.set(assetId, { assetId, metadata: { prototypeMintKey: hex(key()) }, supply: state === 'burned' ? 0n : 1n });
    await assert.rejects(demoMintAsset(f.wallet, 'signet', '0001'), error => {
      assert.ok(error instanceof DemoMintAssetError);
      assert.match(error.message, /AssetID 0001 already exists/);
      assert.equal(error.assetId, assetId);
      return true;
    });
    assert.equal(f.minted.length, 0);
  });
}

test('a duplicate on a later, short history page still prevents issuance', async () => {
  const f = fixture();
  f.pages.splice(0, 1,
    { vtxos: [{ ...f.output(), assets: [] }], page: { current: 1, next: 2, total: 2 } },
    { vtxos: [f.output(true)], page: { current: 2, next: 2, total: 2 } });
  f.details.set(assetId, { assetId, metadata: legacy });
  await assert.rejects(demoMintAsset(f.wallet, 'signet', '0001'), /already exists/);
  assert.equal(f.requests[1].pageIndex, 2);
  assert.equal(f.minted.length, 0);
});

for (const encoded of [false, true]) {
  test(`legacy mints are found using ${encoded ? 'encoded' : 'decoded'} immutable sword metadata`, async () => {
    const f = fixture();
    f.history(f.output(true));
    f.details.set(assetId, { assetId, metadata: Object.fromEntries(Object.entries(legacy).map(([k, v]) => [k, encoded ? hex(v) : v])) });
    await assert.rejects(demoMintAsset(f.wallet, 'signet', '0001'), /already exists/);
    assert.equal(f.minted.length, 0);
  });
}

test('receiving another wallet\'s old sword does not reserve this wallet\'s AssetID', async () => {
  const f = fixture();
  f.history(f.output(false, 'c'.repeat(64)));
  f.details.set(assetId, { assetId, metadata: legacy });
  await demoMintAsset(f.wallet, 'signet', '0001');
  assert.equal(f.minted.length, 1);
});

for (const [network, owner, id] of [['mutinynet', issuer, '0001'], ['signet', '33'.repeat(32), '0001'], ['signet', issuer, '0002']]) {
  test(`a different network, issuer or AssetID does not collide: ${network}/${owner.slice(0, 2)}/${id}`, async () => {
    const f = fixture();
    f.history(f.output());
    f.details.set(assetId, { assetId, metadata: { prototypeMintKey: key(network, owner, id) } });
    await demoMintAsset(f.wallet, 'signet', '0001');
    assert.equal(f.minted.length, 1);
  });
}

test('all discovered scripts are checked, with repeated asset IDs fetched only once', async () => {
  const f = fixture();
  f.contracts.push(...Array.from({ length: 21 }, (_, i) => ({ script: '5120' + (i + 3).toString(16).padStart(64, '0') })));
  f.pages.splice(0, 1,
    { vtxos: [f.output(), f.output(true)], page: { current: 1, next: 1, total: 1 } },
    { vtxos: [], page: { current: 1, next: 0, total: 0 } });
  f.details.set(assetId, { assetId });
  await demoMintAsset(f.wallet, 'signet', '0001');
  assert.equal(f.requests.length, 2);
  assert.equal(f.requests[0].scripts.length, 20);
  assert.equal(f.requests[1].scripts.length, 2);
  assert.equal(f.calls.filter(call => call === `details:${assetId}`).length, 1);
});

const failureCases: Record<string, (f: ReturnType<typeof fixture>) => void> = {
  'failed HD discovery': f => { f.wallet.restore = async () => { throw new AggregateError([], 'scan truncated'); }; },
  'failed contract read': f => { f.wallet.getContractManager = async () => { throw new Error('unavailable'); }; },
  'no discovered scripts': f => { f.contracts.length = 0; },
  'failed history call': f => { f.wallet.indexerProvider.getVtxos = async () => { throw new Error('timeout'); }; },
  'failed later page': f => { f.pages[0] = { vtxos: [f.output()], page: { current: 1, next: 2, total: 2 } }; },
  'missing pagination': f => { f.pages[0] = { vtxos: [] }; },
  'stalled pagination': f => { f.pages[0] = { vtxos: [f.output()], page: { current: 1, next: 1, total: 2 } }; },
  'empty intermediate page': f => { f.pages[0].page = { current: 1, next: 2, total: 2 }; },
  'skipped page': f => { f.pages[0] = { vtxos: [f.output()], page: { current: 1, next: 3, total: 3 } }; },
  'wrong page returned': f => { f.pages[0] = { vtxos: [f.output()], page: { current: 2, next: 0, total: 2 } }; },
  'malformed history': f => { f.history({ txid: genesis }); },
  'malformed asset ID': f => { f.history({ ...f.output(), assets: [{ assetId: 'bad' }] }); },
  'unavailable metadata': f => { f.history(f.output()); },
  'mismatched asset details': f => { f.history(f.output()); f.details.set(assetId, { assetId: mintedId }); },
};
for (const [name, setup] of Object.entries(failureCases)) {
  test(`${name} blocks issuance`, async () => {
    const f = fixture(); setup(f);
    await assert.rejects(demoMintAsset(f.wallet, 'signet', '0001'), /Unable to verify whether AssetID 0001 exists.*No mint was submitted/);
    assert.equal(f.minted.length, 0);
  });
}

test('post-submission verification failure reports an unresolved mint with its real ID', async () => {
  const f = fixture();
  f.wallet.assetManager.getAssetDetails = async () => { throw new Error('indexer not ready'); };
  await assert.rejects(demoMintAsset(f.wallet, 'signet', '0001'), error => {
    assert.ok(error instanceof DemoMintAssetError);
    assert.match(error.message, /Mint submitted.*unresolved/);
    assert.equal(error.assetId, mintedId);
    return true;
  });
  assert.equal(f.minted.length, 1);
});

test('mint submission errors are propagated without replaying the issuance', async () => {
  const f = fixture();
  f.wallet.assetManager.issue = async () => { f.minted.push('attempt'); throw new Error('submission outcome unknown'); };
  await assert.rejects(demoMintAsset(f.wallet, 'signet', '0001'), /submission outcome unknown/);
  assert.equal(f.minted.length, 1);
});
