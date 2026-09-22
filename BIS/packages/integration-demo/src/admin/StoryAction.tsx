import { StoryButton } from './StoryButton';

export function StoryAction({ id, label, selected, disabled, disabledReason, onClick, emphasis }: {
  id: string; label: string; selected?: boolean; disabled?: boolean; disabledReason?: string; onClick?(): void; emphasis?: 'start';
}) {
  const tooltipId = `admin-disabled-reason-${id.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  const action = <button type="button" aria-label={`${id}. ${label}`} aria-pressed={selected} aria-describedby={disabled && disabledReason ? tooltipId : undefined} disabled={disabled} onClick={onClick}>
    ↗
  </button>;
  return <StoryButton className={emphasis === 'start' ? 'story-card-start' : undefined} label={`${id}. ${label}`}>
    {disabled && disabledReason ? <span className="admin-disabled-tooltip" tabIndex={0} aria-describedby={tooltipId}>{action}<span id={tooltipId} className="admin-disabled-tooltip-panel" role="tooltip">{disabledReason}</span></span> : action}
  </StoryButton>;
}
