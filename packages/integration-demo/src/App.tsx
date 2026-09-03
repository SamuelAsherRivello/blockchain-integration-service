import { useEffect, useRef, useState } from 'react';
import { createBisContext, createBisAdminContext, createBisUi, type BisState } from '@bis/integration';
import '@bis/integration/style.css';
import { AdminPanel } from './admin/AdminPanel';
import { GamePreview } from './preview/GamePreview';
import { version } from '../package.json';

export function App() {
  const container = useRef<HTMLDivElement>(null);
  const session = useRef<ReturnType<typeof start> | null>(null);
  const [selected, setSelected] = useState(false);
  const [view, setView] = useState<BisState['view']>('empty');
  function start() {
    const context = createBisContext();
    const adminContext = createBisAdminContext(context);
    const ui = createBisUi(context);
    const unsubscribe = context.subscribe(() => setView(context.getState().view));
    ui.mount(container.current!);
    setView(context.getState().view);
    return { context, adminContext, ui, stop() { unsubscribe(); ui.unmount(); context.dispose(); } };
  }
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) session.current = start(); });
    return () => {
      cancelled = true;
      const old = session.current;
      session.current = null;
      queueMicrotask(() => old?.stop());
    };
  }, []);
  function selectStory() { setSelected(true); session.current?.ui.showAccountButton(); }
  function reset() {
    session.current?.adminContext.resetClient();
    session.current?.stop();
    session.current = start();
    setSelected(false);
  }
  return <div className="demo-app">
    <header className="app-header"><div className="identity"><span className="brand-mark" aria-hidden="true">↗</span>Blockchain Integration Service - Demo</div><div className="version-tag"><span>v{version}</span><a className="github-link" href="https://github.com/SamuelAsherRivello/blockchain-integration-service" target="_blank" rel="noopener noreferrer" aria-label="View repository on GitHub"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.23c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.33-1.76-1.33-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.23 1.84 1.23 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.49 5.93.43.37.81 1.1.81 2.22v3.3c0 .32.22.7.83.58A12 12 0 0 0 12 .5Z" /></svg></a></div></header>
    <main className="workspace">
      <AdminPanel selected={selected} accountOpen={view === 'account'} onSelect={selectStory} onReset={reset} />
      <GamePreview containerRef={container} />
    </main>
  </div>;
}
