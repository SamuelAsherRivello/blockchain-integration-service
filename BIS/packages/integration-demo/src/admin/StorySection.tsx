import type { ReactNode } from 'react';

export function StorySection({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return <details className={`story-section ${className}`} open>
    <summary className="story-section-toggle">
      <span className="story-section-chevron" aria-hidden="true">&gt;</span>
      <h2 className="admin-section-title">{title}</h2>
    </summary>
    <div className="story-section-content">{children}</div>
  </details>;
}
