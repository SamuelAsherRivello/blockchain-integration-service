# Tasks

## 1. Continue readiness and gesture ownership

- [x] 1.1 Add deferred-promise regressions in `wallet-readiness-races.test.mjs` alongside `game-continue.test.mjs` for A-before-B and B-before-A eligibility completion; verify the current first-promise implementation fails the superseded-read case without real wallet activity.
- [x] 1.2 Make `readyAsync()` join the latest applicable read and coalesce compatible in-flight eligibility work under the bounded read policy; verify the regressions pass, older negative/positive results are ignored, and unavailable reads permit a later fresh attempt.
- [x] 1.3 Bind Admin payment preparation to player/network/recipient/session scope with a synchronous preparation guard and final pre-request revalidation; verify duplicate gestures submit at most once and account, network, recipient, same-identity relogin, and disposal changes submit nothing from the old gesture.
- [x] 1.4 Extend the real Admin readiness fixture and `smoke-admin-continue-readiness.mjs` for a same-scope notification during readiness, latest-read failure/recovery, and session replacement; verify first-click behavior and exact submission counts without live payments.
- [x] 1.5 Update the integration package README's existing readiness/API guidance while preserving its named-file conventions and target length; verify examples distinguish preparing, verified unavailable, and submitted pending outcomes and use the additive API correctly.

## 2. Game Wallet refresh publication

- [x] 2.1 Add controlled-order tests in `wallet-readiness-races.test.mjs` alongside `game-wallet.test.mjs` where an old storage read resolves after a newer ready refresh with a player-role conflict, network mismatch, null selection, or failure; verify the current role-conflict branch reproduces the stale-state failure.
- [x] 2.2 Check refresh generation, lifecycle, player, network, and abort ownership immediately after storage awaits and before every selection/state effect; verify old completions leave the newer profile, selection version, status, addresses, balance, and diagnostics unchanged.
- [x] 2.3 Apply consistent scope validation to inspection and observation completion, with subscription cleanup; verify logout, disposal, network replacement, and same-identity session replacement suppress obsolete results while a current real mismatch still reports its category.
- [x] 2.4 Extend the existing Admin Game Wallet fixture/browser coverage for the late-conflict sequence and document the current-read-only diagnostic behavior in existing relevant documentation; verify the newer wallet remains ready and that documentation makes no live-settlement claim.

## 3. Checkout scope and recovery

- [x] 3.1 Extract a narrow testable checkout orchestration boundary from Marketplace `App.tsx` if required, retaining the existing durable checkout module; add failing balance/recipient preflight tests for replacing either wallet or network, and verify stale preparation currently reaches advancement.
- [x] 3.2 Freeze checkout intent and session scope at gesture acceptance and revalidate after preflight awaits and before journal creation; verify stale preparation creates zero journals and invokes zero signing/submission callbacks, including A-to-B-to-A sessions and changed item selection.
- [x] 3.3 Guard every payment/delivery callback and next-leg transition with the original scope while retaining integration-layer lock/current-account checks; verify replacement during a lock/preflight wait cannot sign through the new session and submitted first-leg journals remain original and recoverable.
- [x] 3.4 Bind recovery polling and UI publication to checkout identity and lifecycle generation; verify old polls cannot advance a leg, repopulate a replacement session, or recreate records removed by logout, while explicit matching-scope resumption remains possible without a duplicate leg.
- [x] 3.5 Cover legacy-record network validation, exact-operation evidence, same-item overlapping gestures, and disjoint-item behavior; verify unavailable network/evidence stops recovery safely without journal migration or replacement transactions.
- [x] 3.6 Add a Marketplace browser fixture using real orchestration with controlled read completion and mutation spies; verify wallet replacement during both preflight awaits prevents mutation. Update Marketplace README guidance on interrupted-session recovery, preserving README length/link conventions and the existing settlement policy.

## 4. Integration verification

- [x] 4.1 Run focused Continue, Game Wallet, checkout, Admin, and Marketplace tests plus `npm run typecheck` and affected production builds; verify no new failures and record any independently reproduced baseline failures separately, including the existing unresolved-transfer eligibility assertion.
- [x] 4.2 Run the applicable root suite and the Admin/Marketplace browser regressions; verify there are no duplicate submissions or cross-session publications, and keep optional reports/screenshots only in the prescribed `output/` task folders without secrets.
- [x] 4.3 Review the implementation diff against all three delta specs and the related active changes; verify only requested files changed, journals and settlement-policy gates remain compatible, and `openspec validate repair-async-wallet-readiness-races --strict` passes before marking implementation complete.

## Acceptance evidence

All 18 tasks are complete. Focused verification passed 119 tests; TypeScript and the integration, Admin, and Marketplace production builds passed. Playwright CLI exercised the real Admin handler and Game Wallet view plus actual Marketplace orchestration using memory-only adapters. Snapshots and console inspection showed zero page errors; stale checkout preparation produced zero journals and zero submissions. The combined Admin smoke runner also passed pending, duplicate, failure/retry, guest, insufficient-balance, overlapping-read, replacement, and fresh-read recovery cases. No live payments or settlement claims were involved.

The applicable root run passed 808/813 tests. A missing integration build during concurrent builds and a background-cache browser timeout both passed isolated reruns. Two unrelated Continue eligibility assertions were independently reproduced using the unchanged context from commit `324d903a`; release-surface version synchronization also remains failing. These failures are recorded rather than changing unrelated spendability or release policy. Another process committed the shared working tree and advanced release metadata during verification; this task performed no Git write operation.

Detailed logs, baseline reproduction, and acceptance notes are in ignored `output/reports/async-wallet-readiness/`; Playwright CLI artifacts are in `output/playwright/async-wallet-readiness/`. Integration and Marketplace READMEs are 649 and 551 words respectively. All three delta specs were reviewed against the repair and the existing cache/reliability/local-checkout plans. Existing journal schema, reservations, and settlement-policy boundaries are retained. Strict OpenSpec validation passed.
