# Proposal

## Why

Wallet and asset operations already protect durable recovery, but recent audit work found places where transient in-memory bookkeeping can outlive the condition that created it or fail to leave durable evidence for a skipped attempt. This causes ready wallets and funded balances to be reported as unavailable until reload or until a specific session is abandoned, and the same pattern can weaken marketplace batch and LTO robustness.

## What Changes

- Harden asset, burn, marketplace batch, and LTO operation controllers so completed transient guards do not permanently cache unavailable, busy, or skipped results.
- Require durable attempt markers before a skipped or unavailable operation can later be retried by a stale async path, while still allowing a fresh explicit session or operation to proceed.
- Normalize active-network wallet records when comparing legacy saved accounts that lack a network field, without allowing cross-network operation reuse.
- Preserve existing recovery behavior: submitted or uncertain work remains recoverable and reserved; pre-submission unavailability does not fabricate success or block unrelated fresh work.
- Add focused regression tests for stale single-flight caches, durable skipped-session markers, active-network legacy records, and independent batch progress after unknown outcomes.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `asset-api`: tighten operation retry and delivery behavior so transient busy/unavailable guards cannot outlive a completed attempt or suppress a fresh independent operation.
- `asset-burning`: require batch burn processing to keep moving across independently eligible items after an unknown or unavailable result without caching a stale global busy state.
- `marketplace-trading`: clarify H1/H2 marketplace batch robustness for per-item outcomes, retries, and stale in-memory guards.
- `wallet-operation-availability`: extend consistent operation availability to transient controller state as well as durable reservations and active-network isolation.
- `limited-time-offers`: require LTO start/claim/refund single-flight caches to be cleared after settlement of the promise while preserving durable same-session attempt markers.
- `treasure-lto-demo`: ensure Start LTO and Claim LTO developer controls recover from stale unavailable attempts and remain bound to concrete current offers.

## Impact

- Affected code: `BIS/packages/integration/src/core/lto-service.ts`, asset and burn mutation paths in `BIS/packages/integration/src/core/` and `BIS/packages/integration/src/arkade/`, marketplace batch helpers in `BIS/packages/integration-demo/src/admin/`, and related demo session wrappers.
- Affected tests: focused unit tests for LTO service, treasure session, asset API, burn API, marketplace H1/H2 batches, and wallet-operation availability. Browser fixtures may need updates where developer controls expose the stale-cache scenarios.
- APIs: no breaking public API changes are intended. Existing statuses and error categories should remain compatible, but they must be emitted from current state rather than stale in-memory promises.
- Dependencies: none.
