import { useId, type ReactNode } from 'react';
import { CopyFieldLabel } from './CopyFieldLabel';
import { useClipboardCopy, type ClipboardCopy } from './useClipboardCopy';

export function CopyableValueField({ label, value, disabled = false, className = 'bis-address-row', copy: suppliedCopy, feedback = true, selectOnFocus = true, tooltip, tooltipName }: {
  label: string; value: string; disabled?: boolean; className?: string; copy?: ClipboardCopy; feedback?: boolean; selectOnFocus?: boolean; tooltip?: ReactNode; tooltipName?: string;
}) {
  const id = useId();
  const ownCopy = useClipboardCopy(() => value, value);
  const copy = suppliedCopy ?? ownCopy;
  return <div className={className}>
    <CopyFieldLabel htmlFor={id} label={label} copied={copy.status === 'copied'} onCopy={() => void copy.copy()} tooltip={tooltip} tooltipName={tooltipName} />
    <input id={id} aria-label={label} readOnly value={value} onFocus={selectOnFocus ? event => event.target.select() : undefined} />
    {feedback && copy.status === 'failed' && <span className="bis-copy-status" role="status">Could not copy. Select the value and copy it manually.</span>}
  </div>;
}
