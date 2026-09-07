import { FieldHeading } from './FieldHeading';
import { CopyButton } from './IconButton';

export function CopyFieldLabel({ htmlFor, label, copied = false, disabled = false, onCopy }: {
  htmlFor?: string;
  label: string;
  copied?: boolean;
  disabled?: boolean;
  onCopy: () => void;
}) {
  return <FieldHeading htmlFor={htmlFor} label={label}>
    <CopyButton label={label} copied={copied} disabled={disabled} onClick={onCopy} />
  </FieldHeading>;
}
