## Why

An unresolved transfer currently displays individual IDs and an investigation warning but no ready-to-copy recovery handoff. A read-only report can help the player seek operator assistance now, independently of unsupported cancellation guarantees.

## What Changes

- Split D5 into D5a. Inspect and Copy Transfer Recovery Details and D5b. Cancel Pending Transfer. Preserve the existing cancellation proposal for D5b.
- Add an expandable, selectable recovery report to pending transaction details in Account Activity with an explicit Copy action and clipboard-failure fallback.
- Include only allowlisted public status fields, direction, amount, IDs, verification availability and concrete operator questions. Unknown values remain explicitly unknown.
- Preserve Check Status, account guards and all signing boundaries. Copying does not contact anyone or resolve the operation.

## Capabilities

### New Capabilities

- `transfer-recovery-report`: Read-only, privacy-limited recovery report and manual copy handoff.

### Modified Capabilities

None. This adds a report to the existing transaction details UI without changing transaction or recovery semantics.

## Impact

Integration core formatting, Account Transfer notice and Account Activity UI, unit/browser tests and user-story documentation. No dependencies, storage migration, SDK mutation, new backend or game changes. The existing Account Activity entry exposes the report; no separate Admin shortcut is necessary. D5a completion does not mean the stuck transfer is cancelled or unlocked.
