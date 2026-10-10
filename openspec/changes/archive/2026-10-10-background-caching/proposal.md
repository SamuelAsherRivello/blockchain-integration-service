# Proposal

## Why

The current five-minute cache makes repeat navigation faster, but first visits still wait for view-owned reads. BIS should prepare likely destinations after account activation and let a page adopt any compatible work already running, showing its normal loading UI without restarting that work.

## What Changes

- Warm complete player balance and receiving-address data after a saved, created, restored, or selected account becomes active on a known network. Populate the combined Account Details snapshot and its reusable balance/address dependencies.
- Reuse the existing account payment/history observer to prepare Transactions; consume existing passive contract projections where available. Schedule missing Transactions and read-only Contracts data after the first warm-up, then conditionally warm Assets for an existing item/inventory consumer or Assets interest in the current session.
- Introduce a context-owned coordinator for completed snapshots and in-flight reads. Compatible background and foreground consumers share one request and one bounded retry lifecycle.
- On navigation, immediately attach the page to a compatible active request, promote its priority, and show its existing loading presentation. Modal views retain the construction gate; Account Details retains interactive placeholders and its refresh spinner while pending.
- Share balance and address dependencies across Details, Receive, Send, and Swap entry preparation. Request only missing dependencies; a partial result cannot masquerade as a complete Details snapshot.
- Keep cache ownership separate from page subscriptions. Leaving a page detaches its consumer and clears its visible state while valid context-owned work can finish and populate memory for later use.
- Make explicit Refresh bypass completed values and reuse an eligible current live request. A request invalidated by newer wallet evidence, account generation, network, or query requirements must be superseded instead.
- Queue speculative work conservatively, give foreground work priority, and keep background failures silent. TTL expiry alone does not start a polling or refill loop.
- Preserve live validation for quotes, spending, equipment changes, contract actions, and other mutations. Recovery phrases, invoice creation, operation submission, and reconciliation are outside speculative warming.
- Keep Marketplace catalog/inventory warming in Marketplace and retain existing onboarding and game-wallet lifecycle owners. Their existing reads may supply compatible presentation data without starting duplicate observers or extending this change into their financial workflows.

The user confirmed early background preparation and foreground adoption without restarts. The exact scheduling and Assets eligibility below are proposed defaults for this change, not measured usage findings: one speculative job at a time, Details first, Transactions next, passive Contracts next, and Assets only when an existing consumer needs inventory or the user visits Assets in the current session. No new usage-history persistence or telemetry is proposed.

## Capabilities

### New Capabilities

- `background-caching`: Ordered account warm-up, shared in-flight request adoption, dependency reuse, bounded scheduling, and silent background completion/failure.

### Modified Capabilities

- `view-loading-policy`: Entry preparation may consume fresh data or join an active compatible read; Refresh distinguishes completed cache values from current live work, and page detachment is separate from request invalidation.
- `account-activity`: Transactions can reuse an account-owned history source or warm result while its visible state and selection remain scoped to the open page.
- `account-assets`: Eligible one-shot background ownership preparation can serve Assets entry; inspection remains read-only, and visible output observation retains its existing lifetime.

## Impact

- Core coordination: `BIS/packages/integration/src/client/state-layer-core/context.ts`, `view-cache.ts`, `shared-wallet-observer.ts`, and `asset-view-lifecycle.ts`, plus a focused internal request coordinator/scheduler if useful.
- Consumers: Account entry read wiring, `AccountSend.tsx`, collection views, and passive contract projections in `integration-layer/bis-service.ts`. Adapter calls remain behind existing provider-neutral dependencies.
- Verification: deferred-promise request-count tests, cache/lifecycle tests, and browser fixtures exercising navigation during warming, loading behavior, retry budgets, invalidation, and cancellation.
- Documentation: the integration package README and relevant existing cache/loading documentation, preserving package README conventions.
- No new package dependency, custom server, persisted wallet snapshot, or breaking game-facing API is planned. This builds on archived `update-caching` and must preserve the passive-query versus explicit-reconciliation boundary in `defer-lto-reconciliation-and-toast-noise`.

