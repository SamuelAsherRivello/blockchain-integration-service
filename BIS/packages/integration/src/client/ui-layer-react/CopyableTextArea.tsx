import { useId, type TextareaHTMLAttributes } from 'react';
import { ReportTextArea } from './ReportTextArea';
import { CopyFieldLabel } from './CopyFieldLabel';
import type { ClipboardCopy } from './useClipboardCopy';

export function CopyableTextArea({ label, value, copy, disabled = false, scrollable = false, ...textarea }: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'readOnly' | 'disabled'> & {
  label: string; value: string; copy: ClipboardCopy; disabled?: boolean; scrollable?: boolean;
}) {
  const id = useId();
  return <>
    <CopyFieldLabel htmlFor={textarea.id ?? id} label={label} copied={copy.status === 'copied'} disabled={disabled || copy.status === 'copying'} onCopy={() => void copy.copy()} />
    {scrollable ? <div className="bis-report bis-report-scrollable">
      <textarea {...textarea} id={textarea.id ?? id} readOnly value={value} />
    </div> : <ReportTextArea {...textarea} id={textarea.id ?? id} value={value} />}
  </>;
}
