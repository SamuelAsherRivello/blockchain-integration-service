# Make BIS handle multiple game titles

Status: Draft only — unstarted. No implementation is authorized by this proposal.

## Why

BIS could be embedded in multiple games. Users may need to distinguish game-related assets while keeping their balance universal.

## What Changes

- Preserve a universal balance across game titles.
- Explore an Assets “Filter By Game” control.
- Include a user-facing Game ID value on Accounts Details.
- Define the game/account relationship only after a separate proposal discussion.

## Capabilities

### New Capabilities

- `multiple-game-titles`: Proposed game identity display and game-based asset filtering; requirements remain to be agreed.

### Modified Capabilities

To be determined during proposal refinement.

## Impact

Potential public host configuration, account details presentation and asset filtering. No changes to the current game smoke test, wallet behavior or storage are included now.

## Deferred Questions

Do not start this interview until the user invokes the proposal command for this change.

- Is one account shared across game titles, or does each game establish separate account access?
- How is Game ID assigned, supplied and displayed?
- How is an asset associated with a game, and who is authoritative for that association?
- What should the filter default to, and how should shared/unassigned assets appear?
- How should browser-origin isolation affect account access across games?

No design, implementation tasks, migration or code changes have been started.
