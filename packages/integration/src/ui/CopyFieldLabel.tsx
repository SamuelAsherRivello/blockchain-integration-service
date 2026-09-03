export function CopyFieldLabel({ htmlFor, label, copied = false, disabled = false, onCopy }: {
  htmlFor?: string;
  label: string;
  copied?: boolean;
  disabled?: boolean;
  onCopy: () => void;
}) {
  return <div className="bis-copy-field-heading">
    {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <h3>{label}</h3>}
    <button type="button" className="bis-copy-icon" aria-label={`Copy ${label}`} title={copied ? 'Copied' : `Copy ${label}`} disabled={disabled} onClick={onCopy}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {copied ? <path d="m5 12 4 4L19 6" /> : <><rect x="9" y="9" width="11" height="12" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></>}
      </svg>
    </button>
  </div>;
}
