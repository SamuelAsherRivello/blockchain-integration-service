import type { ReactNode } from 'react';

type IconButtonProps = { label: string; title?: string; disabled?: boolean; pressed?: boolean; className?: string; onClick(): void; children: ReactNode };
export function IconButton({ label, title = label, disabled, pressed, className = '', onClick, children }: IconButtonProps) {
  return <button type="button" className={`bis-copy-icon ${className}`.trim()} aria-label={label} title={title} disabled={disabled} aria-pressed={pressed} onClick={onClick}>{children}</button>;
}
export function CopyIcon({ copied = false }: { copied?: boolean }) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {copied ? <path d="m5 12 4 4L19 6" /> : <><rect x="9" y="9" width="11" height="12" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></>}
  </svg>;
}
export function CopyButton({ label, copied = false, disabled, onClick }: { label: string; copied?: boolean; disabled?: boolean; onClick(): void }) {
  return <IconButton label={`Copy ${label}`} title={copied ? 'Copied' : `Copy ${label}`} disabled={disabled} onClick={onClick}><CopyIcon copied={copied} /></IconButton>;
}
export function PasteButton({ disabled, reading = false, onClick }: { disabled?: boolean; reading?: boolean; onClick(): void }) {
  return <IconButton label="Paste from Clipboard" title={reading ? 'Reading clipboard…' : 'Paste from Clipboard'} disabled={disabled} onClick={onClick}>
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M8 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3M12 10v8m-3-3 3 3 3-3" /></svg>
  </IconButton>;
}
export function VisibilityToggle({ shown, disabled, onClick }: { shown: boolean; disabled?: boolean; onClick(): void }) {
  return <IconButton label={shown ? 'Hide seed words' : 'Show seed words'} pressed={shown} className="bis-visibility-toggle" disabled={disabled} onClick={onClick}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {shown ? <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></> : <path d="M3 9s3 6 9 6 9-6 9-6M5 12l-2 3m5-1-1 4m5-3v4m4-5 1 4m2-6 2 3" />}
    </svg>
  </IconButton>;
}
