# Automatic BIS onboarding verification

Date: 2026-09-09. Implementation is present; real funded BIS acceptance is still open. The spike's results are not substituted for BIS acceptance.

## Delivered behavior

- Player activation/restoration starts account-scoped assessment independently of account-page navigation. Healthy checks run every five seconds and wallet events can request a coalesced check.
- Confirmed eligible Bitcoin inputs are frozen; target is floor(total / 2). The first settlement has only an Arkade output. The second spends only attributed first-leg receipts and returns the exact remainder to the same Bitcoin address.
- Live exact final receipt verification and the durable Complete revision release onboarding reservations immediately. Bitcoin block confirmation is tracked separately and cannot delay spendability. Later spending and deposits do not restart setup.
- A previously funded account with verified independent spendable Arkade funds is already ready. It does not receive fabricated settlement history.
- Balance has the exact three-state button above Get Recovery Phrase. Its five collapsible CPU/USER stages expose current public funding address, Copy, faucet search, independent transaction statuses, progress, timing and countdown. No funding acknowledgement or manual onboard button is needed.
- Account changes/disposal close the old worker. Admin Reset preserves pending onboarding. Acknowledged logout includes the new parent in pending-loss counting and existing player cleanup.

## Automated evidence

37 onboarding tests pass across allocation, journal, adapter, coordinator, stream and context suites. They exercise exact odd-sat conservation, scope/corruption handling, competing coordinators, durable submission gates, failed persistence, unavailable/foreign receipts, independent confirmation states, before-confirmation completion, reservation handoff, safe return-leg continuation, delayed signer disposal, cooldown on restart, ignored obsolete callbacks, and Admin Reset protection.

`npm run build` passes type checking plus the integration and integration-demo builds. The existing bundle-size warning remains.

Final root regression command: `npm test -- --test-force-exit --test-concurrency=4`. Result: **525 tests, 522 passed, 3 failed**. Force-exit is necessary for test Vite handles; limiting concurrency avoids the observed unrelated timing flakes. The same three failures reproduced with pre-onboarding versions of context, reservations and logout cleanup in an isolated copy:

1. `boarding-recovery.test.mjs`: storage cleanup rechecks pending consent and account identity inside its lock.
2. `boarding-recovery.test.mjs`: logout and reset preserve unresolved identity and journals; verified terminal records permit cleanup.
3. `continuation.test.mjs`: same identity is durable and idempotent; changed amount/context fails; generic sends cannot overwrite it.

They were not changed as part of this delivery. An earlier fully concurrent run additionally hit three LTO timing failures; the LTO suite passed in isolation and all three passed in the final limited-concurrency run.

Logs: repository `output/logs/automatic-bis-onboarding/` contains `onboarding-tests.log`, `regression-final.log`, `baseline.log` and `build-final.log`. Baseline copies are ignored artifacts under `output/tests/onboarding-baseline/`.

## Browser evidence

The real Chrome demo on port 5174 showed the existing player account's 269,715 spendable Arkade sats and **Onboarding: Complete**. Navigation opened the five-stage page, with no fictitious onboarding transfer required.

The isolated browser harness at `/tests/onboarding-host.html` passed automatic activation without navigation, exact Balance button placement, five stages, minimal faucet URL, one confirmed plus one unconfirmed incoming transaction, 100px transaction output, countdown, nonblocking details and Back. This is simulated receipt evidence, not live settlement evidence.

A separate fixed build is served on `http://127.0.0.1:5192/`, with HTTP 200 and the demo HTML verified. The fresh account was created and saved through the actual UI without revealing or exporting its phrase. It showed zero balances and **Onboarding: Start?**. Its public Bitcoin boarding address is:

`tb1pj0maezw7l97m2mvkgsnmvz9kyep5xml057c9z9xje84qagrc4kesxjh5za`

The final build was loaded before funding or any settlement began. Build identity: BIS 0.14.1, declared SDK 0.4.71; entry asset `assets/index-D_yHZbfu.js`; index HTML SHA-256 `8E944C0572861CF50F547D8280D00E08BADD74D9808A287AEFF67CB505D2932E`. No source or build edits should be made to this fixed preview while a funded acceptance run is active.

Funding remains an external prerequisite. Restoring a player wallet with confirmed Signet Bitcoin and no spendable Arkade funds can replace faucet funding. Restoring an already spendable Arkade wallet tests the already-ready path only. The Admin Game Wallet is a different account and does not fund the player onboarding automatically.

After the user reported the player funded, the live Chrome preview on port 5192 showed current player ID `38a45d3d35c367c1d19f4d93d8231acd73ce36d98cb0576b31a387ebc87ce803`, replacing the fresh test identity in that browser origin. Balance showed **100,000 Bitcoin sats + 270,715 Arkade sats = 370,715 sats**. Onboarding showed **Complete**, with “Existing spendable funds verified. Account ready.” and “Already funded with spendable Arkade sats. No onboarding transfer needed.” Its boarding address was `tb1p0gpkrt05mmf06mk9gk38gzawlcpmanmfycztyl8lankv2ap85r9s80gfa0`. This verifies the restored, already-funded player path on the fixed preview; it is not evidence of a new two-leg automatic transfer. No new transfer or wallet reset was triggered to change that result. The Admin Game Wallet was unavailable, so the game payment acceptance was not exercised.

## Recovery boundaries and rollback

- Unknown registrations, selected batch failures and interrupted signing are observed automatically, with original input holds retained. **No automatic delete-intent or ambiguous re-registration** is enabled. A later exact receipt can advance the original operation; a proven unsubmitted next leg continues automatically.
- An SDK request deadline closes signing gates and aborts the actual event source. Its signer lease stays held until the settlement promise and SDK cleanup actually terminate. Readonly observation can continue; a new signer cannot replace an incompletely disposed signer.
- Previously verified independent Arkade receipts and independent Bitcoin funds remain available through ordinary reservation-aware selection. Newly visible Arkade receipts after first-leg verification stay conservatively held until return attribution resolves; unavailable ancestry never releases them early.
- Timing is derived from the one durable operation. Registration, acknowledged participation, finalization, spendable receipt and Bitcoin confirmation observations have separate fields. Restarted/interrupted work is excluded from uninterrupted averages; no spike measurement is imported. One-time onboarding can contribute at most one completed sample per saved account operation.
- Rollback should disable new coordinator creation while retaining the onboarding journal schema, reservation projection and readonly reconciliation. Never remove parent records, clear wallet storage or cancel intents to force recovery. Existing manual transfer and cancellation workflows retain their separate scope.

## Outstanding live acceptance

Tasks 6.2–6.4 and 6.6 remain open: real funding detection/mixed confirmations/multiple tabs, the two exact automatic settlements on the fixed build, an explicitly requested normal payment using the released target, and separately labeled recovery runs. No transaction IDs, elapsed totals or successful payment results are claimed before they are observed.
