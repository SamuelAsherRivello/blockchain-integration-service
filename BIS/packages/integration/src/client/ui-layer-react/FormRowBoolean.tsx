export function FormRowBoolean({ label, value, enabledText, disabledText }: { label: string; value: boolean; enabledText: string; disabledText: string }) {
  return <label className="bis-form-row-boolean">
    <span title={value ? enabledText : disabledText}>{label}</span>
    <input type="checkbox" aria-label={`${label} supported`} checked={value} disabled readOnly />
  </label>;
}
