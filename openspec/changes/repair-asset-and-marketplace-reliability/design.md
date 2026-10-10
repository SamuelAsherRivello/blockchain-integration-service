# Design

## Context

See [proposal.md](proposal.md) for the motivation. The current system already has durable mint, burn, send, delivery, reservation, and checkout records, but their public error projections and read lifecycles are inconsistent. The Admin marketplace batch retries `unavailable` without exposing the underlying preflight condition; generic listing, structured metadata classification, BIS inventory preparation, and Marketplace presentation are split across several layers. The in-progress `codify-view-loading-and-cache` work also touches shared inventory lifecycle and must be reconciled rather than implemented twice.

## Goals / Non-Goals

**Goals:**

- Make every asset mutation and read explain its safe current state.
- Preserve durable operation identity and submission-boundary recovery.
- Make the nine-item catalog independently retryable and verifiable.
- Give Account Assets, Game Wallet, Admin, and Marketplace one role/network-scoped inventory source.
- Keep generic asset APIs game-neutral while making Marketplace classification strict and authoritative.
- Verify the behavior with deterministic tests and separately identified live Signet evidence.

**Non-Goals:**

- Adding a hosted backend, solver, or server-side signer.
- Automatically funding wallets or clearing reservations to make minting succeed.
- Replacing Arkade SDK transaction semantics or treating a public balance as spendable-input proof.
- Automatically burning or reminting live assets without an explicit target inventory and recovery checkpoint.
- Changing the game-facing API to expose Arkade types.

## Decisions

### 1. Introduce an allowlisted asset diagnostic projection

Add a provider-neutral diagnostic model shared by mint availability, listing, Admin progress, and pending UI. It maps internal failures to stable categories such as `insufficient-spendable-funds`, `reserved-inputs`, `provider-unavailable`, `network-mismatch`, `unsupported-input-selection`, `invalid-metadata`, `coordination-unavailable`, and `outcome-unknown`. Raw SDK errors remain internal. A typed projection is preferred over string matching because the current `unavailable` collapse prevents operators from distinguishing balance, reservation, provider, and storage failures.

### 2. Separate preflight, submission, and reconciliation paths

Mint and delivery adapters keep the existing durable journal boundary. Preflight may retry only before a record is written or submission is possible. Once an operation is journaled at the submission boundary, retries reuse the same operation ID and reconcile evidence; they never create a replacement request automatically. This preserves the existing safety model while making the Admin batch's one-item loop explicit.

### 3. Make catalog progress durable at item granularity

The catalog coordinator derives deterministic operation IDs from catalog ID and migration/version identity. Each item is processed and verified independently. A completed item is skipped by durable evidence, a preflight-unavailable item is retryable, and an uncertain item remains protected until reconciliation. The batch publishes success only after one fresh classified holding exists for every expected catalog item.

### 4. Keep BIS as the sole inventory owner

Use the shared BIS preparation lifecycle for Player and Game Wallet public inventory, keyed by role, profile, network, and data kind. Marketplace owns only view state and mapping to cards. The cache is in-memory, complete-success-only, and invalidated by identity, network, logout/reset, mutation, and chain-observer evidence. The existing `codify-view-loading-and-cache` change should absorb or be rebased around this decision; no second Marketplace local-storage cache is retained.

### 5. Enforce metadata authority at classification and publication

Generic listing continues to return all positive holdings and safe metadata. Marketplace classification validates the complete item envelope, including structured deltas. Legacy records without deltas may remain visible as generic or migration-required inventory, but no gameplay effect is inferred from description, family, tier, name, or catalog ID. This resolves the current conflict between the authoritative-metadata design and the legacy classifier fallback.

### 6. Scope UI blocking to the affected resource

Pending dialogs and Marketplace controls use the diagnostic projection and exact operation/item identity. A failed preflight shows retryable reason; unknown work shows reconciliation; unavailable inventory is not rendered as empty. An unresolved item checkout disables only that item while disjoint browsing, inventory inspection, and recovery remain available.

### 7. Verify live behavior without secret-bearing artifacts

Automated tests cover all mapped reasons, metadata forms, cache invalidation, per-item retry, and stale-result guards. Live Signet verification first reads the selected Game Wallet identity/network and exact inventory, then performs only explicitly authorized mint/reconcile steps, recording public operation IDs, asset IDs, and transaction IDs under ignored `output/` paths. A live failure never becomes a reason to weaken the safety guards.

## Risks / Trade-offs

- [More reason codes increase public API surface] → Keep codes allowlisted, JSON-safe, and versioned through shared types.
- [Strict metadata classification hides old items] → Preserve them in generic listing and expose migration-required state; never invent gameplay effects.
- [Fresh reads can be slow] → Reuse complete BIS-owned in-memory results and show independent loading states without false emptiness.
- [A catalog can partially mint] → Durable per-item IDs, exact recovery, and fresh complete verification prevent blind reminting.
- [Existing cache work overlaps this change] → Treat the shared lifecycle as the single integration point and add explicit cross-change coordination tasks.
- [Live Signet state may differ from fixtures] → Require a pre-mutation inventory report and stop on identity, network, or target divergence.

## Migration Plan

1. Add diagnostic types and projections without changing durable journal semantics.
2. Fix generic mint/list error mapping and per-item Admin progress with focused tests.
3. Reconcile shared inventory/cache ownership with `codify-view-loading-and-cache`, then remove duplicate Marketplace cache behavior.
4. Enforce strict structured metadata publication and expose migration-required legacy state.
5. Run typecheck, focused tests, full tests, and builds; classify environment-only failures separately.
6. In a live authorized session, report the selected Game Wallet, network, and exact holdings before any mutation.
7. Reconcile existing pending records; only then mint or migrate catalog items one at a time and verify fresh ownership after each item.
8. Verify Marketplace listing/detail/checkout and the separate game's equipment behavior from chain-provided deltas.

## Open Questions

- Which existing live catalog holdings, if any, are intentionally legacy and should be migrated rather than merely marked migration-required? This is resolved at the pre-mutation inventory checkpoint and does not change the implementation architecture.
