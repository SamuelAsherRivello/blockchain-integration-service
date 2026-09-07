import { useId, type ReactNode, type Ref } from 'react';

export function AccountCard({ title, description, headingRef, headingActions, className = '', children }: {
  title: string; description: ReactNode; headingRef: Ref<HTMLHeadingElement>; headingActions?: ReactNode; className?: string; children: ReactNode;
}) {
  const titleId = useId(), descriptionId = useId();
  return <section className={`bis-card${className}`} role="dialog" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}>
    <div className="bis-network-label">Network: Signet</div>
    <div className="bis-dialog-heading">
      <h2 ref={headingRef} tabIndex={-1} id={titleId}>{title}</h2>
      {headingActions}
    </div>
    {description && <p id={descriptionId} role="status">{description}</p>}
    {children}
  </section>;
}
