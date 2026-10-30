import type { TestNetwork } from '../../../integration/src/client/state-layer-core/test-network.ts';
import type { OutputDetails } from './demo-output-store.ts';
import { firstArkTransaction } from './demo-explorer.ts';

export type DemoContext = Readonly<{
  network: TestNetwork;
  recover?: boolean;
  amount?: string;
  externalAddress?: string;
  externalWalletWindow?: Window | null;
  treasure?: Readonly<{
    action: 'start' | 'check' | 'claim' | 'reject';
  }>;
}>;

export type DemoResult = Readonly<{
  output: string;
  details?: OutputDetails;
  compiledSource?: string;
  pending?: boolean;
  data?: unknown;
}>;

export function demoResult(output: string, details?: OutputDetails): DemoResult {
  return { output, details };
}

export async function demoDisposeWallet(wallet?: { dispose?: () => Promise<void> }) {
  try { await wallet?.dispose?.(); } catch { /* Preserve the operation's result or error. */ }
}

export function demoErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/** Persistence only. A saved request never establishes a network outcome. */
export function demoReadRecoveryRequest<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) as T : null;
}
export function demoWriteRecoveryRequest(key: string, request: unknown) {
  localStorage.setItem(key, JSON.stringify(request));
}
export function demoClearRecoveryRequest(key: string) {
  localStorage.removeItem(key);
}
export function demoRecoveryStorage() {
  return globalThis.localStorage;
}

export function demoTransactionDetails(network: TestNetwork, values: unknown): OutputDetails {
  const identifier = firstArkTransaction(values);
  return identifier ? { explorer: { network, kind: 'ark-transaction', identifier } } : {};
}

/** Fields consumed by the sandbox's public indexer response and history views. */
export type DemoHistoryEntry = {
  amount?: string | number | bigint;
  assets?: { assetId: string }[];
  txs?: { assets?: { assetId: string }[] }[];
  type?: string;
  txid?: string;
  key?: { arkTxid?: string };
};

export function numberedPreviews<T>(items: T[], getValue: (item: T) => unknown, label = 'Activity') {
  return items.map((item, index) => `${label} ${index + 1}: ${getValue(item)}`);
}

export class DemoMintAssetError extends Error {
  readonly assetId?: string;
  constructor(message: string, assetId?: string) {
    super(message);
    this.name = 'DemoMintAssetError';
    this.assetId = assetId;
  }
}
