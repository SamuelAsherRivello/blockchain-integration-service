import { FieldHeading } from './FieldHeading';
import { CopyButton } from './IconButton';
import type { ReactNode } from 'react';

export function CopyFieldLabel({ htmlFor, label, copied = false, disabled = false, onCopy, tooltip, tooltipName }: {
  htmlFor?: string;
  label: string;
  copied?: boolean;
  disabled?: boolean;
  onCopy: () => void;
  tooltip?: ReactNode;
  tooltipName?: string;
}) {
  const labelContent = tooltip && htmlFor ? <span className="bis-balance-tooltip" data-bis-balance-tooltip={tooltipName} tabIndex={0}>
      <label htmlFor={htmlFor}>{label}</label>
      <span className="bis-balance-tooltip-panel" role="tooltip">{tooltip}</span>
    </span> : undefined;
  return <FieldHeading htmlFor={htmlFor} label={label} labelContent={labelContent}>
    <CopyButton label={label} copied={copied} disabled={disabled} onClick={onCopy} />
  </FieldHeading>;
}
