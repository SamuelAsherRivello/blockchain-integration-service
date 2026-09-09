import {assertNoPendingContinue,continuationPrefix} from './continuation.ts';
import {readContractReservations} from './contract-reservations.ts';
import {onboardingKey,readOnboardingRecord} from './onboarding-record.ts';
export const browserMutationLock = 'bis-signet-browser-mutation';
export type LogoutOperations = Readonly<{ count: number; fingerprint: string }>;
type WebStorage = Pick<Storage, 'length' | 'key' | 'getItem' | 'removeItem'>;
const journalPrefixes = ['bis-signet-boarding-operation-v1', 'bis-signet-send-operation-v1', 'bis-signet-mints-v1', 'bis-signet-burn-operation-v1','bis-signet-onboarding-v1'];
const cleanupPrefixes = [...journalPrefixes, 'bis-signet-continuations-v1', 'bis-signet-wallet-operations-v2'];
const owns = (key: string) => cleanupPrefixes.some(prefix => key === prefix || key.startsWith(`${prefix}:`)) ||
  ['bis.integration-demo.admin-split-percent', 'bis.integration-demo.preview-scale'].includes(key);
function keys(storage: WebStorage) {
  return Array.from({length: storage.length}, (_, i) => storage.key(i)).filter((key): key is string => key !== null);
}
function gameBoarding(key: string, storage: WebStorage) {
  const sharedPrefix = ['bis-signet-wallet-operations-v2:', 'bis-signet-continuations-v1:', 'bis-signet-burn-operation-v1:'].find(prefix => key.startsWith(prefix));
  if (sharedPrefix) {
    const owner = key.slice(sharedPrefix.length).split(':')[0];
    return ['bis-game-wallet-boarding-owner:', 'bis-game-wallet-send-owner:', 'bis-game-wallet-mint-owner:'].some(prefix => storage.getItem(prefix + owner) === '1');
  }
  const mintPrefix='bis-signet-mints-v1:';
  if(key.startsWith(mintPrefix)&&storage.getItem('bis-game-wallet-mint-owner:'+key.slice(mintPrefix.length))==='1')return true;
  const sendPrefix = 'bis-signet-send-operation-v1:';
  if (key.startsWith(sendPrefix) && storage.getItem('bis-game-wallet-send-owner:' + key.slice(sendPrefix.length).split(':operation:')[0]) === '1') return true;
  const prefix = 'bis-signet-boarding-operation-v1:';
  if (!key.startsWith(prefix)) return false;
  const owner = key.slice(prefix.length).split(':operation:')[0];
  return storage.getItem('bis-game-wallet-boarding-owner:' + owner) === '1';
}
export function pendingLogoutOperations(storage: WebStorage | undefined = globalThis.localStorage): LogoutOperations {
  const pending = new Set<string>();
  for (const contract of readContractReservations(storage)) if (contract.pending) pending.add(`contract:${contract.playerId}:${contract.id}`);
  if (storage) for (const key of keys(storage)) {
    if (gameBoarding(key, storage)) continue;
    if(key.startsWith(continuationPrefix))assertNoPendingContinue(decodeURIComponent(key.slice(continuationPrefix.length)),storage);
    const prefix = journalPrefixes.find(prefix => key === prefix || key.startsWith(`${prefix}:`));
    if (!prefix) continue;
    if(prefix==='bis-signet-onboarding-v1'&&key.includes(':archive:'))continue;
    const raw = storage.getItem(key);
    if (raw === null) continue;
    const record = JSON.parse(raw);
    if(prefix==='bis-signet-onboarding-v1'){
      if(onboardingKey(record)!==key||!readOnboardingRecord(record,storage))throw Error('Pending operations could not be counted.');
      if(record.status==='pending')pending.add(`${prefix}:${record.profileId}:${record.id}`);
    } else if (prefix === 'bis-signet-mints-v1') {
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
    if (gameBoarding(key, storage)) continue;
    storage.removeItem(key);
    if (storage.getItem(key) !== null) throw Error('Browser cleanup could not be verified.');
  }
}
export function assertLogoutResolvable(storage: WebStorage | undefined = globalThis.localStorage) {
  if(pendingLogoutOperations(storage).count>0)throw Error('Wallet operations are unresolved. Open Account → Transactions and check recovery status before logging out.');
}

// Exclusive logout cannot overlap an SDK mutation from any wallet on this origin.
export function withBrowserMutation<T>(work: () => Promise<T>, exclusive = false): Promise<T> {
  if (!globalThis.navigator?.locks) return Promise.reject(Error('This browser cannot safely coordinate wallet operations.'));
  return navigator.locks.request(browserMutationLock, {mode: exclusive ? 'exclusive' : 'shared', ifAvailable: true}, lock => {
    if (!lock) throw Error('Another wallet operation is in progress. Try logout again after it finishes.');
    return work();
  });
}
