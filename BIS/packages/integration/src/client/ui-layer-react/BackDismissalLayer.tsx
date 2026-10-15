import type { HTMLAttributes, ReactNode } from 'react';

export type BackAction = () => void;

export function BackDismissalLayer({ enabled, onBack, className = '', children, ...rest }: { enabled: boolean; onBack: BackAction; className?: string; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={className} onKeyDown={event => {
    if (enabled && event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onBack();
    }
  }} onClick={event => {
    if (enabled && event.target === event.currentTarget) onBack();
  }}>{children}</div>;
}
