import assert from 'node:assert/strict';
import test from 'node:test';
import { createEventLedger, observeWalletEvents, publicAddressScript } from '../src/client/wallet-events.ts';
import { DEFAULT_WALLET_1_ADDRESSES } from '../src/client/navigation.ts';

const script = publicAddressScript(DEFAULT_WALLET_1_ADDRESSES.signet);
const coin = (id: string, extra = {}) => ({ txid: id, vout: 0, script, value: 100n, ...extra }) as any;
const tick = () => new Promise(resolve => setImmediate(resolve));

test('historical baseline is quiet, foreign outputs are filtered, exact asset amounts survive', () => {
  const ledger = createEventLedger(script), old = coin('old');
  ledger.baseline([old]);
  assert.equal(ledger.consume({ newVtxos: [old, coin('foreign', { script: 'other' })] }), undefined);
  const asset = coin('asset', { assets: [{ assetId: 'item', amount: 9007199254740993123n }] });
  assert.match(ledger.consume({ newVtxos: [asset] })!.message, /9007199254740993123 units of asset item/);
  assert.equal(ledger.consume({ newVtxos: [asset] }), undefined);
  assert.match(ledger.consume({ spentVtxos: [old] })!.message, /Outputs spent/);
  assert.equal(ledger.consume({ spentVtxos: [old] }), undefined);
  assert.match(ledger.consume({ sweptVtxos: [old] })!.message, /Outputs swept/);
  assert.match(ledger.consume({ spentVtxos: [coin('unseen')] })!.message, /Outputs spent/);
});

test('buffered receipt survives second snapshot, replay is quiet, disposal releases stream', async () => {
  let connection: (value: boolean) => void, finishSnapshot: (value: any) => void;
  let publish: (value: any) => void, finishStream: () => void;
  let reads = 0, unsubscribed = 0;
  const statuses: string[] = [], events: any[] = [];
  const received = coin('new');
  const stop = observeWalletEvents({ network: 'signet', address: DEFAULT_WALLET_1_ADDRESSES.signet,
    validate: async () => {}, onStatus: s => statuses.push(s), onActivity: e => events.push(e),
    providerFactory: ready => {
      connection = ready;
      return {
        getVtxos: async () => ++reads === 1 ? { vtxos: [coin('old')] } : new Promise(resolve => { finishSnapshot = resolve; }),
        subscribeForScripts: async () => 'subscription',
        unsubscribeForScripts: async () => { unsubscribed++; },
        async *getSubscription(_id, signal) {
          connection(true);
          while (!signal.aborted) {
            const frame = await new Promise<any>(resolve => { publish = resolve; finishStream = () => resolve(undefined); signal.addEventListener('abort', finishStream, { once: true }); });
            if (frame) yield frame;
          }
        },
      } as any;
    },
  });
  await tick();
  assert.ok(!statuses.includes("I'm listening ..."));
  publish!({ newVtxos: [received] }); await tick();
  finishSnapshot!({ vtxos: [coin('old'), received] }); await tick();
  assert.equal(events.length, 1);
  assert.equal(statuses.at(-1), "I'm listening ...");
  publish!({ newVtxos: [received] }); await tick(); assert.equal(events.length, 1);
  stop(); await tick(); assert.equal(unsubscribed, 1);
  connection!(false); await tick(); assert.equal(statuses.at(-1), "I'm listening ...");
});

test('indexer polling observes arrivals before SSE opens and deduplicates the handover', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let connection: (value: boolean) => void, publish: (value: any) => void;
  let reads = 0, released = 0;
  let coins = [coin('old')];
  const statuses: string[] = [], events: any[] = [];
  const stop = observeWalletEvents({ network: 'signet', address: DEFAULT_WALLET_1_ADDRESSES.signet,
    validate: async () => {}, onStatus: s => statuses.push(s), onActivity: e => events.push(e),
    providerFactory: ready => {
      connection = ready;
      return { getVtxos: async () => { reads++; return { vtxos: coins }; },
        subscribeForScripts: async () => 'subscription', unsubscribeForScripts: async () => { released++; },
        async *getSubscription(_id, signal) {
          while (!signal.aborted) {
            const frame = await new Promise<any>(resolve => {
              publish = resolve;
              signal.addEventListener('abort', () => resolve(undefined), { once: true });
            });
            if (frame) yield frame;
          }
        },
      } as any;
    },
  });
  t.after(stop);
  await tick();
  assert.equal(statuses.at(-1), "I'm listening ...", 'real snapshots enable observation without a stream heartbeat');
  assert.equal(reads, 2); assert.equal(events.length, 0, 'baseline holdings stay quiet');
  const received = coin('new', { assets: [{ assetId: 'item', amount: 42n }] });
  coins = [...coins, received];
  t.mock.timers.tick(2000); await tick();
  assert.equal(reads, 3); assert.equal(events.length, 1);
  assert.match(events[0].message, /42 units of asset item/);
  publish!({ newVtxos: [received] }); await tick();
  assert.equal(events.length, 1, 'the stream does not replay a polled receipt');
  const duringHandover = coin('handover');
  coins = [...coins, duringHandover];
  connection!(true); await tick();
  assert.equal(reads, 4); assert.equal(events.length, 2, 'a final snapshot covers the handover gap');
  publish!({ newVtxos: [duringHandover] }); await tick();
  assert.equal(events.length, 2);
  t.mock.timers.tick(10000); await tick();
  assert.equal(reads, 4, 'polling stops once the event stream opens');
  publish!({ spentVtxos: [received] }); await tick();
  assert.match(events.at(-1).message, /Outputs spent/);
  stop(); await tick(); assert.equal(released, 1);
});

