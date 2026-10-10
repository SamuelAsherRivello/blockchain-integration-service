import { useEffect, useRef } from 'react';

export function FormRowBoolean({ label, value, enabledText, disabledText }: { label: string; value: boolean | undefined; enabledText: string; disabledText: string }) {
  const checkbox = useRef<HTMLInputElement>(null);
  const loading = value === undefined;
  const tooltip = loading ? 'Loading support status…' : value ? enabledText : disabledText;
  useEffect(() => {
    if (checkbox.current) checkbox.current.indeterminate = loading;
  }, [loading]);
  return <label className="bis-form-row-boolean" title={tooltip}>
    <span>{label}</span>
    <input ref={checkbox} type="checkbox" aria-label={`${label} supported`} aria-checked={loading ? 'mixed' : value} checked={value === true} disabled readOnly />
  </label>;
}
