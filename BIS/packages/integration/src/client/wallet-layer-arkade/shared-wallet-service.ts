import type { SettleParams } from '@arkade-os/sdk';

export type SharedWalletFailureCode =
  | 'operator-unavailable'
  | 'policy-unsupported'
  | 'settlement-rejected'
  | 'outcome-unknown';

export type SharedWalletScope = Readonly<{
  walletId: string;
  network: string;
  operator: string;
  role: 'player' | 'game' | 'faucet';
}>;

export type SharedWalletBalance = Readonly<{
  total: number;
  available: number;
  settled: number;
  preconfirmed: number;
  recoverable: number;
  boarding: number;
}>;

export type SharedWalletState = Readonly<{
  scope: SharedWalletScope;
  balance: SharedWalletBalance;
  bitcoinAddress: string;
  arkadeAddress: string;
  history: readonly unknown[];
  operation?: SharedWalletOperation;
}>;

export type SharedWalletOperation = Readonly<{
  id: string;
  scope: SharedWalletScope;
  status: 'prepared' | 'pending' | 'complete' | 'failed';
  stage: 'preparing' | 'registered' | 'participating' | 'signing' | 'broadcast' | 'checking' | 'complete' | 'failed';
  totalSats: number;
  inputs: readonly Readonly<{ txid: string; vout: number; value: number }>[];
  commitmentTxid?: string;
  arkTxid?: string;
  failureCode?: SharedWalletFailureCode;
  failureMessage?: string;
  updatedAt: number;
}>;

export type SharedWalletStore = Readonly<{
  read(): Promise<SharedWalletOperation | undefined> | SharedWalletOperation | undefined;
  write(operation: SharedWalletOperation): Promise<void> | void;
}>;

export type SharedWalletLock = <T>(key: string, work: () => Promise<T>) => Promise<T>;

type WalletLike = {
  arkProvider?: { getInfo(): Promise<any> };
  getBalance(): Promise<any>;
  getBoardingAddress(): Promise<string>;
  getAddress(): Promise<string>;
  getBoardingUtxos(): Promise<readonly any[]>;
  getTransactionHistory?(): Promise<readonly unknown[]>;
  settle(params: SettleParams, onEvent?: (event: unknown) => Promise<void> | void): Promise<string>;
};

const numberValue = (value: unknown) => Number(value ?? 0n);
const now = () => Date.now();
const publicValue = (value: unknown): unknown => {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(publicValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, publicValue(item)]));
  return value;
};

export function normalizeSharedWalletFailure(error: unknown): Error & { code: SharedWalletFailureCode } {
  const message = error instanceof Error ? error.message : String(error ?? 'Arkade settlement failed.');
  const code: SharedWalletFailureCode = /unknown outcome|outcome unknown|ambiguous|connection reset/i.test(message)
    ? 'outcome-unknown'
    : /fee-estimation-unavailable|operator|network|fetch|timeout|503|502/i.test(message)
    ? 'operator-unavailable'
    : /policy|fee|dust|limit|unsupported/i.test(message)
      ? 'policy-unsupported'
      : /intent|batch|settle|commitment|reject|invalid/i.test(message)
        ? 'settlement-rejected'
        : 'outcome-unknown';
  const result = new Error(message) as Error & { code: SharedWalletFailureCode };
  result.code = code;
  return result;
}

function defaultStore(): SharedWalletStore {
  let operation: SharedWalletOperation | undefined;
  return { read: () => operation, write: next => { operation = next; } };
}

function defaultLock<T>(_: string, work: () => Promise<T>) { return work(); }

