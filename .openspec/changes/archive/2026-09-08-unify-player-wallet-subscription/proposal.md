## Why

B1 can complete while the displayed Arkade balance stays unchanged because wallet refresh is coupled to selected incoming-payment toasts. Separate payment and Transactions observers also duplicate SDK observation.

## What Changes

- Own one shared observation lifetime per player account in BIS, independent of open Account pages.
- Route incoming, outgoing, asset and confirmation changes to visible balances, holdings and activity without requiring a toast or manual Refresh.
- Reconnect after observation failures, stop on account replacement/logout/disposal, and reject late results.
- Feed confirmed local operations into the same refresh path; retain bounded SDK reconciliation when notifications are unavailable or incomplete.
- Preserve manual Refresh and existing transaction/toast semantics. A successful local payment and its delayed observer snapshot must produce only one visible Balance loading cycle; subsequent automatic reconciliation updates an already displayed balance silently.

## Capabilities

### New Capabilities
- `player-wallet-subscription`: account-scoped wallet observation and shared automatic view refresh.

### Modified Capabilities

None. Existing account-activity presentation requirements remain intact.

## Impact

BIS integration core context, Arkade activity observation and tests. No new dependency, wallet protocol, transaction submission behavior, host changes or server. The dedicated change absorbs the targeted B1 refresh into shared invalidation. Existing pending work in other changes remains separate.
