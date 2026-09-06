import { useId, type TextareaHTMLAttributes } from 'react';
import { CopyFieldLabel } from './CopyFieldLabel';
import type { ClipboardCopy } from './useClipboardCopy';

export function CopyableTextArea({ label, value, copy, disabled = false, ...textarea }: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'readOnly' | 'disabled'> & {
  label: string; value: string; copy: ClipboardCopy; disabled?: boolean;
}) {
  const id = useId();
  return <>
    <CopyFieldLabel htmlFor={textarea.id ?? id} label={label} copied={copy.status === 'copied'} disabled={disabled || copy.status === 'copying'} onCopy={() => void copy.copy()} />
    <textarea {...textarea} id={textarea.id ?? id} readOnly value={value} />
  </>;
}