test('closing during stream startup cancels polling and ignores late snapshots', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let reads = 0, released = 0, resolveSnapshot: (value: any) => void;
  const events: any[] = [], statuses: string[] = [];
  const stop = observeWalletEvents({ network: 'signet', address: DEFAULT_WALLET_1_ADDRESSES.signet,
    validate: async () => {}, onStatus: s => statuses.push(s), onActivity: e => events.push(e),
    providerFactory: () => ({
      getVtxos: async () => ++reads <= 2 ? { vtxos: [] } : new Promise(resolve => { resolveSnapshot = resolve; }),
      subscribeForScripts: async () => 'subscription', unsubscribeForScripts: async () => { released++; },
      async *getSubscription(_id, signal) { await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true })); },
    }) as any,
  });
  t.after(stop);
  await tick(); t.mock.timers.tick(2000); await tick(); assert.equal(reads, 3);
  stop(); resolveSnapshot!({ vtxos: [coin('late')] }); await tick();
  t.mock.timers.tick(10000); await tick();
  assert.equal(reads, 3); assert.equal(released, 1); assert.equal(events.length, 0);
  assert.equal(statuses.at(-1), "I'm listening ...");
});

test('a failed startup poll stops claiming listening and retries without historical alerts', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let reads = 0, subscriptions = 0, released = 0;
  const statuses: string[] = [], events: any[] = [];
  const stop = observeWalletEvents({ network: 'signet', address: DEFAULT_WALLET_1_ADDRESSES.signet,
    validate: async () => {}, onStatus: s => statuses.push(s), onActivity: e => events.push(e),
    providerFactory: () => ({
      getVtxos: async () => {
        if (++reads === 3) throw new Error('indexer unavailable');
        return { vtxos: [coin('old')] };
      },
      subscribeForScripts: async () => String(++subscriptions), unsubscribeForScripts: async () => { released++; },
      async *getSubscription(_id, signal) { await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true })); },
    }) as any,
  });
  t.after(stop);
  await tick(); assert.equal(statuses.at(-1), "I'm listening ...");
  t.mock.timers.tick(2000); await tick();
  assert.equal(statuses.at(-1), 'Listener unavailable'); assert.equal(released, 1);
  t.mock.timers.tick(1000); await tick();
  assert.equal(subscriptions, 2); assert.equal(reads, 4);
  assert.equal(statuses.at(-1), "I'm listening ..."); assert.equal(events.length, 0);
  stop(); t.mock.timers.tick(10000); await tick();
  assert.equal(reads, 4, 'closing clears the pending poll timer'); assert.equal(released, 2);
});

test('connection failure replaces one stream and late callbacks cannot affect new state', async () => {
  const connections: ((value: boolean) => void)[] = [], events: any[] = [], statuses: string[] = [];
  let subscriptions = 0, released = 0;
  const stop = observeWalletEvents({ network: 'signet', address: DEFAULT_WALLET_1_ADDRESSES.signet,
    validate: async () => {}, onStatus: s => statuses.push(s), onActivity: e => events.push(e), retryMs: 1,
    providerFactory: ready => {
      connections.push(ready);
      return { getVtxos: async () => ({ vtxos: [coin('old')] }),
        subscribeForScripts: async () => String(++subscriptions), unsubscribeForScripts: async () => { released++; },
        async *getSubscription(_id, signal) { ready(true); await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true })); },
      } as any;
    },
  });
  await tick(); connections[0](false);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(subscriptions, 2); assert.equal(released, 1); assert.equal(events.length, 0);
  const length = statuses.length; connections[0](false); assert.equal(statuses.length, length);
  stop(); await tick(); assert.equal(released, 2);
});

test('stalled setup times out, never reports listening, and cleans a late subscription', async () => {
  let resolveSubscription: (id: string) => void, released = 0;
  const statuses: string[] = [];
  const stop = observeWalletEvents({ network: 'signet', address: DEFAULT_WALLET_1_ADDRESSES.signet,
    onStatus: s => statuses.push(s), onActivity() { assert.fail('unexpected activity'); }, validate: async () => {}, timeoutMs: 5, retryMs: 1000,
    providerFactory: () => ({ getVtxos: async () => ({ vtxos: [] }), subscribeForScripts: () => new Promise(resolve => { resolveSubscription = resolve; }),
      unsubscribeForScripts: async () => { released++; }, async *getSubscription() {},
    }) as any,
  });
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(statuses.at(-1), 'Listener unavailable');
  assert.ok(!statuses.includes("I'm listening ..."));
  resolveSubscription!('late'); await tick(); assert.equal(released, 1); stop();
});
