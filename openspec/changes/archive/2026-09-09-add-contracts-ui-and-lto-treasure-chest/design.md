## Context

See proposal.md for motivation and scope. The current BIS package declares SDK 0.4.71. `core/game-wallet.ts` exports a signer-capable controller, backed by encrypted same-origin IndexedDB in `game-wallet-storage.ts`, for ordinary payments, minting and boarding. `createBisContext()` alone does not load this game signer. The G1/G2 implementation now supplies the generic LTO lifecycle and UI.

Stealth & Steel now instantiates player, game-wallet and LTO controllers, a passive toast overlay, session hooks and a persistent Level01 chest. Its separate Developer Game Wallet import is the rejected UX. The 2026-09-09 follow-up replaces that provisioning path with one Admin-managed hosted wallet for both local and deployed games. Prior acceptance remains historical evidence for the client implementation.

## Goals / Non-Goals

**Goals:** A genuine funded-contract demonstration; zero-fee 1,000-sat reward when supported; reliable recipient/session binding and recovery; unobtrusive gameplay; generic BIS APIs with game-owned treasure semantics. Include BIS and Stealth & Steel delivery and browser verification.

**Non-Goals:** Mainnet, adversarial gameplay security (deferred X8), a universal Arkade contract explorer, non-LTO contract implementations, contract supply burning, and guaranteed real-time financial finality. A hosted wallet service and recovery while that service runs are now in scope.

## Decisions

### 1. Runtime readiness replaces the hardcoded acceptance switch

The user explicitly requested removal of the live-acceptance blocker on 2026-09-09. The public factory enables creation by default. Acceptance records do not act as a runtime switch. A host can set `creationEnabled:false` to stop new offers without disabling queries, existing claims/refunds or reconciliation.

Each operation validates the service's game identity and the authenticated browser player identity, Signet/operator compatibility, zero fees, eligible unreserved inputs with every asset retained in game-owned change, minimum output/change requirements, session identity and the immutable deadline. Unknown submissions retain recovery and exclusivity. Unsupported conditions reject the operation truthfully; no ordinary-send fallback or synthetic confirmation is added. Both the service and browser enforce 90-second initial claim eligibility; it is not an on-chain upper-bound timelock.

Acceptance uses automated public-factory, SDK-adapter, encrypted-storage, lifecycle, browser and game tests. The initial user-run Signet probe supplies historical funding/claim/refund and latency evidence. Additional funded race and full-game live scenarios remain unverified observations in verification.md, not prerequisites that permanently disable the demo. No agent-run funded probe or human-click handoff is required to build and accept this revision.

### 2. Separate agreements from their transactions and from game semantics

BIS exposes Contracts beside Assets and Transactions. Transactions are funding/claim/refund evidence; a contract is the persistent agreement linking them. `limited-time-offer` is a generic BIS type. `treasure-lto` is a game-owned purpose/reference, not a BIS class or special-case predicate.

Proposed additive surface, final typing to follow implementation conventions:

```ts
context.checkContracts() // read/reconcile snapshots; never signs, funds or cancels
offers.create({ operationId, recipientId, amountSats, expiresAt, reference, exclusivityKey })
offers.claim(contractId)
offers.end(contractId, reason)
offers.reconcile()
offers.cleanupExpired()
```

Construct the offers service through the existing public BIS integration with a configured game-wallet controller; the host sees IDs, states, typed errors and events, never mnemonics or Arkade objects. `checkContracts` reports account-relevant known records and explicit freshness/unavailability. Unknown data is never an empty result. It must not cause cancellation merely by opening Contracts or touching a chest. Cleanup is a separate idempotent operation, authorized by the session policy. The game filters exact saved contract ID and purpose/session reference, ignoring unrelated contracts. It never culls other contract types by guessing their expiration semantics.

### 3. Import once in Admin; keep the game signer on the service

