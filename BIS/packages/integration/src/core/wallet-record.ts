// Keep legacy journals intact. Only their identified owner may read them; all
// new writes use a wallet-specific key, so another wallet cannot replace them.
export const walletRecordKey = (key: string, profileId: string) => `${key}:${encodeURIComponent(profileId)}`;

export function readWalletRecord<T extends {profileId: string}>(key: string, profileId: string | undefined, validate: (record: T) => T): T | undefined {
  if (!profileId) return;
  const raw = localStorage.getItem(walletRecordKey(key, profileId));
  if (raw !== null) {
    const record = validate(JSON.parse(raw));
    if (record.profileId !== profileId) throw Error('Wallet record owner mismatch.');
    return record;
  }
  const legacy = localStorage.getItem(key);
  if (legacy === null) return;
  let record;
  try { record = JSON.parse(legacy); } catch { return; }
  if (record?.profileId !== profileId) return;
  return validate(record);
}
