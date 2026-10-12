// Error messages from browsers, providers and private input must never reach the CLI.
export class WalletToolError extends Error {
  constructor(code) { super(code); this.code = code; }
}
export function fail(code) { throw new WalletToolError(code); }
export function publicFailure(error) {
  return { ok: false, reason: error instanceof WalletToolError ? error.code : 'operation-unavailable' };
}
