import { StoryButton } from './StoryButton';

export function StoryAction({ id, label, selected, disabled, onClick, emphasis }: {
  id: string; label: string; selected?: boolean; disabled?: boolean; onClick?(): void; emphasis?: 'start';
}) {
  return <StoryButton className={emphasis === 'start' ? 'story-card-start' : undefined} label={`${id}. ${label}`}>
    <button type="button" aria-label={`${id}. ${label}`} aria-pressed={selected} disabled={disabled} onClick={onClick}>
      ↗
    </button>
  </StoryButton>;
}
