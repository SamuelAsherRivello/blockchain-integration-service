import { CopyableValueField } from './CopyableValueField';
import { useClipboardCopy } from './useClipboardCopy';

export function AccountIdentity({profileId}: {profileId?: string}) {
  const copy = useClipboardCopy(() => profileId, profileId, !profileId);
  return <CopyableValueField label="Account ID" value={profileId ?? ''} copy={copy} className="bis-account-id" />;
}
