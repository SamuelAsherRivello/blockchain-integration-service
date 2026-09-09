## 1. Contract execution and automated acceptance

The checked tasks in sections 1–5 record the accepted original implementation. Section 6 is the subsequently approved hosted-wallet replacement and must be verified separately. Historical browser-origin provisioning in 4.2 is superseded by 6.4, not evidence that the hosted service is delivered.

- [x] 1.1 Verify the installed SDK/operator compatibility and document the exact funded contract script paths, network/minimum constraints and claim/cancellation construction. Confirm a game-funded 1,000-sat claim needs no pre-existing player funds; record unsupported conditions rather than substituting ordinary sends.
- [x] 1.2 Preserve the existing funded Signet probe evidence for zero-fee funding, claim, cooperative refund and measured latency; verify controlled multi-input/change and unrelated-asset preservation with the isolated real-SDK operator tests. Distinguish each evidence source rather than requiring a further funded click.
- [x] 1.3 Verify submission-timeout recovery and claim/refund races in automated adapter/service tests. Verify the default public factory can create/claim and explicit creation-disabled rollback preserves query/refund recovery. Keep extended live observations separate; remove the unconditional runtime acceptance switch.

## 2. Generic contract core and persistence

- [x] 2.1 Add failing lifecycle tests for separate financial/eligibility states, immutable deadlines, exclusivity, duplicate session calls, account/network isolation and end-during-funding; implement the generic model and sanitized public types.
- [x] 2.2 Add versioned encrypted recovery storage, durable operation IDs, host references and exclusivity slots; verify reload, corrupt/unknown records and additive migration preserve prior accounts and pending operations.
- [x] 2.3 Integrate contract input/outpoint reservations with existing wallet mutations and asset preservation; test conflicting tabs, unrelated reserved coins, independent funds, insufficient balance and changed fees.
- [x] 2.4 Implement the verified Arkade adapter for funding, claim, refund and read-only reconciliation. Test explicit not-submitted versus unknown outcomes, exact receipt correlation and no conflicting cleanup after possible claim submission.
- [x] 2.5 Expose additive public checkContracts and LTO service operations using an explicit game-wallet controller; verify the host never receives signer secrets or Arkade-specific objects and read queries never sign or spend.
- [x] 2.6 Add expiry/visibility/reopen reconciliation and idempotent cleanup that survives host UI disposal. Verify only eligible supported contracts are cleaned, and unresolved records remain occupied until verified terminal evidence.
- [x] 2.7 Integrate player logout pending-loss inventory, separate game refund records, game-wallet switching and guarded Admin Reset. Verify existing acknowledged player-logout behavior remains intact and does not falsely cancel transactions.

## 3. BIS Contracts UI and financial feedback

- [x] 3.1 Add Contracts to Account Details and implement accessible list/details using existing Assets and report conventions; cover empty, unavailable, funding, active, expired/refund-pending, unknown and terminal-removal cases.
- [x] 3.2 Wire role-eligible Claim/Reject/Refund to the shared controllers; test disabled states, revalidation, repeated clicks and account replacement without a Burn/debug bypass.
- [x] 3.3 Integrate operation-specific pending/confirmed/error toasts and Activity correlation; verify deduplication and that automatic operations do not open blocking dialogs or pause gameplay.
- [x] 3.4 Add G1/G2 BIS demonstrations using production public APIs. G2 has always-clickable Start LTO and Claim LTO subbuttons, a 90-second countdown, and console status feedback. Simulate host session/claim events only; keep the actual game prompt separate and distinguish fixtures from Signet outcomes.

## 4. Stealth & Steel integration

- [x] 4.1 Inspect applicable game instructions and use the existing local BIS package/vendor inventory workflow to consume the new additive API; verify a single compatible React dependency and the actual loaded BIS version.
- [x] 4.2 Extend `src/runtime/integration/bis-account.js` with game-wallet/LTO controller initialization and a developer provisioning path outside the start menu. Verify same-origin saved signer reuse, missing signer skip, distinct player identity and no embedded secret or cross-origin credential copying.
- [x] 4.3 Add a game-owned session controller and integrate Start/end hooks in `src/runtime/main.js`: immediate 90-second clock, nonblocking readiness check, single attempt, silent menu cleanup and no late replacement after skip. Test pause/tab suspension, pay-to-continue, progression, logout, reload and repeated Start.
- [ ] 4.4 Add a persistent Tiled treasure chest spawner through the game's object/spawner conventions, choosing reusable artwork and a specific authored level position. Verify editor palette/save/reload and runtime sensor placement, and that backend state never prevents spawning or inspection.
- [x] 4.5 Implement the game-owned Treasure Chest dialogue, matching contract selection, preparation/expired/no-offer/unavailable/resolved states, countdown and Claim/Reject/Back behavior. Verify focus, touch/keyboard input isolation, overlap debounce and release of only the treasure pause reason.
- [x] 4.6 Keep BIS toasts mounted passively through treasure closure and async completion; verify late events cannot reopen UI, affect a different session or recreate an offer.

## 5. Verification, documentation and rollout

