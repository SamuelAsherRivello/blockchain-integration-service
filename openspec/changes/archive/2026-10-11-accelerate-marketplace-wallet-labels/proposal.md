# Proposal

## Why

Marketplace paints before its Player Wallet and Game Wallet address listings populate, and currently calls a pending address “Not connected.” Address presentation unnecessarily waits for SDK ownership initialization and overlaps address reads and Game refreshes. The user wants both listings populated in under one second.

## What Changes

- Prepare public addresses independently of slow balance, inventory, and contract initialization, within the existing bounded role session.
- Reuse compatible Player address preparation and remove redundant Marketplace-triggered Game refreshes.
- Render independently scoped loading, unavailable, disconnected, and ready address labels without module-global display state or a catalog gate on an already-known connected address.
- Measure both cold navigation and repeat-load label timing separately from provider balance/assets latency. Require under 1,000 ms in the controlled browser acceptance case with prompt operator configuration and deliberately slow ownership reads; report live timings honestly. Remote operator outages must remain unavailable, never fabricated successes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `marketplace-catalog`: independent truthful wallet address-label presentation and a measured sub-second loading target.
- `app-wallet-session`: early address projection sharing the same validated role configuration without another SDK wallet or weakened session guards.

## Impact

Marketplace App, a small address-label helper, and focused browser/catalog tests; integration role-session adapter, address adapter, and narrow Player recipient preparation reuse with focused lifecycle/projection tests. No new dependencies, durable address cache, transaction behavior, wallet credentials, inventory-cache redesign, or package-version changes. Existing public inventory invalidation, connected Game Wallet selection, funding, recovery, and live readiness checks remain authoritative. Coordinator owns release/export/import and the final push.