BIS Admin imports to a private persistent wallet service. Both local and deployed games use the same HTTP protocol and configured service; the Admin tab need not remain open. The game gets a public wallet snapshot and supported operation APIs, never the game phrase. Player claim signing remains in the player's BIS browser boundary. Remove the game import UI on delivery. A missing/unreachable service skips offers without blocking play or requesting a phrase.

Keep service state on a private persistent volume, encrypted at rest, outside static files and builds. Persist wallet selections, contract recovery and all game input reservations; serialize game mutations across clients and enforce a single writer. Admin mutations require a protected administrative channel. Public player actions prove the player identity and bind operation IDs and deadlines. Do not expose an unrestricted signing endpoint. X8 owns broader abuse prevention and operational security review, not permission to publish the game key.

Reuse the existing contract model and verified Arkade adapter. The service creates funding/refund signatures; a narrowly scoped claim-signing exchange obtains only the player's signatures over the constructed claim transaction. Validate signed transaction contents against the original before continuing. Keep client queries read-only and server journals authoritative across origins. Do not silently migrate old browser contracts: retain their original recovery path and require unresolved old game operations to be reconciled before selecting the same wallet on the service.

### 4. Session policy is immediate gameplay, bounded financial work

At Start, synchronously record a fresh session ID, start time and deadline = start + 90,000 ms; start the game without waiting for BIS. Preparation is visible via toast only when a real attempt begins. Initial readiness/cleanup evaluation may run asynchronously under a bounded deadline, but never resets the gameplay deadline.

On return to the menu/end of attempt, mark the old attempt ended immediately and request its supported cancellation/refund. The menu also silently reconciles and cleans up eligible expired contracts. At the next Start, an old unresolved treasure offer blocks only the new offer: attempt cleanup, classify the session as skipped if unresolved, and never enqueue replacement creation later in that session. The game never waits for a refund or funding to enable Start. A clean start can proceed after already completed cleanup.

Use a durable exclusivity key covering game identity, player identity, network/operator and the host's treasure purpose, across sessions and cooperating tabs. Reserve the slot before funding; a funding timeout occupies it until reconciled. Session end during funding sets endRequested; if funding later succeeds, refund that original contract rather than creating a replacement or announcing an available treasure. Persist rejection/end requests before network work.

Proposed session mapping: Start begins an attempt; return to start menu, logout/restart and terminal end of the run end it. Pause, account inspection, pay-to-continue within the run and progression without returning to Start do not reset its deadline. Reload does not grant a fresh timer automatically; recover old financial records, and a later explicit Start follows the same exclusivity checks.

### 5. Financial state and gameplay eligibility are separate

Durable financial states: funding, funded, claim-pending, refund-pending, claimed, refunded, not-funded and needs-attention/unknown. `expired` and `session-ended` describe eligibility, not proof of spend. Store immutable amount/recipient/reference/deadline, funding outpoint, operation IDs, proof needed for supported spends, submission IDs, end reason and last verified evidence. Encrypt signing/claim recovery material; expose only sanitized snapshots. Preserve terminal records for correlation/deduplication even when omitted from the active Contracts list.

Use existing wallet mutation/reservation mechanisms and an additional contract-outpoint lock so funding cannot consume other reserved or asset-bearing inputs unintentionally, and claim and refund do not concurrently spend one output. Claim checks expiry at click and revalidates before submission. There is no gameplay grace-period promise: late validation can fail as too late. Once submission might have occurred, reconcile its actual spend before retry/refund; a timeout is not a definite failure. If claim succeeds after the deadline, show success; never refund or report too late just because the acknowledgement was slow. Cancel/fill races are resolved from actual transaction/output evidence.

Browser timers are hints: recompute eligibility from the persisted deadline on query, click and visibility return. Do not pause the deadline with the game or assume a suspended tab executes cleanup. The hosted service runs eligible cleanup independently of browser lifetime and resumes durable recovery after service restart. A changed fee schedule prevents new zero-fee offers; unresolved contracts remain visible and require an explicit supported recovery decision rather than silent additional spending.

