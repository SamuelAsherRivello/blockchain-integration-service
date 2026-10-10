# Tasks

## 1. Diagnostic contract and safe projections

- [x] 1.1 Define shared allowlisted asset reason codes and JSON-safe diagnostic types for readiness, listing, mint, delivery, and catalog progress; verify the public types compile and serialize without SDK types.
- [x] 1.2 Map internal `AssetError`, provider/network, reservation, storage, coordination, and validation failures without exposing raw SDK messages; verify adversarial errors produce only allowlisted output.
- [x] 1.3 Add focused tests proving pre-submission failures remain definitive, submitted uncertainty remains recoverable, and secrets/private payloads never appear; verify the focused diagnostics test suite passes.

## 2. Mint and listing reliability

- [x] 2.1 Audit `loadMintAvailability`, mint preflight, input selection, reservation checks, and storage writes so positive total balance cannot masquerade as spendable mint readiness; verify reserved-only and provider-unavailable fixtures stop before submission.
- [x] 2.2 Preserve specific mint failure categories through the Player and Game Wallet controllers and public context APIs; verify each category reaches the public result unchanged and safely.
- [x] 2.3 Keep generic listing complete for positive generic, trophy, legacy, and externally created assets; distinguish metadata-read failure from empty ownership; verify list tests cover all cases.
- [x] 2.4 Add tests for provider failure, network mismatch, reserved-only balance, unsupported input selection, invalid metadata, corrupt journals, and fresh recovery after a prior unavailable result; verify the focused asset suite passes.

## 3. Authoritative metadata and classification

- [x] 3.1 Audit every metadata producer and consumer for the structured `bisAttributeDeltas` format, including Admin catalog requests, trophies, listing normalization, Marketplace classification, and public exports; verify the audit with exact producer/consumer fixtures.
- [x] 3.2 Remove gameplay inference from missing or presentation-only fields; classify legacy records as generic or migration-required according to the approved decision; verify no classifier or game path derives effects from description, family, or tier.
- [x] 3.3 Verify all nine item definitions, prices, icon URLs, family/tier identity, and signed deltas through exact metadata fixtures and malformed-chain cases; verify the metadata contract tests pass.
- [x] 3.4 Add migration-safe diagnostics for invalid, incomplete, duplicate, unknown, or out-of-range metadata without hiding the generic holding; verify generic listing and strict classification disagree only in the intended way.

## 4. Catalog mint and burn/recovery

- [x] 4.1 Refactor C.G.2 progress and result projection to report the exact item, operation ID, reason, attempt, and submission boundary; verify the Admin Console renders each field safely.
- [x] 4.2 Process catalog items independently with durable skip/retry/reconcile behavior; preserve completed items and never generate replacement IDs for uncertain work; verify deterministic IDs across repeated invocations.
- [x] 4.3 Verify fresh classified ownership after each item and publish catalog success only after exactly one valid holding per expected catalog ID; verify incomplete and partial batches cannot report success.
- [x] 4.4 Audit C.G.3 exact target discovery, burn reservations, absence verification, partial outcomes, and remint migration guards using the same diagnostics; verify trophy and unrelated assets remain untouched.
- [x] 4.5 Add Admin tests for Shoes I failure/retry, one unknown item, partial completion, duplicate invocation, account change, and complete fresh verification; verify the focused Admin asset suite passes.

## 5. Shared inventory and Marketplace behavior

- [x] 5.1 Reconcile `codify-view-loading-and-cache` with this change and establish one BIS-owned Player/Game Wallet inventory preparation lifecycle; verify the two changes have one authoritative owner and no duplicate cache contract.
- [x] 5.2 Remove or reduce duplicate Marketplace cache/read ownership while preserving role, profile, network, data-kind, TTL, in-flight, and invalidation semantics; verify duplicate provider reads and cross-wallet reuse are impossible.
- [x] 5.3 Make Marketplace distinguish loading, empty, unavailable, invalid metadata, migration-required, and ready item states for each wallet independently; verify UI fixtures render each state.
- [x] 5.4 Scope pending Marketplace actions to exact item and operation identity; preserve disjoint browsing, listing, recovery, and checkout actions; verify one pending item does not disable unrelated items.
- [x] 5.5 Add focused Marketplace tests for route/network propagation, cache reuse, retry, stale result suppression, invalid metadata, and pending item isolation; verify the Marketplace focused suite passes.

## 6. Pending UI, documentation, and verification

- [x] 6.1 Update pending-operation and Admin Console presentation to show safe asset diagnostics and recovery guidance without false failure or success; verify pending, unavailable, unknown, and confirmed examples.
- [x] 6.2 Update package READMEs, user-story documentation, and test fixtures for the final metadata and diagnostic contract; verify documentation links and examples resolve.
- [x] 6.3 Run focused tests, `npm run typecheck`, production builds, and the full applicable suite; record browser/localhost environment failures separately and verify no implementation failure is misclassified.
- [ ] 6.4 Restore the missing Playwright browser runtime or use the supported browser harness, then run browser acceptance for Admin, Marketplace, Account Assets, and pending operations; verify screenshots/reports contain no secrets.

## 7. Live Signet acceptance

- [ ] 7.1 Before mutation, display and verify the selected Game Wallet profile, Signet network, spendable balance, reservations, pending records, and exact current catalog holdings; verify the operator checkpoint matches the intended wallet.
- [ ] 7.2 Reconcile every existing pending/unknown asset operation before starting new catalog work; verify no unresolved operation is silently replaced.
- [ ] 7.3 Mint or migrate the nine catalog items one at a time using stable operation IDs, recording only public evidence under ignored `output/` paths; verify each submitted operation has a public status and recovery identity.
- [ ] 7.4 Verify fresh Game Wallet listing, Marketplace classification, item details, and per-item metadata after each successful mint; verify one valid holding exists per catalog identity.
- [ ] 7.5 Verify one Player Wallet purchase/ownership path and the separate game's selected-item gameplay effect from structured chain deltas; verify the effect is not derived from description or tier.
