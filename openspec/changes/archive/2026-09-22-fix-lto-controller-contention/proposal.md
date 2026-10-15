# Proposal

## Why

The LTO service still has a known contention regression: cooperating browser/controller instances can all fail a same-key Start attempt where exactly one should obtain the durable funding slot. This leaves the H1/G2 treasure flow less robust than its specification and makes the remaining focused contract test fail.

## What Changes

- Make concurrent same-player/same-game/same-exclusivity LTO starts deterministic: one eligible controller wins the slot and conflicting controllers observe an unavailable/no-offer outcome without creating overlapping offers.
- Preserve the existing rule that an earlier skipped session never starts late after readiness changes.
- Keep prior-offer cleanup semantics intact: unresolved refund or unknown funding continues to occupy the exclusivity key until verified cleanup.
- Add focused service and developer-demo regression coverage for cooperating controllers, stale readiness failures, and retry-after-cleanup behavior.
- No breaking API changes.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `limited-time-offers`: Clarify controller contention behavior for same-key starts, including readiness failures, in-memory attempt caching, durable attempt markers, and single-slot acquisition.
- `treasure-lto-demo`: Clarify that G2 Start LTO must surface the one winning session or a truthful skipped/no-offer state when multiple developer/demo controllers interact with the same underlying service.

## Impact

- Affects LTO service coordination in `BIS/packages/integration/src/core/lto-service.ts`.
- Affects developer/demo session orchestration in `BIS/packages/integration-demo/src/preview/treasure-session.js` and G2-focused tests.
- Focused verification should include `tests/lto-service.test.mjs`, `tests/treasure-session.test.mjs`, and the browser LTO fixture when practical.
