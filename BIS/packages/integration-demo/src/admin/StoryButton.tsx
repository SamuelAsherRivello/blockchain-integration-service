import type { ReactNode } from 'react';

/** Shared admin story container. Actions remain native buttons, never nested buttons. */
export function StoryButton({ label, sublabel, children }: {
  label: ReactNode; sublabel?: ReactNode; children: ReactNode;
}) {
  return <div className="story-card">
    <div className="story-card-label">{label}</div>
    <div className="story-card-sublabel">{sublabel}</div>
    <div className="story-card-subbuttons">{children}</div>
  </div>;
}
