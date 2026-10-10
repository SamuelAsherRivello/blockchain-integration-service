import { AssetError, type BisAssetErrorCode } from './assets.ts';

/** Public, provider-neutral reasons. Do not add SDK/vendor error text here. */
export type BisAssetDiagnosticCode =
  | 'account-required'
  | 'invalid-input'
  | 'invalid-metadata'
  | 'insufficient-spendable-funds'
  | 'reserved-inputs'
  | 'provider-unavailable'
  | 'network-mismatch'
  | 'unsupported-input-selection'
  | 'coordination-unavailable'
  | 'storage-unavailable'
  | 'outcome-unknown'
  | 'account-changed'
  | 'disposed'
  | 'unsupported-environment'
  | 'busy';

export type BisAssetDiagnosticPhase = 'readiness' | 'listing' | 'mint' | 'delivery' | 'catalog';

export type BisAssetDiagnostic = Readonly<{
  phase: BisAssetDiagnosticPhase;
  code: BisAssetDiagnosticCode;
  message: string;
  profileId?: string;
  operationId?: string;
  itemName?: string;
  network?: string;
  recoverable: boolean;
  submitted: boolean;
}>;

const messages: Record<BisAssetDiagnosticCode, string> = {
  'account-required': 'An active wallet account is required.',
  'invalid-input': 'The asset request is invalid.',
  'invalid-metadata': 'The asset metadata is invalid or incomplete.',
  'insufficient-spendable-funds': 'The wallet has insufficient unreserved funds for this operation.',
  'reserved-inputs': 'The wallet inputs needed for this operation are reserved by unresolved work.',
  'provider-unavailable': 'The selected network provider could not verify current wallet state.',
  'network-mismatch': 'The wallet and provider network do not match.',
  'unsupported-input-selection': 'No supported eligible wallet input could be selected.',
  'coordination-unavailable': 'Another wallet operation or browser coordinator is unavailable.',
  'storage-unavailable': 'Wallet operation recovery data could not be saved or read.',
  'outcome-unknown': 'The operation may have been submitted; reconcile the original operation before retrying.',
  'account-changed': 'The active wallet changed during the operation.',
  'disposed': 'This wallet client is no longer active.',
  'unsupported-environment': 'This browser cannot safely coordinate wallet operations.',
  busy: 'Another wallet operation is in progress.',
};

const byAssetCode: Partial<Record<BisAssetErrorCode, BisAssetDiagnosticCode>> = {
  'account-required': 'account-required',
  'invalid-input': 'invalid-input',
  'insufficient-funds': 'insufficient-spendable-funds',
  'outcome-unknown': 'outcome-unknown',
  'account-changed': 'account-changed',
  disposed: 'disposed',
  'unsupported-environment': 'unsupported-environment',
  busy: 'busy',
};

export function assetDiagnosticCode(code: BisAssetErrorCode, hint?: string): BisAssetDiagnosticCode {
  if (code === 'invalid-input' && hint === 'metadata') return 'invalid-metadata';
  if (code === 'unavailable') {
    if (hint === 'reserved-inputs') return 'reserved-inputs';
    if (hint === 'provider') return 'provider-unavailable';
    if (hint === 'network') return 'network-mismatch';
    if (hint === 'input-selection') return 'unsupported-input-selection';
    if (hint === 'storage') return 'storage-unavailable';
    if (hint === 'coordination') return 'coordination-unavailable';
    return 'provider-unavailable';
  }
  return byAssetCode[code] ?? 'provider-unavailable';
}

export function assetDiagnostic(options: Readonly<{
  phase: BisAssetDiagnosticPhase;
  code: BisAssetErrorCode;
  hint?: string;
  profileId?: string;
  operationId?: string;
  itemName?: string;
  network?: string;
  submitted?: boolean;
}>): BisAssetDiagnostic {
  const code = assetDiagnosticCode(options.code, options.hint);
  const submitted = options.submitted === true || code === 'outcome-unknown';
  return Object.freeze({
    phase: options.phase,
    code,
    message: messages[code],
    ...(options.profileId ? { profileId: options.profileId } : {}),
    ...(options.operationId ? { operationId: options.operationId } : {}),
    ...(options.itemName ? { itemName: options.itemName } : {}),
    ...(options.network ? { network: options.network } : {}),
    recoverable: code === 'outcome-unknown' || code === 'provider-unavailable' || code === 'reserved-inputs' || code === 'coordination-unavailable',
    submitted,
  });
}

/** Convert an internal failure to a safe projection. Raw messages are never returned. */
export function diagnoseAssetFailure(options: Readonly<{
  phase: BisAssetDiagnosticPhase;
  error: unknown;
  profileId?: string;
  operationId?: string;
  itemName?: string;
  network?: string;
  submitted?: boolean;
}>): BisAssetDiagnostic {
  const error = options.error;
  const code: BisAssetErrorCode = error instanceof AssetError ? error.code : 'unavailable';
  const internalMessage = error instanceof Error ? error.message : '';
  const hint = error instanceof AssetError ? undefined
    : /pending operation|reservation|reserved/i.test(internalMessage) ? 'reserved-inputs'
      : /network mismatch|selected wallet network/i.test(internalMessage) ? 'network'
        : /save|storage|journal/i.test(internalMessage) ? 'storage' : 'provider';
  return assetDiagnostic({ ...options, code, hint });
}