export function createSharedArkadeWalletService(options: Readonly<{
  scope: SharedWalletScope;
  wallet: WalletLike;
  provider?: { getInfo(): Promise<any> };
  store?: SharedWalletStore;
  lock?: SharedWalletLock;
  operationId?: string;
  clock?: () => number;
}>) {
  const store = options.store ?? defaultStore();
  const lock = options.lock ?? defaultLock;
  const clock = options.clock ?? now;
  const provider = options.provider ?? options.wallet.arkProvider;
  if (!provider) throw new Error('An Arkade provider is required.');
  const requiredProvider = provider;

  const scopeKey = JSON.stringify([options.scope.walletId, options.scope.network, options.scope.operator, options.scope.role]);
  const operationId = options.operationId ?? `onboarding:${options.scope.walletId}:${options.scope.network}`;

  async function read(): Promise<SharedWalletState> {
    const [balance, bitcoinAddress, arkadeAddress, history, operation] = await Promise.all([
      options.wallet.getBalance(),
      options.wallet.getBoardingAddress(),
      options.wallet.getAddress(),
      options.wallet.getTransactionHistory ? options.wallet.getTransactionHistory().catch(() => []) : Promise.resolve([]),
      store.read(),
    ]);
    return Object.freeze({
      scope: options.scope,
      balance: Object.freeze({
        total: numberValue(balance.total),
        available: numberValue(balance.available),
        settled: numberValue(balance.settled),
        preconfirmed: numberValue(balance.preconfirmed),
        recoverable: numberValue(balance.recoverable),
        boarding: numberValue(balance.boarding?.total),
      }),
      bitcoinAddress,
      arkadeAddress,
      history: publicValue(history) as readonly unknown[],
      ...(operation ? { operation } : {}),
    });
  }

  async function prepare() {
    const info = await requiredProvider.getInfo();
    if (info.network && info.network !== options.scope.network) {
      const error = new Error(`Operator network mismatch: expected ${options.scope.network}.`);
      (error as Error & { code: SharedWalletFailureCode }).code = 'operator-unavailable';
      throw error;
    }
    const boarding = (await options.wallet.getBoardingUtxos()).filter(utxo => utxo.status?.confirmed === true);
    const totalSats = boarding.reduce((sum, utxo) => sum + numberValue(utxo.value), 0);
    if (!boarding.length || totalSats <= 0) throw new Error('No confirmed boarding funds are available.');
    const address = await options.wallet.getAddress();
    const inputs = boarding.map(utxo => ({ txid: String(utxo.txid), vout: Number(utxo.vout), value: numberValue(utxo.value) }));
    const params: SettleParams = { inputs: boarding as SettleParams['inputs'], outputs: [{ address, amount: BigInt(totalSats) }] };
    return Object.freeze({ info, params, totalSats, inputs });
  }

  async function onboard() {
    return lock(`arkade-wallet:${scopeKey}`, async () => {
      const before = await read();
      if (before.balance.available > 0) return before;
      const existing = await store.read();
      if (existing && (existing.status === 'pending' || existing.status === 'complete')) return before;
      const prepared = await prepare();
      const base: SharedWalletOperation = {
        id: operationId,
        scope: options.scope,
        status: 'pending',
        stage: 'preparing',
        totalSats: prepared.totalSats,
        inputs: prepared.inputs,
        updatedAt: clock(),
      };
      await store.write(base);
      try {
        await store.write({ ...base, stage: 'participating', updatedAt: clock() });
        const commitmentTxid = await options.wallet.settle(prepared.params, async event => {
          const type = String((event as { type?: unknown })?.type ?? '');
          const stage = type === 'batch_started' ? 'participating' : type.includes('sign') ? 'signing' : type === 'batch_finalization' ? 'broadcast' : base.stage;
          await store.write({ ...base, stage, updatedAt: clock() });
        });
        await store.write({ ...base, status: 'complete', stage: 'complete', commitmentTxid: String(commitmentTxid), updatedAt: clock() });
        return read();
      } catch (cause) {
        const error = normalizeSharedWalletFailure(cause);
        await store.write({ ...base, status: error.code === 'outcome-unknown' ? 'pending' : 'failed', stage: 'failed', failureCode: error.code, failureMessage: error.message, updatedAt: clock() });
        throw error;
      }
    });
  }

  async function settleExact(params: SettleParams, onEvent?: (event: unknown) => Promise<void> | void) {
    return options.wallet.settle(params, onEvent);
  }

  return Object.freeze({ read, prepare, onboard, settleExact, operationId });
}
