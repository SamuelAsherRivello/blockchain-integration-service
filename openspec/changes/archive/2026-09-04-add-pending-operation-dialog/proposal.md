## Why

Runtime pages expose unfinished data and async messages. A shared Pending Operation Dialog must cover preparation and mutations through the final refreshed render, so users only interact with ready pages.

## What Changes

- Add a runtime-host-scoped, noninteractive operation dialog with an `ing...` label and spinning bolt.
- Cover account lifecycle, Details, Transactions, Receive, Recovery Phrase, Assets, Send, Transfer, and visible Reset work; keep background reconciliation unobtrusive.
- Remove page-level loading/progress/completion messages. Keep Burn covered through holdings refresh.
- Retry data reads once with existing deadlines or 30 seconds where missing. Final errors have only OK, closing the dialog and its source page.
- Preserve mutation safeguards; unconfirmed results show truthful feedback and OK without resubmission.

## Capabilities

### New Capabilities
- `pending-operation-dialog`: Shared presentation, readiness, retry and dismissal contract for all runtime flows.

### Modified Capabilities
- `account-activity`: Replace inline loading and old initial-load timeout presentation.
- `account-assets`: Cover asset loading and refresh; reveal prepared holdings only.
- `asset-burning`: Cover confirmed burn through refresh without an inline completion message.

- `account-balance`: Use the shared operation dialog and final error dismissal.
- `account-address-receiving`: Use the shared operation dialog and final error dismissal.
- `account-creation`: Use the shared operation dialog and final error dismissal.
- `account-restoration`: Use the shared operation dialog and final error dismissal.
- `account-logout`: Use the shared operation dialog and final error dismissal.

## Impact

Integration core read orchestration, React runtime UI, isolated fixtures, and runtime documentation. No dependencies, new public game API, SDK operations, persistence migration, or Admin asset-console behavior changes. The user approved implementation of the plan including its unconfirmed-outcome default.
