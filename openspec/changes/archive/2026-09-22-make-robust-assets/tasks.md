# Tasks

## 1. Regression Coverage

- [x] 1.1 Add an LTO service regression for a settled unavailable same-session attempt not poisoning a later fresh session, and verify it fails before the fix and passes with `npm.cmd exec --workspace @bis/integration -- node --test tests/lto-service.test.mjs`
- [x] 1.2 Add an LTO service regression for durable same-session skip/attempt marking before readiness exits, and verify a later same session cannot late-start while a new session can start
- [x] 1.3 Add a legacy active-network wallet regression for player/game records without `network`, and verify explicit cross-network records still fail before signing or submission
- [x] 1.4 Add asset API regressions for mint/delivery transient busy or unavailable guards clearing after settlement, and verify durable same-operation recovery still prevents duplicate issuance or delivery
- [x] 1.5 Add burn and marketplace H2 regressions for unknown or unavailable per-item outcomes not globally blocking disjoint eligible items, and verify exact unresolved items remain protected
- [x] 1.6 Add marketplace H1 regression for one item preflight failure not permanently suppressing untouched catalog items, and verify a later invocation rechecks current wallet state

## 2. Core Operation State Fixes

- [x] 2.1 Update `createLtoService.start` so in-memory `attempts` entries are removed after settlement, and verify same-key active calls still share one pending promise
- [x] 2.2 Persist LTO same-session attempt markers before readiness exits that must remain skipped, and verify the same session cannot late-start after wallets become ready
- [x] 2.3 Normalize undefined account `network` values only at active network-scoped store comparison points, and verify explicit network mismatches remain unavailable
- [x] 2.4 Audit LTO claim, reject, refund, and reconcile transient guards for `finally` cleanup or bounded single-flight behavior, and verify claim after an earlier ineligible click re-evaluates current contract state
- [x] 2.5 Audit asset mint, delivery, and burn mutation paths for stale busy/single-flight state, and verify submitted or unknown durable records remain the only post-settlement duplicate guard

## 3. Admin And Marketplace Batch Robustness

- [x] 3.1 Update H1 marketplace mint batch handling so each catalog item has independent transient outcome state, and verify a failed item does not block later untouched items
- [x] 3.2 Update H2 marketplace burn batch handling so per-item unknown outcomes reconcile or skip only that exact item, and verify disjoint eligible items continue processing
- [x] 3.3 Ensure batch logging reports item-level pending, unknown, skipped, and completed results without exposing secrets or raw SDK/provider errors, and verify console output remains JSON-safe
- [x] 3.4 Verify H1/H2 preserve existing durable operation IDs and do not mint, burn, or deliver duplicate assets for exact repeated operations

## 4. Demo Control Behavior

- [x] 4.1 Update the G2 treasure session/controller integration so Start LTO creates a fresh session after a previous settled unavailable attempt, and verify countdown binds only to the new concrete offer or preparation state
- [x] 4.2 Verify Claim LTO before an active offer reports ineligible state without creating an offer, then later re-evaluates a current claimable offer
- [x] 4.3 Verify Game Wallet selection or active-network changes invalidate the visible developer session and require a fresh Start LTO

## 5. Validation

- [x] 5.1 Run focused integration tests for LTO, treasure session, asset API, burn, marketplace mint/burn batches, and wallet-operation availability, and record any unrelated pre-existing failures separately
- [x] 5.2 Run the relevant browser fixture for G2 LTO controls if UI behavior changed, and verify the toast/countdown behavior is visible without blocking ordinary gameplay (not required; no UI code changed)
- [x] 5.3 Run `openspec validate make-robust-assets --strict` and verify the change remains valid after implementation tasks are updated
- [x] 5.4 Inspect `git diff -- openspec/changes/make-robust-assets BIS/packages/integration BIS/packages/integration-demo` and verify only scoped files changed, with unrelated dirty work preserved
