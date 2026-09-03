import { useEffect, useRef } from 'react';
import './overlay.css';

/** Mount inside a positioned host container. No demo or game dependencies. */
export function GameOverlay() {
  const root = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const host = root.current!;
    const updatePosition = () => {
      const bounds = host.getBoundingClientRect();
      const modal = dialog.current!;
      modal.style.left = `${bounds.left + bounds.width / 2}px`;
      modal.style.top = `${bounds.top + bounds.height / 2}px`;
      modal.style.width = `${Math.min(320, bounds.width - 32)}px`;
    };
    const observer = new ResizeObserver(updatePosition);
    observer.observe(host);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    updatePosition();
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, []);

  return (
    <div className="bis-overlay" ref={root}>
      <button className="bis-account" onClick={() => dialog.current?.showModal()}>
        <span aria-hidden="true">⚡</span> Account
      </button>
      <dialog className="bis-dialog" ref={dialog} aria-labelledby="bis-coming-soon">
        <h2 id="bis-coming-soon">Feature coming soon</h2>
        <form method="dialog">
          <button className="bis-ok" autoFocus>OK</button>
        </form>
      </dialog>
    </div>
  );
}