- [x] 5.1 Run focused contract/adapter/storage/UI tests and both projects' required type/build/package checks. Verify regressions for Assets, Transactions, ordinary game payments, wallet logout and reservation behavior.
- [ ] 5.2 Verify BIS G1/G2 in a real browser and Stealth & Steel in its actual runtime at narrow/mobile and desktop sizes. Cover Start before wallet readiness, funding pending, insufficient game funds, claim, reject, open-at-expiry, no-offer, pause/resume, ongoing gameplay and expired chest after refund.
- [ ] 5.3 Record real Signet funding and claim (including zero-balance player), Reject refund, expiry refund and session-end cleanup with exact non-secret transaction evidence and before/after balances; verify no asset loss or duplicate funding. Record measured creation/refund latencies rather than claiming instant cancellation. This is an extended live evidence record, not a prerequisite for enabling the runtime or a requested human handoff.
- [x] 5.4 Exercise reload/offline recovery, ending a session during funding, prior unresolved offer at Start, cooperating tabs and claim/refund race. Verify the original operation is reconciled and no skipped session receives a late replacement.
- [x] 5.5 Reconcile G1/G2 story documentation and game consumer documentation with delivered scope, distinguish proposal defaults from verified behavior, and document one-time signer setup outside the start menu. Keep physical-device limitations explicit where only emulation was available.
- [x] 5.6 Verify explicit creation-disabled rollback preserves query/refund/recovery for outstanding contracts; validate OpenSpec and report BIS delivery, game package delivery and live financial evidence separately. Do not mark an unobserved live scenario as passed.

## Apply checkpoint — 2026-09-09

## 6. Shared hosted game wallet follow-up

- [ ] 6.1 Add private disk-backed wallet and contract/journal persistence with one service writer. Verify encrypted restart recovery, failed writes, concurrent writer rejection and no public secret exposure.
- [ ] 6.2 Host existing game-wallet and LTO operations with shared reservations, authenticated player actions and narrowly scoped browser claim signing. Verify duplicate requests, different players/origins, altered signing responses, unknown submission recovery and exact asset-preserving receipts.
- [ ] 6.3 Connect BIS Admin import, wallet actions and G1/G2 to the service; verify one import persists and works after Admin closes, truthful pending/errors and no secret console output.
- [ ] 6.4 Connect the game through the public BIS API and remove its separate Game Wallet import UI. Repackage BIS and verify the installed inventory, both builds and an actual Level01 collision flow with the service.
- [ ] 6.5 Provide identical local/deployed service configuration and deployment instructions for a private persistent volume and HTTPS endpoint. Verify service health, protected Admin access, configured game origin, and document any unavailable deployment evidence explicitly.
- [ ] 6.6 Run service, browser and game acceptance for Start, Claim, Reject, expiry, two clients and restart. Update play instructions and retain X8 as the deferred security rethink. Record real network outcomes separately from isolated fixtures.

## Historical apply checkpoint — 2026-09-09

Nine tasks are checked. Remaining tasks include partly implemented work whose full acceptance matrix has not passed. The initial live script probe passed, but 1.2/1.3 remain open for unrelated-input/change preservation and the funded claim/refund race. Public creation stays disabled. Builds and focused tests pass; baseline BIS failures and unrelated game map failures are recorded in verification.md. Unchecked live/device/editor acceptance tasks do not imply that their entire implementation is missing.

## Autonomous verification checkpoint — 2026-09-09

13/26 tasks complete. The user requested no further probe clicks or manual testing handoffs. Autonomous verification now includes a network-isolated simulated operator using real SDK signing and browser fixtures exercising the production service, encrypted IndexedDB and G2/Contracts UI. Live Signet acceptance remains distinct and incomplete; no fake confirmation or capability override was added to the public app.

## Game and reset acceptance checkpoint — 2026-09-09

19/26 tasks complete. Automated game acceptance now covers all treasure dialog states, input/focus isolation, duplicate/late actions, signer provisioning, original-deadline continuity and passive toasts. Actual Level01 browser checks pass at desktop and 360px width, and the loaded BIS version was verified. Admin Reset now uses the exclusive origin mutation lock and rejects unresolved contracts for either participant; acknowledged logout behavior remains unchanged. A real two-tab browser fixture verifies shared storage/locks and no cross-session claim or late replacement.

Still open: live feasibility and production service/game financial acceptance; Tiled editor save/reload (installed headless exporter crashed); full regression acceptance with documented baseline/unrelated failures. No human acceptance handoff is requested. The public creation gate remains closed.

## Runtime acceptance restructuring — 2026-09-09

The user explicitly requested replacing the live acceptance blocker. Current policy supersedes the historical gate checkpoints above: public creation is enabled by default and is governed by runtime wallet, operator, fee, input, deadline and recovery validation. Explicit host rollback remains available. Automated acceptance is complete for this rollout change: 54 focused tests and the browser suite pass, including the public factory and cooperating tabs. The remaining unchecked broader editor/regression/live evidence items remain accurately recorded, but are not application switches or human-click prerequisites. No claim is made that unobserved live scenarios passed.

## User acceptance and spec sync — 2026-09-09

The user confirmed “works great” after the asset-carrier funding fix and requested spec sync. G1/G2's delivered runtime feature is accepted. The main account-contracts, limited-time-offers and treasure-lto-demo specs now include the final runtime policy, shared collection layout, G2 controls, preserved asset change and sanitized preparation failures.

Tasks 5.1 and 5.4 are complete on the recorded automated/build/browser evidence: relevant regressions pass; the known unrelated full-suite failures remain documented. 23/26 original checklist items are checked. The three unchecked items retain broader verification requirements: Tiled editor round-trip, the complete actual-game browser matrix, and exact extended live transaction/balance evidence. User confirmation is not fabricated evidence for those individual scenarios. These notes do not disable the accepted runtime and do not request further human testing. The change is synced, not archived.
