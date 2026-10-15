import type { ReactNode } from 'react';

/** Shared admin story container. Actions remain native buttons, never nested buttons. */
export function StoryButton({ label, sublabel, children, className }: {
  label: ReactNode; sublabel?: ReactNode; children: ReactNode; className?: string;
}) {
  return <div className={`story-card${className ? ` ${className}` : ''}`}>
    <div className="story-card-label">{label}</div>
    <div className="story-card-sublabel">{sublabel}</div>
    <div className="story-card-subbuttons">{children}</div>
  </div>;
}
