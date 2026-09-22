import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import './admin-dialog-fullscreen.css';

export function AdminDialogFullscreen({
  title,
  children,
  className,
  closeDisabled = false,
  onClose,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  closeDisabled?: boolean;
  onClose(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(
    typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const titleId = `admin-dialog-${useId().replaceAll(':', '')}-title`;

  useLayoutEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => {
      const focusTarget = previousFocus.current;
      element.close();
      queueMicrotask(() => {
        if (focusTarget?.isConnected) focusTarget.focus();
      });
    };
  }, []);

  return <dialog
    ref={dialog}
    className={['admin-dialog-fullscreen', className].filter(Boolean).join(' ')}
    aria-labelledby={titleId}
    onCancel={event => {
      event.preventDefault();
      if (!closeDisabled) onClose();
    }}
  >
    <header className="admin-dialog-fullscreen-header">
      <h2 id={titleId}>{title}</h2>
      <button
        type="button"
        className="admin-dialog-fullscreen-close"
        aria-label={`Close ${title}`}
        disabled={closeDisabled}
        onClick={onClose}
      >X</button>
    </header>
    <div className="admin-dialog-fullscreen-body">{children}</div>
  </dialog>;
}
