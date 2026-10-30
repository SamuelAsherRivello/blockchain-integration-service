
//////////////////////////////////////////
// Arrange
//////////////////////////////////////////
import {
  demoResult,
  demoGetInput,
  demoOpenEventsMonitor,
  networkDefinition,
  validateArkadeAddress,
  type DemoContext,
} from '../sandbox-shared.ts';
import { ArkAddress, RestArkProvider, RestIndexerProvider, type SubscriptionResponse, type VirtualCoin } from '@arkade-os/sdk';

export type MonitorStatus = 'Connecting ...' | "I'm listening ..." | 'Reconnecting ...' | 'Listener unavailable';
export type WalletActivity = {
  id: string;
  message: string;
  outpoints: string[];
  transactionId?: string;
};
type Transition = 'received' | 'spent' | 'swept';
const point = (coin: VirtualCoin) => `${coin.txid}:${coin.vout}`;
export function publicAddressScript(address: string) {
  return '5120' + Array.from(ArkAddress.decode(address).vtxoTaprootKey, b => b.toString(16).padStart(2, '0')).join('');
}
/** In-memory transition ledger. Baseline holdings are history, never notifications. */
export function createEventLedger(script: string) {
  const seen = new Set<string>();
  const key = (kind: Transition, coin: VirtualCoin) => `${kind}:${point(coin)}`;
  const kinds = (coin: VirtualCoin): Transition[] => ['received', ...(coin.isSpent || coin.spentBy ? ['spent' as const] : []), ...(coin.isSwept ? ['swept' as const] : [])];
  return {
    baseline(coins: VirtualCoin[]) {
      for (const coin of coins.filter(c => c.script === script))
        for (const kind of kinds(coin))
          seen.add(key(kind, coin));
    },
    consume(frame: Partial<SubscriptionResponse>): WalletActivity | undefined {
      const messages: string[] = [], identities: string[] = [], outpoints: string[] = [];
      for (const [kind, coins] of [['received', frame.newVtxos], ['spent', frame.spentVtxos], ['swept', frame.sweptVtxos]] as const) {
        const fresh = (coins ?? []).filter(coin => coin.script === script && !seen.has(key(kind, coin)));
        if (!fresh.length)
          continue;
        let sats = 0n;
        const assets = new Map<string, bigint>();
        for (const coin of fresh) {
          const id = key(kind, coin);
          if (seen.has(id))
            continue;
          seen.add(id);
          identities.push(id);
          outpoints.push(point(coin));
          sats += BigInt(coin.value);
          for (const asset of coin.assets ?? [])
            assets.set(asset.assetId, (assets.get(asset.assetId) ?? 0n) + BigInt(asset.amount));
        }
        const label = kind === 'received' ? 'Received' : kind === 'spent' ? 'Outputs spent:' : 'Outputs swept:';
        const holdings = [...assets].map(([id, amount]) => `${amount} ${amount === 1n ? 'unit' : 'units'} of asset ${id}`);
        messages.push(`${label} ${[`${sats} sats`, ...holdings].join(' and ')}`);
      }
      if (!identities.length)
        return;
      return { id: identities.sort().join('|'), message: messages.join('\n'), outpoints, transactionId: frame.txid };
    },
    reconcile(coins: VirtualCoin[]) {
      return this.consume({ newVtxos: coins, spentVtxos: coins.filter(c => c.isSpent || c.spentBy), sweptVtxos: coins.filter(c => c.isSwept) });
    },
  };
}
type Provider = Pick<RestIndexerProvider, 'getVtxos' | 'subscribeForScripts' | 'getSubscription' | 'unsubscribeForScripts'>;
type ObserverOptions = {
  network: string;
  address: string;
  onStatus(status: MonitorStatus): void;
  onActivity(event: WalletActivity): void;
  providerFactory?: (connection: (online: boolean) => void) => Provider;
  validate?: () => Promise<void>;
  retryMs?: number;
  timeoutMs?: number;
};
/** One popup owns one observer. No wallet, repositories, keys, or setup storage. */
export function observeWalletEvents(options: ObserverOptions) {
  const { operator } = networkDefinition(options.network);
  const script = publicAddressScript(options.address);
  const ledger = createEventLedger(script);
  let stopped = false, initialized = false, generation = 0, retry = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let cleanup: () => void = () => { };
  const emit = (event?: WalletActivity) => {
    if (!stopped && event)
      options.onActivity(event);
  };
  async function attempt() {
    if (stopped)
      return;
    const current = ++generation;
    const active = () => !stopped && generation === current;
    options.onStatus(initialized ? 'Reconnecting ...' : 'Connecting ...');
    const abort = new AbortController();
    let subscription: string | undefined, prepared = false, online = false;
    let buffer: SubscriptionResponse[] = [];
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let wakePoll: () => void = () => { };
    let fail: (error: Error) => void = () => { };
    const failed = new Promise<never>((_, reject) => { fail = reject; });
    // Always observe rejection, including failures arriving after setup completes.
    void failed.catch(() => { });
    const provider = options.providerFactory?.(connection) ?? new RestIndexerProvider(operator, {
      eventSource(url) {
        const source = new EventSource(url);
        source.addEventListener('open', () => connection(true));
        source.addEventListener('error', () => connection(false));
        return source;
      },
    });
    function connection(value: boolean) {
      if (!active())
        return;
      online = value;
      if (value)
        wakePoll();
      else {
        options.onStatus('Reconnecting ...');
        fail(new Error('stream-disconnected'));
      }
    }
    const offline = () => connection(false);
    globalThis.addEventListener?.('offline', offline);
    const timer = setTimeout(() => fail(new Error('preparation-timeout')), options.timeoutMs ?? 75000);
    const release = () => {
      globalThis.removeEventListener?.('offline', offline);
      clearTimeout(timer);
      clearTimeout(pollTimer);
      abort.abort();
      wakePoll();
      if (subscription) {
        void provider.unsubscribeForScripts(subscription).catch(() => { });
        subscription = undefined;
      }
    };
    cleanup = () => { release(); fail(new Error('disposed')); };
    async function snapshot() {
      const coins: VirtualCoin[] = [];
      for (let index = 0;; index++) {
        if (!active() || abort.signal.aborted)
          throw new Error('disposed');
        const page = await provider.getVtxos({ scripts: [script], pageIndex: index, pageSize: 500 });
        if (!active() || abort.signal.aborted)
          throw new Error('disposed');
        coins.push(...page.vtxos);
        if (!page.page || page.page.current >= page.page.total || page.vtxos.length < 500 || page.page.next <= page.page.current)
          return coins;
      }
    }
    async function prepare() {
      await (options.validate?.() ?? (async () => {
        const info = await new RestArkProvider(operator).getInfo();
        validateArkadeAddress(options.address, info, options.network);
      })());
      if (!active() || abort.signal.aborted)
        return;
      if (!initialized) {
        const baseline = await snapshot();
        if (!active() || abort.signal.aborted)
          return;
        ledger.baseline(baseline);
        initialized = true;
      }
      const id = await provider.subscribeForScripts([script]);
      subscription = id;
      if (!active() || abort.signal.aborted) {
        release();
        return;
      }
      void (async () => {
        for await (const frame of provider.getSubscription(id, abort.signal)) {
          if (!active())
            return;
          if (prepared)
            emit(ledger.consume(frame));
          else
            buffer.push(frame);
        }
        if (active())
          fail(new Error('stream-ended'));
      })().catch(() => {
        if (active())
          fail(new Error('stream-failed'));
      });
      const coins = await snapshot();
      if (!active() || abort.signal.aborted)
        return;
      // Merge buffered frames before the later snapshot so it cannot hide arrivals.
      for (const frame of buffer)
        emit(ledger.consume(frame));
      buffer = [];
      emit(ledger.reconcile(coins));
      prepared = true;
      retry = 0;
      clearTimeout(timer);
      // A working indexer snapshot starts observation immediately. The operator
      // may not flush SSE headers until its first heartbeat or payment event.
      options.onStatus("I'm listening ...");
      while (!online) {
        await new Promise<void>(resolve => {
          wakePoll = resolve;
          pollTimer = setTimeout(resolve, 2000);
        });
        clearTimeout(pollTimer);
        if (!active() || abort.signal.aborted)
          return;
        // One last snapshot closes the gap when polling hands over to SSE.
        const latest = await snapshot();
        if (!active() || abort.signal.aborted)
          return;
        emit(ledger.reconcile(latest));
      }
    }
    try {
      await Promise.race([prepare(), failed]);
      if (active())
        await failed;
    }
    catch {
      release();
      // Invalidate late snapshots and connection callbacks before scheduling replacement.
      if (!active())
        return;
      generation++;
      options.onStatus('Listener unavailable');
      retryTimer = setTimeout(() => { void attempt(); }, Math.min(5000, (options.retryMs ?? 1000) * 2 ** Math.min(retry++, 3)));
    }
  }
  void attempt();
  return () => { stopped = true; generation++; clearTimeout(retryTimer); cleanup(); };
}
export async function runDemo({ network }: DemoContext) {
  const address = demoGetInput(network, 'wallet-1-address');

  //////////////////////////////////////////
  // Act
  //////////////////////////////////////////
  const decoded = ArkAddress.decode(address);
  demoOpenEventsMonitor(network, decoded.encode());

  //////////////////////////////////////////
  // Assert
  //////////////////////////////////////////
  return demoResult('Monitor window opened. Wait for its listening message, then use another demo.\nNo payment has been initiated.\nSuccess: true');
}
