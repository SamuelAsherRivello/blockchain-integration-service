import type { BisTransaction } from './activity';

export type WalletOperation = Readonly<{
  id: string; transactionId?: string; amountSats?: number; reservedInputSats?: number;
  inputsKnown: boolean; canDiscard: boolean; direction?: BisTransaction['direction'];
}>;
export type WalletOperationsReport = Readonly<{
  availableSats?: number; totalSats?: number; reservedInputSats?: number;
  operations: readonly WalletOperation[]; reason?: string;
}>;

export function operationMatches(row: BisTransaction, operation: WalletOperation): boolean {
  const [kind, ...parts] = operation.id.split(':');
  const id = parts.join(':');
  const label = kind === 'transfer' ? 'operation' : `${kind}-operation`;
  return row.id === operation.id || row.identifier.split(/\s+/).includes(`${label}:${id}`) ||
    !!operation.transactionId && row.identifier.split(/\s+/).includes(`ark:${operation.transactionId}`);
}

/** Supplement network history without inventing network outcomes or duplicate rows. */
export function withWalletOperationActivity(rows: readonly BisTransaction[], operations: readonly WalletOperation[]): readonly BisTransaction[] {
  const result = [...rows];
  const missing: BisTransaction[] = [];
  for (const operation of operations) {
    if ([...result, ...missing].some(row => operationMatches(row, operation))) {
      if (operation.canDiscard) for (let i = 0; i < result.length; i++) {
        if (operationMatches(result[i], operation)) result[i] = {...result[i], status: 'Not submitted'};
      }
      continue;
    }
    const kind = operation.id.split(':')[0];
    missing.push({
      id: operation.id, identifier: `${operation.id}${operation.transactionId ? ` ark:${operation.transactionId}` : ''}`,
      amountSats: operation.amountSats ?? 0, satsUnknown: operation.amountSats === undefined,
      direction: operation.direction ?? (kind === 'mint' ? 'Mint' : 'Outgoing'),
      kind: kind === 'continue' ? 'Continue payment' : kind === 'burn' ? 'Burn Asset' : kind === 'transfer' ? 'Transfer' : undefined,
      status: operation.canDiscard ? 'Not submitted' : 'Pending — outcome unknown',
    });
  }
  return [...missing, ...result];
}

export function formatOperationRecovery(operation: WalletOperation): string {
  return [`Operation ID: ${operation.id}`, `Reserved inputs: ${operation.reservedInputSats === undefined ? 'Unavailable' : `${operation.reservedInputSats} sats`}`,
    `Inputs: ${operation.inputsKnown ? 'Known' : 'Awaiting verification'}`,
    ...(operation.canDiscard ? ['Unsent draft. Discarding this draft does not cancel a submitted transaction.'] : ['Pending outcome requires verification. Network cancellation is not currently verified.']),
    'Pending transactions reserve whole inputs, including expected change. Verified independent funds remain available.'].join('\n');
}