### 6. Game-owned chest dialogue, BIS-owned financial feedback

The chest spawns at its Tiled-authored position independently of backend state and remains inspectable before/during/after expiry. Later user direction supersedes earlier remove-on-Reject wording: after resolution it may use opened artwork but retains inspection collision. Avoid repeated prompts while overlapping by requiring exit/re-entry after Back or submission. Debounce collision while a prompt is open.

The game owns a DOM dialogue with title `Treasure Chest`, keyboard/touch focus, input isolation and its own pause reason. On collision open the shell and read contracts. States:

| State | Body | Actions |
| --- | --- | --- |
| Claimable matching offer | You found a treasure of 1000 sats | Claim, Reject |
| Known funding/preparation | Treasure is being prepared | disabled Claim/Reject, Back |
| Expired matching attempt | You found a treasure but it's expired | disabled Claim/Reject, Back |
| Player missing at Start | Connect an account to receive treasure offers | Back |
| Skipped or no offer | No treasure offer available (proposed copy) | disabled Claim/Reject, Back |
| Read unavailable | Treasure status is unavailable (proposed copy) | disabled Claim/Reject, Back; reopen to retry |
| Claim/refund pending | Treasure claim/refund is pending (proposed copy) | disabled Claim/Reject, Back |
| Resolved | Reward claimed / Offer ended (proposed copy) | Back |

An open prompt updates on funding/expiry/operation changes. It ignores nonmatching offers. Query failure does not falsely label an offer expired or missing. A lightweight remaining-time label beside enabled Claim helps users understand the deadline; it shows no technical diagnostic data. All body copies not quoted by the user remain reviewable defaults.

When Claim or Reject is accepted for processing, BIS queues an appropriate pending toast; the game closes its own prompt, restores focus/input and resumes only its own pause reason. Confirmed/error results arrive as non-blocking BIS toasts; no completion modal and no pause. Synchronous invalid/expired requests do not emit false pending or success. Reopening the chest can inspect a pending result without resubmitting. Funding, claims and refunds use distinct operation-correlated messages and deduplication. A funding success after expiry/session end says funds are being returned rather than inviting a claim. "Confirmed" here means verified Arkade operation/receipt evidence, not Bitcoin L1 finality.

### 7. Contracts UX is the inspection surface

Account Details -> Contracts -> Contract Details follows Assets conventions, supports keyboard and narrow screens, and shows unresolved funded/unknown records. Include type, amount, role, state, expiry, evidence freshness, IDs and related transaction links/copy; do not expose secrets. An expired pending refund stays visible. Genuine empty state is `No active contracts`. Query loading/error follows existing wallet-page conventions; those blocking page-read rules do not govern automatic game contract operations, which use toasts.

Recommended first delivery is an inspector with role-eligible Claim and Reject/end operations for the player and Refund for the game identity using the same controller as the game. No bypass button and no Burn action. A developer can use the BIS demo host to simulate a game event; no start-menu debug UI. Directly claiming through Contracts is acceptable for this demo and is not a chest anti-cheat guarantee. Early cancellation UI is enabled only for the proved spending path.

### 8. Durable recovery and existing logout semantics

Keep game-owned contract/cancellation journals separate from disposable player-view data so player logout cannot orphan the game refund. Include player-side unresolved recovery in the existing pending-loss acknowledgement inventory; preserve the account-logout exception permitting acknowledged local cleanup. Never reinterpret logout as network cancellation. Preserve the game-owned record/slot when the player later reconnects. Admin Reset remains guarded; game-wallet switching isolates old records and does not declare them refunded. No destructive schema change or journal deletion is needed: append/update states and filter resolved entries.

## Risks / Trade-offs

