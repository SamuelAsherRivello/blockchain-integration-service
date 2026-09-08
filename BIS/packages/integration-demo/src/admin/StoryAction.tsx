export function StoryAction({ id, label, selected, disabled, arrow = false, onClick }: {
  id: string; label: string; selected?: boolean; disabled?: boolean; arrow?: boolean; onClick?(): void;
}) {
  return <button className="story-button" aria-pressed={selected} disabled={disabled} onClick={onClick}>
    <span>{id}</span><span className="story-label" title={label}>{label}</span>{arrow && <span className="story-arrow" aria-hidden="true">↗</span>}
  </button>;
}
