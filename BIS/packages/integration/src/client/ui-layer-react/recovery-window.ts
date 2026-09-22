import { createElement, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AccountCard } from './AccountCard';
import { CopyableTextArea } from './CopyableTextArea';
import { useClipboardCopy } from './useClipboardCopy';

export function RecoveryInfoDialog({ report, trigger, onBack }: { report: string; trigger: HTMLButtonElement; onBack: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const copy = useClipboardCopy(() => report, report);
  const source = trigger.closest<HTMLElement>('.bis-card');
  const host = trigger.closest('.bis-layer') ?? source?.parentElement;
  useLayoutEffect(() => {
    const wasInert = source?.inert;
    if (source) source.inert = true;
    heading.current?.focus();
    return () => {
      if (source) source.inert = wasInert ?? false;
      if (trigger.isConnected) trigger.focus();
    };
  }, [source, trigger]);
  if (!host) return null;
  return createPortal(createElement('div', {
    ref: overlay, className: 'bis-layer bis-layer-open bis-recovery-dialog',
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onBack(); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(overlay.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea, [tabindex="0"]') ?? []);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === heading.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    },
  }, createElement(AccountCard, { title: 'Recovery Info', description: null, headingRef: heading, className: ' bis-card-activity', children:
    createElement('div', { className: 'bis-activity' },
      createElement(CopyableTextArea, { label: 'Recovery Info', value: report, copy, scrollable: true }),
      copy.status === 'failed' && createElement('p', { role: 'status' }, 'Could not copy. Select the text and copy it manually.'),
      createElement('span', { className: 'bis-sr-only', role: 'status' }, copy.status === 'copied' ? 'Recovery info copied.' : ''),
      createElement('div', { className: 'bis-actions bis-transaction-back' },
        createElement('button', { type: 'button', className: 'bis-button bis-back', onClick: onBack }, 'Back'))),
  })), host);
}
