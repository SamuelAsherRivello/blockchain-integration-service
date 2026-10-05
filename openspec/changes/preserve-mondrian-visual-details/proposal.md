# Proposal

## Why

The theme refactor establishes the Slidev structure, but several already-agreed Mondrian visual details are not explicit acceptance criteria there. Keeping them in a separate, unstarted change makes the remaining review work visible without expanding or blocking the architecture migration.

## What Changes

- Record the remaining Mondrian visual-preservation requirements as a separate implementation backlog.
- Require the subsection title treatment: a two-line field, bottom-aligned.
- Keep the former template slide nine removed.
- Keep all clickable images free of underlines and dotted bottom rules while preserving visible keyboard focus.
- Require the Sierra logo to have exactly a two-pixel white border.
- Require the Game XP logo slide to retain the approved title/caption placement, upper-left and upper-right text justification, and staged animation timing.
- Define rendered checks for these requirements, without starting their implementation in this change.

## Capabilities

### New Capabilities

- `mondrian-visual-preservation`: Preserves the agreed template-catalog visual details through explicit rendered acceptance criteria.

### Modified Capabilities

- None.

## Impact

- Planned affected sources: `BIS/documentation/slidev/template-deck-b.md`, `BIS/documentation/slidev/themes/mondrian-final/`, and presentation verification scripts.
- No blockchain runtime, wallet behavior, or third-party dependency change is planned.
- This change is planning only and is intentionally not being applied now.
