import { useId, type ReactNode, type Ref } from 'react';
import { version } from '../../../package.json';

export function AccountDialogShell({ title, description, headingRef, headingActions, className = '', children, network = 'Signet', serverConnected = false, hostedSigningUnavailable = false }: {
  title: string; description: ReactNode; headingRef: Ref<HTMLHeadingElement>; headingActions?: ReactNode; className?: string; children: ReactNode; network?: string; serverConnected?: boolean; hostedSigningUnavailable?: boolean;
}) {
  const titleId = useId(), descriptionId = useId();
  return <section className={`bis-card${className}`} role="dialog" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}>
    <div className="bis-network-label">
      <span className="bis-network-anchor"><span className="bis-network-text">Network: {network}</span><span className="bis-version-label">BIS: v{version}{serverConnected && ' Server'}</span></span>
    </div>
    <header className="bis-dialog-heading">
      <h2 ref={headingRef} tabIndex={-1} id={titleId}>{title}</h2>
      {headingActions}
    </header>
    {hostedSigningUnavailable && <p className="bis-hosted-signing-status" role="status">BIS server signing is unavailable on Mutinynet. You can still create or restore a local wallet.</p>}
    {description && <p id={descriptionId} role="status">{description}</p>}
    {children}
  </section>;
}
