## Why

Users can reach Burn with a freshly listed owned asset, yet BIS sometimes returns the generic “Burn unavailable” result instead of executing the burn. The current boundary collapses lock contention, transient provider/read failures, persistence failures, and unexpected SDK errors into one message, while the burn path can reject a valid attempt during a short-lived wallet-operation race. This change makes valid burns execute reliably when safe, preserves the no-duplicate-spend guarantees, and makes genuinely blocked or uncertain outcomes actionable.

## What Changes

- Reproduce the intermittent Burn failure across fresh asset reads, wallet mutation-lock contention, provider/indexer refresh failures, durable burn-record writes, network selection, and SDK submission.
- Make the burn operation use the active verified account/network context and a bounded, safe coordination strategy so short-lived unrelated wallet work does not turn a valid burn into an immediate generic failure.
- Preserve exact holding revalidation, input reservation, durable pre-submit intent, automatic-settlement-disabled behavior, uncertain-outcome protection, and other-asset preservation.
- Return specific safe error categories/messages for unavailable reads, unresolved conflicts, unsupported coordination, account changes, and possibly submitted burns; never infer success from a missing holding.
- Add focused regression coverage for the observed intermittent path, lock races, retry behavior, network routing, and all existing duplicate/unknown-outcome guards, plus relevant browser/demo coverage.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `asset-burning`: require reliable execution of a valid confirmed burn, active-network routing, actionable failure classification, and preservation of exact durable safety guarantees.
- `wallet-operation-availability`: refine shared wallet-operation coordination so transient contention and unavailable verification are distinguished without allowing conflicting submissions.

## Impact

- `BIS/packages/integration/src/arkade/assets.ts`, `src/core/context.ts`, `src/core/burning.ts`, and shared wallet-operation coordination.
- Asset and burn unit tests, Admin/Account asset browser fixtures, and marketplace burn-batch tests.
- No public Arkade-specific types are added to the game-facing API. No recovery material or secret-bearing diagnostics are exposed.
