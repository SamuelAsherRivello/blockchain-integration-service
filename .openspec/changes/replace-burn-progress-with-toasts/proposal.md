## Why

Burning works, but its blocking progress dialog interrupts the runtime. The user wants pending and confirmed toasts to communicate the existing burn outcome.

## What Changes

- Replace the burn progress overlay, including burn-triggered holdings refresh, with shared info and success toasts: `Asset burn (Pending)` and `Asset burn (Confirmed)`.
- Preserve the explicit Confirmation / Are you sure? / OK / Cancel step, exact entire-holding burn, mutation locks, and duplicate-submission protection.
- Emit confirmed feedback only for the existing verified `burned` result; preserve acknowledgment-required failure and unknown-outcome dialogs.
- Refresh holdings after success without opening a replacement loading overlay for that refresh. Keep unrelated page-loading behavior intact.
- Proposed wording above is a minor implementation default; no material decisions remain unresolved.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `asset-burning`: Replace blocking progress with ordered pending and confirmed notifications.
- `pending-operation-dialog`: Exempt burn progress and its follow-up refresh from the covering dialog.
- `account-assets`: Observe wallet output events while open and refresh without polling.
- `toast-messaging`: Define burn notification timing and the explicit exception to preserving existing pending presentation.

## Impact

Targets AccountAssets, its client/context wiring, existing toast delivery, and focused burn and pending-operation tests in BIS/packages/integration and integration-demo. Update the affected README and later-decisions documentation during implementation. No new dependency, SDK operation, public Arkade-specific type, or wallet recovery change is needed. Existing burn success is reported working by the user; this proposal does not claim a new live Signet verification. Planning only; implementation follows a separate apply request.

## User-approved scope addition

During apply, the user requested automatic asset observation without polling. Use the installed SDK script subscription for the current account receive and subdust scripts; coalesce background reads and stop observation on exit. Manual Refresh remains the fallback when streaming is unavailable.
