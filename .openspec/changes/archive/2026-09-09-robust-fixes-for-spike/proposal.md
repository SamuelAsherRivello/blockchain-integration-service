## Why

Recent successful runs establish a useful baseline, but settlement recovery alone does not cover startup, stalled reads, storage failures, callback errors, or browser lifecycle interruptions. The user reports the last four runs succeeded in roughly twenty-something minutes; this change will make recovery systematic across all six steps and measure which delays the client can actually remove.

## What Changes

- Add a persisted, step-aware recovery policy covering initialization, funding observation, preparation, both settlement legs, and final verification, including failures not previously encountered. Retry safe work automatically; reconcile uncertain financial outcomes before any SDK recovery; pause with a specific remedy when safety cannot be established.
- Bound observation and startup work, detect stalled progress, reconnect after temporary outages, and ensure a hung request or optional UI/timing failure cannot permanently hold the operation lock. Never start another signer until the previous signer and cleanup have terminated.
- Make account and operation persistence authoritative before progressing. Fence asynchronous results by window, account, operation revision, and settlement attempt; preserve confirmed restart behavior and the selected transfer's frozen inputs.
- Route errors to the affected step with a safe category, last successful checkpoint, next recovery action, and retry time. Install bootstrap error handling before asynchronous window/storage initialization; preserve a usable error screen when initialization fails.
- Reduce avoidable latency using SDK notifications plus polling fallback, coalesced fresh reads, and immediate reconciliation at settlement boundaries. Keep the current allocation, two-leg route when needed, and confirmed-evidence definition of Step 6.
- Record funding, confirmation, batch, request, recovery, browser suspension, and client handoff timing separately. Show an earlier verified-spendability milestone separately from full Step 6 completion so possible future BIS speedups can be evaluated honestly.
- Add deterministic failure and hang coverage at every asynchronous boundary, concurrency/reload checks, and a repeatable live Signet acceptance and timing report.

## Capabilities

### New Capabilities

- `standalone-spike-resilience`: Step-wide recovery, durable checkpoints, bounded observation, safe error presentation, efficient progression, and timing/acceptance evidence for the standalone spike.

### Modified Capabilities

None. The original `standalone-boarding-spike` capability was reconciled with later user-approved behavior and synced to canonical `.openspec/specs/` on 2026-09-09 before implementation of this change. This additive capability complements its evidence requirements and preserves automatic onboarding, confirmed always-enabled Restart, and window-isolated state.

## Impact

Implementation will be confined to `BIS/packages/balance-onboard-spike-standalone` and the minimal `integration-demo/spike1` entry if needed for bootstrap error handling. It will touch startup/window ownership, IndexedDB persistence, the workflow in `src/main.js`, diagnostic/timing views, and tests. SDK 0.4.71 is the verified installed baseline; no dependency upgrade, new server, operator change, or public BIS API change is required.

This proposal is separate from `add-automatic-bis-onboarding`, which proposes earlier spendability-based completion in production BIS. Here Step 6 continues to require the existing confirmed commitments and exact outputs. Faster Bitcoin mining, a shorter operator batch schedule, a different funding allocation, and a guarantee of completion during a permanent outage are outside scope. All implementation choices below are proposed until this change is applied.
