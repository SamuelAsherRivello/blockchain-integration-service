import type { ReactNode } from 'react';

export function StorySection({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return <details className={`story-section ${className}`} open>
    <summary className="story-section-toggle">
      <span className="story-section-chevron" aria-hidden="true">&gt;</span>
      <h3 className="admin-category-title">{title}</h3>
    </summary>
    <div className="story-section-content">{children}</div>
  </details>;
}