- [Operator terms or cancellation support may change] -> Validate current provider terms and reconcile uncertain outcomes; keep the existing offer occupied until its actual resolution is verified.
- [One player repeatedly starts sessions] -> Reuse session operation IDs, enforce one unresolved slot and serialize funding. This is demo lifecycle control, not adversarial rate limiting.
- [Network delay consumes most of 90 seconds] -> Preserve the requested Start-time clock, show preparation truthfully, and refund any late-funded offer; measure latency in acceptance.
- [Shared service availability] -> Ordinary gameplay stays available; report unavailable contract state and resume durable recovery when the service returns.
- [Different origins and simultaneous players] -> Share the service's authoritative journal and reservations, not independent browser game signers. Keep the player's key local.
- [Game package remains stale] -> Rebuild/package BIS, update the game's vendor dependency and inventory through existing tooling, then verify the loaded browser package.

## Migration Plan

1. Run automated acceptance of the default public factory and explicit rollback. Preserve additive APIs, versioned storage and unknown records.
2. Integrate BIS demo and validate production services through the public interface.
3. Package BIS with existing release conventions and update Stealth & Steel's local dependency. Add game-owned session/controller/dialogue and Tiled chest spawner through established authoring paths; reuse suitable existing artwork, with selected asset/position documented during implementation.
4. Replace game-origin provisioning with the hosted wallet controller and remove the game import UI. Verify local and deployed endpoint configuration, protected Admin import, service restart and two independent browser clients. Keep ordinary gameplay available throughout; retain the prior browser recovery path for historical contracts.
5. Rollback disables new creation but keeps contract query, reconciliation and refund capability until all outstanding contracts resolve. Do not roll back to code that forgets funded contracts.

## Open Questions

- Question 15's exact no-offer wording was not answered; use the explicitly marked default for review, not as a confirmed interview answer.
- Final visual chest artwork and authored cell, pending/failure copy and API naming can be chosen against existing conventions without changing lifecycle requirements.
- Historical live timings and script outcomes are recorded separately from automated acceptance. Do not present unobserved live outcomes as verified.
## Additional confirmed UI decisions during implementation

Assets, Contracts and Transactions use shared React components named Item List and Item List Detail across all six pages. Their order is title, body, copyable field, scroll area containing reusable scroll items, and Back. Each feature supplies its data, detail content and eligible actions. Item List reserves a consistent 276px scroll area, including when empty: three and a half 72px items with three 8px gaps. Account Details shows a single horizontal row of equal-width buttons ordered Assets, Contracts, Transaction; constrained labels use ellipsis.

## G2 Admin controls confirmed during apply

Replace the additional BIS treasure gameplay preview with always-clickable Start LTO and Claim LTO subbuttons under G2. LTO Treasure Chest. Show Time left beginning at 90 seconds; each Start establishes a fresh wall-clock deadline. Report action results and asynchronous status changes in the existing console. Controls use the host session controller and public BIS operations without bypassing readiness, expiry, pending operations, prior unresolved offers or explicit host disable. Keep the actual Stealth collision and dialogue separate.

G2 uses the same StoryButton row component as F3: title, time-left sublabel, and Start LTO / Claim LTO subbuttons on one horizontal row. Both clicks immediately append console feedback, followed by their result and subsequent status transitions.

## Asset-carrier funding correction — 2026-09-09

A public read of the configured game address showed that all available sats shared one output with six assets. Excluding asset-bearing outputs made a funded wallet unable to create an offer. Funding now prefers asset-free coins, then permits asset carriers only with at least the minimum game change. It attaches the same SDK asset packet validated by ordinary sends. The contract output stays asset-free; all input assets return to output 1 at the game script. The exact asset manifest is encrypted with the spend journal and receipt reconciliation verifies both consumed source assets and game-change quantities. Missing, diverted or reduced asset receipts cannot confirm funding. Quantities retain bigint/string precision. Unknown submissions still reserve their inputs.
