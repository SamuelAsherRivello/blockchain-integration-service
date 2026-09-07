import type { ReactNode } from 'react';

export function FieldHeading({ htmlFor, label, children, className = '' }: { htmlFor?: string; label: string; children?: ReactNode; className?: string }) {
  return <div className={`bis-copy-field-heading ${className}`.trim()}>
    {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <h3>{label}</h3>}
    {children}
  </div>;
}
