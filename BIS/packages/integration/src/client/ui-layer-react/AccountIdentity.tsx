import { FormValue } from './FormValue';
import { useClipboardCopy } from './useClipboardCopy';

export function AccountIdentityFormValue({profileId}: {profileId?: string}) {
  const copy = useClipboardCopy(() => profileId, profileId, !profileId);
  return <FormValue label="Account ID" value={profileId ?? '—'} copyable copy={copy} disabled={!profileId} className="bis-account-id" />;
}
