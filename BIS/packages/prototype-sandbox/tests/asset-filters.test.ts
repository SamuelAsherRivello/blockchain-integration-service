import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { Wallet, TxType, type Activity, type ArkTransaction, type Vtxo } from '@arkade-os/sdk';
import { runDemo as receive } from '../src/client/demos/receive-asset.ts';
import { runDemo as publicHistory } from '../src/client/demos/asset-history-public.ts';
import { runDemo as privateHistory } from '../src/client/demos/asset-history-private.ts';
import { demoSetInput } from '../src/client/navigation.ts';

const firstAsset = 'a'.repeat(64) + '0000';
const secondAsset = 'b'.repeat(64) + '0000';
const absentAsset = 'c'.repeat(64) + '0000';

function storage(t: TestContext) {
  const values = new Map<string, string>();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, String(value)),
  } });
  t.after(() => original ? Object.defineProperty(globalThis, 'localStorage', original) : Reflect.deleteProperty(globalThis, 'localStorage'));
}

function output(index: number, assetIds?: string[]): Vtxo {
  return {
    outpoint: { txid: index.toString(16).padStart(64, '0'), vout: 0 },
    amount: String(index * 100), script: '5120' + '11'.repeat(32),
    createdAt: '2026-10-27T00:00:00Z', expiresAt: null,
    isPreconfirmed: false, isSwept: false, isUnrolled: false, isSpent: false,
    spentBy: null, commitmentTxids: [],
    ...(assetIds ? { assets: assetIds.map(assetId => ({ assetId, amount: '1' })) } : {}),
  };
}

function activity(vtxo: Vtxo, index: number): Activity {
  const tx: ArkTransaction = {
    key: { arkTxid: vtxo.outpoint.txid, boardingTxid: '', commitmentTxid: '' },
    type: TxType.TxReceived, amount: Number(vtxo.amount), createdAt: index, settled: true,
    ...(vtxo.assets ? { assets: vtxo.assets.map(asset => ({ assetId: asset.assetId, amount: BigInt(asset.amount) })) } : {}),
  };
  // The matching assets are in a later transaction, not necessarily txs[0].
  const satsOnly = { ...tx, assets: undefined };
  return {
    id: `activity-${index}`, amount: tx.amount, createdAt: index, settled: true,
    // Repeated asset-bearing transactions still count as one activity.
    txs: [satsOnly, tx, tx],
  };
}

const mixedOutputs = [output(1), output(2, []), output(3, [firstAsset]), output(4, [secondAsset]), output(5, [secondAsset, firstAsset])];
const demos = [
  { name: 'Receive Asset', run: receive, countLabel: 'VTXOs', private: false, receives: true },
  { name: 'Public Asset History', run: publicHistory, countLabel: 'VTXOs', private: false, receives: false },
  { name: 'Private Asset History', run: privateHistory, countLabel: 'Activities', private: true, receives: false },
];
const selections = [
  { label: '0000', count: 2 },
  { label: '0001', count: 2 },
  { label: 'all', count: 3 },
  { label: '0002', count: 0 }, // Mapped asset absent from the response.
  { label: '0003', count: 0 }, // No local mapping exists.
];

for (const network of ['signet', 'mutinynet'] as const) {
  for (const demo of demos) {
    for (const { label, count } of selections) {
      test(`${network}: ${demo.name} filters ${label} using nested SDK assets`, async t => {
        storage(t);
        demoSetInput(network, 'asset-id', label);
        demoSetInput(network, 'asset-id-0000', firstAsset);
        demoSetInput(network, 'asset-id-0001', secondAsset);
        demoSetInput(network, 'asset-id-0002', absentAsset);
        let disposed = 0;
        if (demo.private) {
          demoSetInput(network, 'wallet-2-mnemonic', 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
          t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected live network request'); });
          t.mock.method(Wallet, 'create', async () => ({
            getContractManager: async () => ({ refreshVtxos: async () => {} }),
            getVtxos: async () => [],
            getActivityHistory: async () => mixedOutputs.map(activity),
            dispose: async () => { disposed++; },
          } as any));
        } else {
          t.mock.method(globalThis, 'fetch', async url => {
            assert.equal(new URL(String(url)).origin, `https://${network}.arkade.sh`);
            return Response.json({ vtxos: mixedOutputs });
          });
        }
        if (demo.receives && count === 0) {
          await assert.rejects(demo.run({ network }), /Use Send Asset demo first/);
        } else {
          const result = await demo.run({ network });
          assert.match(result.output, new RegExp(`Asset filter: ${label}\\n${demo.countLabel}: ${count}\\n`));
          assert.match(result.output, /Success: true$/);
          if (demo.private && count > 0) {
            assert.doesNotMatch(result.output, /Activity \d+: (100|200)(?:\n|$)/);
            assert.match(result.output, new RegExp(`Activity ${label === 'all' ? 3 : 2}: 500\\n`));
          }
        }
        if (demo.private) assert.equal(disposed, 1);
      });
    }

    test(`${network}: ${demo.name} with All excludes a sats-only response`, async t => {
      storage(t);
      demoSetInput(network, 'asset-id', 'all');
      const outputs = [output(1), output(2, [])];
      let disposed = 0;
      if (demo.private) {
        demoSetInput(network, 'wallet-2-mnemonic', 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
        t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected live network request'); });
        t.mock.method(Wallet, 'create', async () => ({
          getContractManager: async () => ({ refreshVtxos: async () => {} }),
          getVtxos: async () => [],
          getActivityHistory: async () => outputs.map(activity),
          dispose: async () => { disposed++; },
        } as any));
      } else {
        t.mock.method(globalThis, 'fetch', async () => Response.json({ vtxos: outputs }));
      }
      if (demo.receives) {
        await assert.rejects(demo.run({ network }), /Use Send Asset demo first/);
      } else {
        const result = await demo.run({ network });
        assert.match(result.output, new RegExp(`${demo.countLabel}: 0\\nSuccess: true$`));
      }
      if (demo.private) assert.equal(disposed, 1);
    });
  }
}
