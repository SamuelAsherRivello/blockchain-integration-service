## Why

Account Transfer can report a pending operation while the user sees only confirmed transactions in Activity. Browser storage currently mixes remembered account access, recovery journals, completed mint records, and demo preferences; reducing persisted state and reconciling one shared operation view will make refresh behavior predictable without forgetting potentially submitted transactions.

## What Changes

- Preserve existing encrypted account access across refresh and browser restart.
- Keep balances, history, assets, connections, navigation, forms, quotes, errors, demo selection, split layout, and preview scale in session memory; refresh starts from defaults and fresh SDK reads.
- Define an explicit persistence allowlist: account access plus minimal wallet-scoped unresolved-operation recovery and any compact receipts strictly needed to preserve existing retry/idempotency guarantees. Completed history and UI snapshots are not persistent application state.
- Reconcile saved recovery evidence into one account-scoped operation state consumed by guards, Transfer, Send, and Activity. Every blocking operation must be visible, including when SDK history fails or contains only confirmed deposits.
- Migrate legacy records conservatively; refresh must never erase uncertain submission evidence, auto-submit, or falsely report completion.
- Document and demonstrate refresh/restart behavior and unavailable verification.

The narrow recovery and idempotency exceptions are the proposed design from the preceding discussion, not a claim that the browser can be entirely stateless beyond login. Remote recovery storage is deferred: this project has no custom server, and complete operator-side rediscovery has not been established.

## Capabilities

### New Capabilities
- `browser-state-lifecycle`: Persistence boundaries, fresh session initialization, and safe legacy migration.

### Modified Capabilities
- `account-activity`: Shared operation visibility and status consistency with action guards.

## Impact

Core account lifecycle, boarding/send/mint journals, operation reconciliation and Activity composition; production transfer/send/recovery UI; demo split-layout and preview preferences; tests and user-story documentation. Preserve public account APIs, wallet isolation, existing locks and retry guarantees. No new server, dependencies, wallet operations, cancellation semantics, or changes to the independent-operation eligibility policy are introduced by this proposal. Coordinate with `unblock-independent-wallet-operations` and `cancel-pending-transfer` without implementing or replacing their policies.
