## Why

BIS demonstrates payments and assets but lacks a way to inspect funded programmable agreements. G1 Contracts UI and G2 LTO Treasure Chest introduce a reusable limited-time reward contract through a session-based 1,000-sat treasure challenge, with real funding, claiming and refunding visible in the demo.

## What Changes

- Follow-up approved 2026-09-09: import the game wallet once in BIS Admin, persist it on a private hosted service, and use that service for both local and deployed play. Replace the game's separate wallet-import UI. Game secrets stay on the service; the player's signer stays in the browser. Existing G1/G2 acceptance describes the prior client implementation, not this replacement.

- Add an account-scoped Contracts list and detail view for BIS-tracked unresolved contracts, extensible beyond limited-time offers (LTOs).
- Add provider-neutral APIs for querying contracts and creating, claiming, ending and reconciling LTOs. Treasure classification, session association, collision and treasure dialogue belong to the host game.
- At Start, start a 90-second elapsed-time deadline and automatically fund a 1,000-sat offer in the background only when player and game-wallet readiness and prior-offer cleanup permit. No treasure button or debugging information is added to the start menu.
- Keep the chest present and collidable independently of backend status. The game displays Claim/Reject, preparation, expiry and Back states. BIS provides unobtrusive pending/confirmed transaction toasts.
- Enforce one unresolved treasure offer per player; Reject and session end request refund rather than destroying sats. Expiry and start-menu checks perform the same eligible cleanup. Skip a session's replacement if the previous offer cannot be resolved immediately.
- Preserve durable recovery and reservations through pending/unknown outcomes. Expiry never means a refund has completed.
- Enable the Signet LTO API by default, subject to per-operation wallet, fee, input, deadline and recovery checks. An explicit creationEnabled:false rollback stops new offers while preserving recovery. Automated acceptance runs without funded human clicks; historical and unverified live scenarios are reported separately, never as simulated financial success.

## Capabilities

### New Capabilities

- `account-contracts`: Account-scoped generic contract list, details, querying and eligibility presentation.
- `limited-time-offers`: Funded LTO lifecycle, wallet readiness, operations, persistence, reservations and recovery.
- `treasure-lto-demo`: Host-owned session/chest workflow using generic BIS contracts, demonstrated in the BIS host harness and specified for Stealth & Steel integration.

### Modified Capabilities

None. Existing logout and reservation policies remain applicable; the new contract records participate without changing their general rules.

## Impact

- `BIS/packages/integration/src/core`: context/public API, game-wallet signer reuse, new contract lifecycle/storage, reservations, activity and toast integration.
- `BIS/packages/integration/src/arkade`: custom contract construction/funding/spending/reconciliation with the currently declared SDK 0.4.71. Current ordinary send/mint capability does not prove custom-contract feasibility.
- `BIS/packages/integration/src/ui`: Account navigation and generic Contracts list/details. Treasure prompt is host UI, not a BIS wallet component.
- `BIS/packages/integration-demo`: G1/G2 host demonstrations; simulate gameplay events only, using real production financial operations for live acceptance.
- `BIS/documentation/User Story Diagrams.md`: reconcile G stories with the later interview, especially Start-triggered funding instead of menu-triggered funding.
- Stealth & Steel is included in the planned delivery following the user's explicit cross-project authorization: update its public BIS package, game-wallet setup, chest spawner, dialogue, pause/resume and session hooks in `D:/Documents/Projects/VC/BabylonJS/babylon-lite-stealth-grid/STEALTH_STEEL`. Actual implementation remains a separate apply step. Planning stays in this canonical BIS change rather than creating competing copies.
- Add a BIS-owned wallet service for private disk persistence, game signing and shared contract recovery. This explicitly supersedes the earlier no-custom-backend constraint for the game wallet. No self-hosted Arkade operator, delegate or browser service worker is required. X8. Add security to game wallet remains the separately deferred security rethink; secret separation and durable transaction correctness are required now.

## Unresolved decisions and feasibility

- Use the delivered no-offer, unavailable and missing-player messages. Configure a public HTTPS service endpoint for deployment; GitHub Pages cannot execute the wallet service. Local development uses the identical service protocol.
- Verify precise contract refund timing, cooperative cancellation path, input selection, fee handling and deadline enforcement. The live Signet info read on 2026-09-09 reported txFeeRate 0, empty intent-fee formulas and dust 330; this is not proof that the proposed lifecycle is free or supported.
- "Cheap" is presently a zero-fee target; creation/cancellation latency must be measured. Do not promise instant resolution or queue a later replacement in a skipped session.
- Gameplay deadlines are client-enforced for this learning demo. No cheat-resistance guarantee or strict deadline-confirmed payout is promised.
