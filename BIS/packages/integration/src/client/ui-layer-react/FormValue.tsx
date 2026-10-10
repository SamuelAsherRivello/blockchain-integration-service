import { useId, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { FormHeading } from './FormHeading';
import { CopyButton } from './IconButton';
import { useClipboardCopy, type ClipboardCopy } from './useClipboardCopy';

export function FormValue({ label, value, disabled = false, copyable = false, multiline = false, className = 'bis-address-row', copy: suppliedCopy, feedback = true, selectOnFocus = true, tooltip, tooltipName, scrollable = false, rows, wrap, id: suppliedId, ...props }: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'readOnly' | 'disabled'> & {
  label: string;
  value: string;
  disabled?: boolean;
  copyable?: boolean;
  multiline?: boolean;
  className?: string;
  copy?: ClipboardCopy;
  feedback?: boolean;
  selectOnFocus?: boolean;
  tooltip?: ReactNode;
  tooltipName?: string;
  scrollable?: boolean;
  rows?: number;
  wrap?: 'hard' | 'soft' | 'off';
}) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  const ownCopy = useClipboardCopy(() => value, value, disabled || !copyable);
  const copy = suppliedCopy ?? ownCopy;
  const labelContent = tooltip ? <span className="bis-balance-tooltip" data-bis-balance-tooltip={tooltipName} tabIndex={0}>
    <label htmlFor={id}>{label}</label>
    <span className="bis-balance-tooltip-panel" role="tooltip">{tooltip}</span>
  </span> : undefined;
  const heading = <FormHeading htmlFor={id} label={label} labelContent={labelContent}>
    {copyable && <CopyButton label={label} copied={copy.status === 'copied'} disabled={disabled || copy.status === 'copying'} onClick={() => void copy.copy()} />}
  </FormHeading>;
  const failure = feedback && copyable && copy.status === 'failed' && <span className="bis-copy-status" role="status">Could not copy. Select the value and copy it manually.</span>;
  if (multiline) {
    const textarea = <textarea {...props} id={id} rows={rows} wrap={wrap} readOnly value={value} disabled={disabled} />;
    return <div className={className}>{heading}<div className="bis-report bis-report-scrollable">{textarea}</div>{failure}</div>;
  }
  return <div className={className}>{heading}<input id={id} aria-label={label} readOnly value={value} disabled={disabled} onFocus={selectOnFocus ? event => event.target.select() : undefined} />{failure}</div>;
}
