import { useEffect, useId, useRef, useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createBisContext, getControls, type BisContext } from '../core/context';
import './overlay.css';
export function BisView({ context }: { context: BisContext }) {
  const state = useSyncExternalStore(context.subscribe, context.getState, context.getState);
  const titleId = useId();
  const descriptionId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (state.view === 'account') close.current?.focus();
    if (state.view === 'account-button') button.current?.focus();
  }, [state.view]);
  if (state.view === 'empty') return null;
  return <div className={`bis-layer ${state.view === 'account' ? 'bis-layer-open' : ''}`}>
    {state.view === 'account-button' ? <button ref={button} className="bis-button bis-primary" onClick={() => context.openAccountDialog()}><span aria-hidden="true">⚡</span> Account</button> :
      <section className="bis-card" role="dialog" aria-labelledby={titleId} aria-describedby={descriptionId}>
        <h2 id={titleId}>Account</h2>
        <p id={descriptionId}>You are not logged in.</p>
        <div className="bis-actions">
          <button className="bis-button bis-primary" disabled>⚡ Create Account</button>
          <button className="bis-button" disabled>⚡ Restore Account</button>
          <button ref={close} className="bis-button" onClick={() => context.closeAccount()}>Back</button>
        </div>
      </section>}
  </div>;
}
export function createBisUi(context: BisContext) {
  let root: Root | undefined;
  let host: HTMLElement | undefined;
  const internal = getControls(context);
  return {
    mount(container: HTMLElement) {
      internal.assertAlive();
      if (root) {
        if (host === container) return;
        throw new Error('Unmount BIS UI before changing its container.');
      }
      host = container;
      root = createRoot(container);
      root.render(<BisView context={context} />);
    },
    showAccountButton() { internal.present(); },
    unmount() { root?.unmount(); root = undefined; host = undefined; },
  };
}
export function GameOverlay() {
  const context = useRef<BisContext | null>(null);
  const generation = useRef(0);
  if (!context.current) context.current = createBisContext();
  useEffect(() => {
    const client = context.current!;
    const current = ++generation.current;
    getControls(client).present();
    // StrictMode replays effects; dispose only after a genuine unmount.
    return () => { queueMicrotask(() => { if (generation.current === current) client.dispose(); }); };
  }, []);
  return <BisView context={context.current} />;
}

