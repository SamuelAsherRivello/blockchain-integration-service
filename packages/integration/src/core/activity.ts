export type BisTransaction = Readonly<{
  id: string;
  amountSats: number;
  direction: 'Incoming' | 'Outgoing';
  status: 'Pending' | 'Confirmed' | 'Settled offchain' | 'Pending offchain' | 'Status unavailable';
  identifier: string;
  createdAt?: number;
}>;
export type BisActivity = Readonly<{ status: 'idle' | 'loading' | 'unavailable' }> |
  Readonly<{ status: 'ready'; transactions: readonly BisTransaction[] }>;
export function formatTransactions(transactions: readonly BisTransaction[]): string {
  return transactions.map(t => `${t.amountSats} sats | ${t.direction} | ${t.status} | ${t.identifier}`).join('\n');
}
