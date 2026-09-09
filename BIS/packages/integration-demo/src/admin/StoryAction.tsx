import { StoryButton } from './StoryButton';

export function StoryAction({ id, label, selected, disabled, arrow = false, onClick }: {
  id: string; label: string; selected?: boolean; disabled?: boolean; arrow?: boolean; onClick?(): void;
}) {
  return <StoryButton label={`${id}. ${label}`}>
    <button type="button" aria-label={`${id}. ${label}`} aria-pressed={selected} disabled={disabled} onClick={onClick}>
      Open{arrow && <span aria-hidden="true"> ↗</span>}
    </button>
  </StoryButton>;
}
