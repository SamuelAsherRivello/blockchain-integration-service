import { StoryButton } from './StoryButton';

export function StoryAction({ id, label, selected, disabled, onClick }: {
  id: string; label: string; selected?: boolean; disabled?: boolean; onClick?(): void;
}) {
  return <StoryButton label={`${id}. ${label}`}>
    <button type="button" aria-label={`${id}. ${label}`} aria-pressed={selected} disabled={disabled} onClick={onClick}>
      ↗
    </button>
  </StoryButton>;
}
