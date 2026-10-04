export function FormRowBoolean({ label, value, enabledText, disabledText }: { label: string; value: boolean; enabledText: string; disabledText: string }) {
  const tooltip = value ? enabledText : disabledText;
  return <label className="bis-form-row-boolean" title={tooltip}>
    <span>{label}</span>
    <input type="checkbox" aria-label={`${label} supported`} checked={value} disabled readOnly />
  </label>;
}
