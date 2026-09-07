import {assertNoPendingContinue,continuationPrefix} from './continuation.ts';
export const browserMutationLock = 'bis-signet-browser-mutation';
export type LogoutOperations = Readonly<{ count: number; fingerprint: string }>;
type WebStorage = Pick<Storage, 'length' | 'key' | 'getItem' | 'removeItem'>;
const journalPrefixes = ['bis-signet-boarding-operation-v1', 'bis-signet-send-operation-v1', 'bis-signet-mints-v1', 'bis-signet-burn-operation-v1'];
const owns = (key: string) => journalPrefixes.some(prefix => key === prefix || key.startsWith(`${prefix}:`)) ||
  ['bis.integration-demo.admin-split-percent', 'bis.integration-demo.preview-scale'].includes(key);
function keys(storage: WebStorage) {
  return Array.from({length: storage.length}, (_, i) => storage.key(i)).filter((key): key is string => key !== null);
}
export function pendingLogoutOperations(storage: WebStorage | undefined = globalThis.localStorage): LogoutOperations {
  const pending = new Set<string>();
  if (storage) for (const key of keys(storage)) {
    if(key.startsWith(continuationPrefix))assertNoPendingContinue(decodeURIComponent(key.slice(continuationPrefix.length)),storage);
    const prefix = journalPrefixes.find(prefix => key === prefix || key.startsWith(`${prefix}:`));
    if (!prefix) continue;
    const raw = storage.getItem(key);
    if (raw === null) continue;
    const record = JSON.parse(raw);
    if (prefix === 'bis-signet-mints-v1') {
      if (!Array.isArray(record?.operations)) throw Error('Pending operations could not be counted.');
      for (const op of record.operations) {
        if (!['pending','succeeded'].includes(op?.status) || typeof op.request?.operationId !== 'string') throw Error('Pending operations could not be counted.');
        if (op.status === 'pending') pending.add(`${key}:${op.request.operationId}`);
      }
    } else {
      if (!['pending','succeeded','not-submitted'].includes(record?.status) || typeof record.id !== 'string' || typeof record.profileId !== 'string') throw Error('Pending operations could not be counted.');
      if (record.status === 'pending') pending.add(`${prefix}:${record.profileId}:${record.id}`);
    }
  }
  return {count: pending.size, fingerprint: JSON.stringify([...pending].sort())};
}
export function clearBrowserPreferences(storage: WebStorage | undefined) {
  if (!storage) return;
  for (const key of keys(storage).filter(owns)) {
    storage.removeItem(key);
    if (storage.getItem(key) !== null) throw Error('Browser cleanup could not be verified.');
  }
}

// Exclusive logout cannot overlap an SDK mutation from any wallet on this origin.
export function withBrowserMutation<T>(work: () => Promise<T>, exclusive = false): Promise<T> {
  if (!globalThis.navigator?.locks) return Promise.reject(Error('This browser cannot safely coordinate wallet operations.'));
  return navigator.locks.request(browserMutationLock, {mode: exclusive ? 'exclusive' : 'shared', ifAvailable: true}, lock => {
    if (!lock) throw Error('Another wallet operation is in progress. Try logout again after it finishes.');
    return work();
  });
}
