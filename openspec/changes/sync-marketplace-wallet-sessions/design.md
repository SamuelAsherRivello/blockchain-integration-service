# Design

## Context

See [proposal.md](proposal.md#why). Marketplace presently creates its own Player context and Game Wallet controller, then reacts to their same-origin storage subscriptions. `BroadcastChannel` and IndexedDB state do not cross an independently hosted business application's origin, so those local subscriptions cannot establish cross-application lifecycle state.

## Goals / Non-Goals

**Goals:**

- Add a small public browser bridge owned by `@bis/integration`, with runtime validation and no wallet secrets.
- Let a configured business window publish role-specific activation/deactivation, and let Marketplace subscribe with a trusted origin and expected source window.
- Treat every accepted event as a session generation boundary for Marketplace presentation, inventory, and checkout work.
- Preserve current same-origin controllers and their existing safeguards.

**Non-Goals:**

- Share recovery phrases, signing objects, private storage, balances, or transaction payloads across applications.
- Let an external notification grant Marketplace authority to sign, trade, list, or restore a wallet.
- Add a server, cross-origin persistence, or generic discovery of arbitrary browser tabs.
- Change the separately maintained game's implementation in this repository; it will consume the exported bridge in its own change.

## Decisions

### Use an explicit `postMessage` bridge with a trusted peer registration

Expose a versioned `WalletSessionNotification` data shape and publisher/listener helpers from the integration public boundary. Marketplace initializes the listener with the known business origin and a concrete `WindowProxy` supplied during its launch/embedding flow; the listener checks `event.origin`, `event.source`, schema version, role, public identity fields, and role-local increasing revision before publishing to Marketplace UI state.

`postMessage` is selected because it crosses origins only when applications have an explicit browser-window relationship. Existing IndexedDB and `BroadcastChannel` subscriptions remain responsible for same-origin synchronization and are not extended as a cross-origin transport. A generic broadcast or origin wildcard is rejected because either would allow unrelated pages to impersonate a wallet lifecycle change.

### Keep observed external state separate from local wallet authority

Marketplace stores accepted notifications as public “observed” wallet projections, separate from `createBisContext` and `createBisGameWallet` state. Wallet labels may render the observed role; actual inventory reads, listing, payment, and checkout continue to require current locally verified controllers. This preserves the user's requested Marketplace policy ownership and prevents a lifecycle message from becoming credential delegation.

### Fence all role-dependent asynchronous work by a combined session key

Build a Marketplace session key from local wallet state plus the observed Player/Game revisions. On accepted deactivation, increment the relevant revision, clear label/inventory/item/checkout state for that role (and dependent work for Player logout), and invalidate outstanding callbacks. Existing inventory coordinator and checkout `isCurrent` guards will receive the expanded key so a late read or checkout continuation cannot reintroduce stale data.

### Publish before a business window intentionally closes

The business integration calls the bridge immediately after its authoritative wallet lifecycle transition; an intentional close/dispose performs its known logout publication before the window is released. Marketplace remains correct if no message is delivered: its local state is not upgraded and no signing authority is inferred. Reliable recovery across an unconnected closed window is explicitly outside this browser-only contract.

## Risks / Trade-offs

- [A popup or embedded peer is unavailable or closes before sending] → Marketplace preserves its last locally verified state, exposes no new authority, and the business integration publishes transitions before planned close.
- [A hostile page sends a forged lifecycle event] → require exact origin, expected `WindowProxy`, schema validation, and strictly newer role revision; ignore all other messages.
- [A valid login notification arrives without usable local wallet material] → render it only as observed state and retain disabled transaction controls.
- [Late inventory/checkouts render after logout] → include observed revisions in all role-scoped currentness checks and clear affected React snapshots synchronously.
- [Business and Marketplace use different deployment hosts] → deployment configuration must explicitly supply the business origin and peer window; no wildcard fallback exists.

## Migration Plan

1. Add the public notification types, validation, publisher, and Marketplace listener with unit tests for accepted and rejected messages.
2. Wire the Marketplace adapter to observed projections, session fencing, labels, inventory invalidation, and checkout cancellation; retain existing same-origin paths.
3. Update the business application's wallet lifecycle owner to register the Marketplace peer and publish both role transitions, including intentional close.
4. Add browser-level integration coverage for Player login/logout and Game login/logout from the configured peer; run existing Marketplace and integration suites.
5. Roll back by disabling the listener configuration; Marketplace reverts to its existing local-controller behavior without touching wallet persistence.
