import { useId, type ReactNode, type Ref } from 'react';
import { version } from '../../../package.json';
import type {GameWalletWorkflowMode} from '../state-layer-core/game-wallet-workflow';

export function AccountDialogShell({ title, description, headingRef, headingActions, className = '', children, network = 'Signet', serverConnected = false, hostedSigningUnavailable = false,workflowMode,serverHealth }: {
  title: string; description: ReactNode; headingRef: Ref<HTMLHeadingElement>; headingActions?: ReactNode; className?: string; children: ReactNode; network?: string; serverConnected?: boolean; hostedSigningUnavailable?: boolean;workflowMode?:GameWalletWorkflowMode;serverHealth?:'connecting'|'connected'|'unavailable'|'absent';
}) {
  const titleId = useId(), descriptionId = useId();
  return <section className={`bis-card${className}`} role="dialog" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}>
    <div className="bis-network-label">
      {workflowMode&&<span className="bis-workflow-label">{workflowMode==='server'?'Server':'Local'}</span>}
      <span className="bis-network-text">Network: {network}</span>
      <span className="bis-version-label">v{version}</span>
    </div>
    {workflowMode==='server'&&<p className="bis-server-health" role="status">Server connection: {serverHealth==='connected'||serverConnected?'Connected':serverHealth==='connecting'?'Connecting':serverHealth==='unavailable'?'Unavailable':'Not connected'}</p>}
    <header className="bis-dialog-heading">
      <h2 ref={headingRef} tabIndex={-1} id={titleId}>{title}</h2>
      {headingActions}
    </header>
    {hostedSigningUnavailable && <p className="bis-hosted-signing-status" role="status">BIS server signing is unavailable on Mutinynet. You can still create or restore a local wallet.</p>}
    {description && <p id={descriptionId} role="status">{description}</p>}
    {children}
  </section>;
}
