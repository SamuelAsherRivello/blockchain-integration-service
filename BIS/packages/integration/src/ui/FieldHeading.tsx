import type { ReactNode } from 'react';

export function FieldHeading({ htmlFor, label, children, className = '', labelContent }: { htmlFor?: string; label: string; children?: ReactNode; className?: string; labelContent?: ReactNode }) {
  return <div className={`bis-copy-field-heading ${className}`.trim()}>
    {labelContent ?? (htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <h3>{label}</h3>)}
    {children}
  </div>;
}
