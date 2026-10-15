## Archive disposition — 2026-09-09

Archived at the user's request after the accepted four-run cohort and three additional runs reached verified Step 6. Eleven of 26 tasks are complete; the 15 unchecked tasks remain unfinished and are retained for any future follow-up. Archive status records acceptance of the spike outcome, not implementation of every original robustness requirement. See [verification.md](verification.md) for evidence and remaining scope.

## 1. Recovery contract and regression harness

- [ ] 1.1 Add a boundary-to-test matrix for bootstrap/window ownership, identity crypto and storage, wallet connection, faucet/copy, funding reads, preparation, each settlement request/event/cleanup, final verification, timing and rendering; verify every boundary has a timeout policy, safe fallback, and assigned test case.
- [x] 1.2 Extend the current lifecycle harness with a real queued-lock model, fake time, delayed/hanging responses, and observable active-request/signer counts; verify it reproduces startup without reconnect, hung observation, and input recapture after failed preparation before changing production behavior.
- [x] 1.3 Add the proposed recovery classifier and persisted retry scheduling model, covering unknown errors, digest/config changes, Retry-After, capped jitter, and normal external waiting; verify deterministic policy tests including reload and notification-triggered retry suppression.

## 2. Bootstrap, deadlines, and lifecycle recovery

- [ ] 2.1 Introduce the minimal bootstrap/error shell for both spike entries and explicit retryable window/storage initialization; verify import rejection, missing capabilities, blocked storage and late ownership completion produce usable UI without changing identity or URL scope.
- [x] 2.2 Implement document-scoped provider transport deadlines with caller-signal preservation and redacted status metadata; verify hung response headers/bodies abort, streaming/nonmatching requests remain unchanged, duplicate installation is prevented, and mutation timeouts never trigger transport replay.
- [ ] 2.3 Handle IndexedDB blocked/error/abort/versionchange events, transaction deadlines, late-open disposal and uncertain write readback; verify real storage-path tests retain the existing account and never treat an ambiguous write as permission to generate another identity.
- [ ] 2.4 Add same-account startup reconnect and lifecycle scheduling independent of the initial status read; verify temporary startup outage recovery, offline/online, visibility/resume, BFCache restore, and failed/late wallet disposal without duplicate subscriptions.

## 3. Durable and isolated workflow progression

- [x] 3.1 Add versioned recovery/revision metadata and a durable prepared checkpoint, including conservative interpretation of legacy idle records with captured inputs; verify a later deposit and changed slider cannot replace the original snapshot after a failed preparation.
- [x] 3.2 Refactor save/transition handling so durable commit precedes published financial state and optional timing/rendering runs independently; verify failed writes leave the prior checkpoint authoritative and block dependent submission.
- [x] 3.3 Move network observations outside short operation critical sections, add cancellable acquisition deadlines, and revalidate revision/freshness on reentry; verify a hung history request does not block unrelated observation or Restart and event storms have bounded active work.
- [ ] 3.4 Fence all startup, observation, settlement and recovery results by account/window and applicable revision/attempt/leg; verify delayed callbacks after restart or a newer attempt cannot advance the wrong operation.
- [ ] 3.5 Separate restart's durable archive/replacement from best-effort preferences and timing, and restore the appropriate scheduler after failure; verify preference failure after commit activates the saved new identity, transaction failure retains the old identity, and repeated clicks cannot create extra accounts.

## 4. Settlement recovery and step diagnostics

- [ ] 4.1 Route critical callback/persistence failures into uncertainty handling while isolating presentation failures; verify lost registration/commitment acknowledgements and callback exceptions in both legs reconcile exact evidence without replaying a completed leg.
- [ ] 4.2 Apply the shared policy to preparation, signing and verification; retain cleanup-before-retry and add stage-progress diagnostics alongside stream inactivity detection; verify prolonged outages, unrelated stream events, stalled cleanup, unknown errors and permanent validation failures produce the specified recovery or pause.
- [ ] 4.3 Add step-local error status, checkpoint, retry countdown and safe retry/remedy actions, with bounded redacted diagnostics and a nonrecursive fallback; verify failure rendering on every step and that arbitrary thrown secrets/payloads never appear in UI or stored diagnostic records.
- [x] 4.4 Preserve explicit faucet navigation to signet.2nd.dev and provide a permanent direct link plus copyable address when navigation/clipboard fails; verify funding is never requested automatically and popup return values are not mistaken for deposit evidence.

## 5. Reduce avoidable latency and instrument timing

- [ ] 5.1 Connect one managed SDK incoming-funds subscription and settlement completion/events to immediate coalesced observations with five-second polling fallback; verify notification loss, reconnection, cleanup, and no poll delay after eligible events.
- [ ] 5.2 Separate phase-required evidence from optional balance/history presentation and deduplicate equivalent reads per observation generation; verify fresh pre-submission checks remain mandatory, unrelated read failures do not block eligible transitions, and identical timeline tests show no increase in redundant calls.
- [ ] 5.3 Record additive per-leg milestones, request durations, recovery waits, client handoffs and lifecycle gaps while preserving legacy timing samples; verify repeated events/reloads do not double-count, optional timing failure does not gate progress, and overlapping intervals are not summed into false totals.
- [ ] 5.4 Add separately verified target-spendability timing and comparable-route summary statistics including incomplete outcomes; verify unconfirmed commitments keep Step 6 pending, final success still passes the original exact-output predicate, and missing historical detail stays labelled unknown.
- [ ] 5.5 Benchmark identical healthy and faulted timelines before/after, including concurrent windows; verify eligible foreground actions are scheduled within one second of fresh validation and report measured client savings separately from external wait time.

## 6. Integration and live acceptance

- [ ] 6.1 Complete the failure/hang matrix across all six steps and both sides of persistence/submission boundaries, including full-board and two-leg routes; verify transient recovery reaches Step 6, permanent blockers remain responsive, and no duplicate signer, changed snapshot, resource leak or false success occurs.
- [x] 6.2 Run `npm run test --workspace @spike/balance-onboard`, `npm run build --workspace @spike/balance-onboard`, and `npm run build --workspace @bis/integration-demo`; verify passing results and browser smoke tests for both entries, isolated simultaneous windows, reload persistence and the populated public-address URL.
- [x] 6.3 Monitor the user's four funded 50% runs from 2026-09-09 (windows a63b5130, 12694712, d210b261 and 42681a67, using their new public addresses recorded in the acceptance report); verify Step 6, exact amounts and both confirmed commitments for each. All four passed after the tested batch-correlation fix, verified at 11:56 UTC with both commitments in block 321340. Total durations: 33m 21s, 32m 58s, 33m 1s, 33m 3s; all include pre-fix failures. The user accepts the spike on these four successes. No account reset, new funding, or deliberate fault injection was required. The broader fault-injection matrix remains in 6.1.
- [x] 6.4 Update the standalone README and deliver a timing/recovery report under repository-root `output/reports/robust-fixes-for-spike/`; verify the report separates user-reported history, automated faults and new live evidence, includes sample counts and limitations, and contains no recovery secrets. Completed: four-run post-mortem, three-run acceptance/chain evidence, and durable H1 post-mortems with exact amounts, timestamps, public commitments, agent-caused interruption, measured durations and benchmark limitations.
- [x] 6.5 Reconcile the original unarchived spike specification's manual-onboarding, disabled-restart and origin-shared timing wording with the later approved automatic/window-scoped behavior when preparing these spike changes for sync; verify compatibility with this capability and strict OpenSpec validation without changing the separate BIS onboarding proposal.
