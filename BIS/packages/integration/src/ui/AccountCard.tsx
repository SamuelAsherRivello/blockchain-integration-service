import { useId, type ReactNode, type Ref } from 'react';
import { version } from '../../package.json';

export function AccountCard({ title, description, headingRef, headingActions, className = '', children }: {
  title: string; description: ReactNode; headingRef: Ref<HTMLHeadingElement>; headingActions?: ReactNode; className?: string; children: ReactNode;
}) {
  const titleId = useId(), descriptionId = useId();
  return <section className={`bis-card${className}`} role="dialog" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}>
    <div className="bis-network-label">
      <span className="bis-network-anchor"><span className="bis-network-text">Network: Signet</span><span className="bis-version-label">BIS: v{version}</span></span>
    </div>
    <div className="bis-dialog-heading">
      <h2 ref={headingRef} tabIndex={-1} id={titleId}>{title}</h2>
      {headingActions}
    </div>
    {description && <p id={descriptionId} role="status">{description}</p>}
    {children}
  </section>;
}
