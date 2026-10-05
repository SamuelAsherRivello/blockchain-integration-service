## Why

Transaction Detail currently mixes inspection with recovery actions and a bottom explorer-unavailable message. The requested compact layout keeps three actions and moves recovery inspection into a visually consistent separate window.

## What Changes

- Show only View Recovery Info, Open On Explorer, and Back in the Transaction Detail action area, in that order. Preserve the Transaction report and its inline copy icon.
- Remove Check Status, Copy Recovery Details, and conditional discard actions from this view.
- Open a dialog inside the BIS overlay styled like Transaction Detail, with title Recovery Info, a Recovery Info report label and adjacent copy icon, a selectable read-only report, and only Back as its footer action.
- Back in the dialog dismisses it and returns to the unchanged originating detail view.
- Remove the bottom explorer-unavailable text; keep unavailable Explorer disabled with an accessible reason on the control.
- Keep all three detail actions visible; disable View Recovery Info when the selected record has no recovery information.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `account-activity`: Exact detail actions and matching recovery-dialog presentation/navigation.
- `wallet-operation-availability`: Make the Transaction Detail recovery surface inspection-only while preserving underlying recovery safeguards.

## Impact

Targets AccountActivity.tsx and recovery-window.ts in BIS/packages/integration/src/ui, shared report/copy styling, and the activity/recovery browser checks in integration-demo. No new dependencies, SDK behavior, public API, or wallet mutations are required. Existing working-tree edits must be preserved.

Assumptions: the bottom textfield means the explorer-unavailable message visible below Back in the screenshot; the main report stays. The user clarified that Recovery Info opens inside BIS; no new browser window is created. No unresolved scope decisions remain; these minor presentation assumptions are recorded for review.

