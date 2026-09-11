const lockName = 'bis-signet-wallet-role-selection';
let localTail = Promise.resolve();

export class WalletRoleConflictError extends Error {}
export class WalletRoleCoordinationError extends Error {}

/**
 * Serializes origin-local Player/Game Wallet role selection using public profile
 * IDs only. Browser callers require the cross-tab LockManager; the local queue
 * keeps isolated Node test fixtures deterministic.
 */
export function withWalletRoleSelection<T>(candidateProfileId: string, otherProfileId: () => string | undefined, message: string, work: () => Promise<T>): Promise<T> {
  const run = async () => {
    if (otherProfileId() === candidateProfileId) throw new WalletRoleConflictError(message);
    return work();
  };
  const locks = globalThis.navigator?.locks;
  if (locks) return locks.request(lockName, {}, run);
  if (typeof window !== 'undefined') return Promise.reject(new WalletRoleCoordinationError('Wallet role coordination is unavailable. Try again.'));
  const next = localTail.then(run, run);
  localTail = next.then(() => undefined, () => undefined);
  return next;
}
