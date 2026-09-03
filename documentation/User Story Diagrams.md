# User Story Diagrams

## Table of contents

- [A. Account](#a-account)
  - [A1. Open Account](#a1-open-the-game-then-account) ✅
  - [A2. Create Account](#a2-create-a-new-disposable-test-account)
  - [A3. Restore Account](#a3-restore-an-account-from-this-experience)
  - [A4. Account Menu](#a4-open-account-with-an-active-profile)
  - [A5. View Activity](#a5-inspect-activity)
  - [A6. Log Out](#a6-log-out-and-return-to-ordinary-gameplay)
- [B. Pay-to-play](#b-pay-to-play)
  - [B1. Death Choices](#b1-die-and-choose-restart-or-paid-continuation)
  - [B2. Pay to Continue](#b2-review-the-price-and-pay-to-continue)
  - [B3. Payment Problems](#b3-handle-insufficient-funds-or-a-failed-payment)
  - [B4. Pending Payments](#b4-leave-a-slow-payment-without-losing-track-of-it)
- [C. Achievements](#c-achievements)
  - [C1. Earn Achievements](#c1-earn-an-achievement-opportunity)
  - [C2. Claim Achievement](#c2-claim-the-achievement)
  - [C3. Retry Claims](#c3-handle-an-interrupted-or-repeated-claim)
  - [C4. View Achievements](#c4-view-owned-achievements)
  - [C5. Victory Reward](#c5-receive-a-victory-reward)

## Current implementation

| Story | Admin UI demonstration | Status |
| --- | --- | --- |
| A1. Open Account ✅ | Account / Account Button | Complete: no-profile Account button, Account dialogue, and Back. Active-profile opening belongs to A4. |
| A2. Create Account | Account / Create Account | Implemented; creation and reload/browser-restart persistence verified. Manual real-storage reset verification pending. |
| A3-A6 | Not listed | Planned; no restoration, full account menu, activity, or functional logout yet. |
| B1-B4, C1-C5 | Not listed | Planned; their categories are hidden. |

The demo starts empty, including after refresh. Account Button renders the production entry button; Create Account opens the production dialogue directly. Logged-out Account offers enabled Create Account, disabled Restore Account, and Back. Completed accounts are remembered across browser restarts. Logged-in Account shows "You are now logged in.", disabled Log Out, and Back. Reset Client clears BIS-owned account storage and transient state; its real stored-data verification remains manual.

Stories are sized to be completed independently. A1 covers entry; A2 owns creation and the minimal active dialogue, A3 restoration, and A4 the full account menu. Each feature updates its diagram and Admin UI demonstration together. Build one small story, try it together, and refine it through hands-on feedback.

## Reading these diagrams

Based on [the original brief](BGS_PROJECT_BRIEF.md), especially sections 4, 5, 7, 8, and 14, and [confirmed design decisions](design-discussion.md).

These are intended user journeys for discussion, not implemented features or verified SDK capabilities. The current demo implements account entry and A2 creation/persistence; real stored-data reset verification is pending. Other wallet flows remain planned. API names and events below come from the brief's proposed contract; additional behavior is marked as proposed or unresolved.

Diagram key: `Game` = the separate Babylon.js game; `UI`, `Core`, and `Arkade` = internal layers of `packages/integration`. UI uses React + TypeScript; Core owns workflows/state/events; Arkade wraps `@arkade-os/sdk` and public Signet infrastructure. The demo app substitutes for the game host, using the same public integration surface.

Diagrams use plain ASCII and omit the lightning icon; actual player-facing account/action buttons retain the brief's lightning prefix. Developer technology labels are not button text. All wallet activity is Signet-only, with no project-operated application server.

Step references use the story ID and a step number, such as `[A2.09]`. Each labeled action, state, or branch can be referenced independently; connector lines and explanatory annotations are not numbered. Keep existing IDs when revising a diagram; assign new steps the next unused number.

## A. Account

Create or restore a test identity, inspect its state, and leave the connected session. An account is optional; ordinary gameplay is always available.

### A1. Open the game, then Account

Status: complete. Precondition: no active profile. The host decides where to place the BIS Account button; the demo provides a centered container.

```text
[A1.01] Host mounts BIS UI (initially empty)
  |
[A1.02] Host requests Account button presentation
  |  Demo: Admin > Account > Account Button
  v
[A1.03] Player clicks Account
  |
  v
[A1.04] BIS: context.openAccountDialog()
  |
  v
[A1.05] Account dialogue
  Title: Account
  State: You are not logged in.
  |
  +--> [A1.06] Create Account  [enabled; A2]
  +--> [A1.07] Restore Account [disabled; A3]
  +--> [A1.08] Back --> Account button, profile unchanged
```

- Create Account is enabled and primary; Restore Account is disabled and secondary; Back is enabled and secondary. All three action buttons have equal width and padding. Only Create/Restore carry lightning icons. Disabled actions have the prohibited cursor and perform no operation.
- No decorative title icon, coming-soon explanation, Escape handling, backdrop dismissal, wallet initialization, or network operation is part of A1.
- The production context owns state. The mounted production UI renders the dialogue and restores focus to Account after Back. The game owns its own menus and gameplay policy.
- Admin observes public state and disables the story action while the dialogue is open. Reset Client clears selection, runtime state, and BIS-owned saved account material, returning to the Game Viewport placeholder. Preview scaling preserves the active flow.
- Opening Account with an active profile now uses A2's minimal dialogue; the full menu remains A4. Creating and restoring profiles are A2 and A3.

### A2. Create a new disposable test account

Status: implemented, with manual real-storage Reset Client verification pending. Confirmed scope is captured in [add-a2-account-creation](../.openspec/changes/archive/2026-09-03-add-a2-account-creation/proposal.md); the change task list records outstanding verification. Game and Runtime Preview share production persistence behavior. Story IDs identify scope, not development order.

```text
[A2.11] Host opens the production Account dialogue
  |
  +--> [A2.12] Saved active account --> minimal logged-in Account dialogue (A2.14)
  |
  +--> [A2.13] No saved account --> Account: You are not logged in.
  |      Create Account / disabled Restore Account / Back
  v
[A2.01] Player: Create Account
  |
  v
[A2.02] UI: test-only explanation + lightning loader
  |
  v
[A2.03] Core: start account-creation workflow
  |
  v
[A2.04] Arkade: create real in-browser Signet wallet via SDK
  |
  +--> [A2.05] Failure --> UI: explain / retry / return to game
  |
  v
[A2.06] UI: immediately show recovery phrase + test-only warning
  |
  +--> [A2.21] Copy to Clipboard --> all 12 words, single-space-separated text
  |      Success feedback, or retry/manual copy on failure
  |
  +--> [A2.07] Player saves phrase privately outside the app
  |
  +--> [A2.08] Player skips saving for a disposable session
  |
  v
[A2.09] Player: Continue
  |
  v
[A2.10] Save account, activate profile --> accountConnected --> Game
  |
  v
[A2.14] Account dialogue
  Title: Account
  State: You are now logged in.
  |
  +--> [A2.15] Log Out [disabled; A6]
  +--> [A2.16] Back --> preceding host presentation

[A2.17] Refresh/close before Continue commits --> next entry starts at A2.13
[A2.18] Refresh/reopen after commit --> retain account; next entry uses A2.12
[A2.19] Admin Reset Client --> clear saved/transient account and selection
  |
  v
[A2.20] Empty Game Viewport; next A2 entry starts at A2.13
```

- Copy to Clipboard appears above Continue and copies only on an explicit click. Future A3 Paste from Clipboard should consume the same plain, space-separated phrase; restoration is not implemented here.
- Game receives account state, not recovery material or Arkade-specific types. Creating an account does not itself mean the wallet is funded or a payment succeeded.
- Service: UI explains and displays recovery; Core orchestrates activation; Arkade owns SDK identity/wallet setup and any required connectivity. SDK 0.4.67 creation has been verified against the live Signet operator with explicit transient repositories.
- Confirmed: persist the completed account on this browser across refreshes and restarts until Log Out (future A6), Admin Reset Client, or loss of browser data. Do not resume an unfinished creation after reopening. The admin selection resets on refresh; the viewport stays empty until a story is selected.
- Confirmed: the minimal logged-in dialogue hides Create/Restore and shows disabled Log Out plus working Back. A4 owns the full account menu; A6 owns functional logout. Admin Reset Client is the first-run reset available in this slice, replacing the previous preserve-persisted-data behavior when A2 is implemented.
- Implemented default: Continue is immediately available without a mandatory backup checkbox or phrase verification, consistent with optional external saving. The linked design records the implemented storage protection, SDK evidence, and failure behavior.
- Security: warn never to enter or reuse a real-funds recovery phrase. Keep recovery material out of game callbacks, logs, analytics, demo event history, and verification captures. Account creation does not imply funding or network availability.

### A3. Restore an account from this experience

```text
[A3.01] Player: Restore Account
  |
  v
[A3.02] UI: test-only warning + private recovery-phrase input
  |
  v
[A3.03] Core --> Arkade: validate and restore via SDK
                   |
                   +--> [A3.04] Invalid input --> UI: correction
                   |
                   v
             [A3.05] Reconnect to Signet infrastructure
                   |
                   +--> [A3.06] Unavailable --> UI: retry / close
                   |
                   v
             [A3.07] Reload wallet state + achievement assets
                   |
                   v
[A3.08] Core: same profile active --> accountConnected --> Game
                   |
                   v
[A3.09] UI: account menu
```

- Game only learns that the account is connected. This restores wallet identity and available assets, not game checkpoints or saved gameplay progress.
- Service: React UI collects the phrase privately in the app; Core coordinates loading/errors; Arkade reconstructs the compatible identity and queries available state. Use the lightning loader while restoring/reconnecting.
- Boundary: support BGS/Arkade-compatible test profiles created for this experience, not arbitrary wallet seeds. Partial restore behavior, unavailable asset queries, and recovery compatibility need verification.

### A4. Open Account with an active profile

Status: planned. This story owns opening Account when a real active profile exists, including profile-state routing and the account menu. It is separate from the completed no-profile A1 flow. Planned A2 includes only the minimal logged-in Account dialogue (status, disabled Log Out, Back); this story owns the full menu.

```text
[A4.01] Player: Gear --> Account
                   |
                   v
[A4.02] Game --> Core: openAccountDialog()
                   |
                   v
[A4.03] UI: account menu
  |
  +--> [A4.04] Profile / connection status
  +--> [A4.05] Wallet details / balance when available
  +--> [A4.06] View Achievements ------------------> C4
  +--> [A4.07] Activity ---------------------------> A5
  +--> [A4.08] Log Out ----------------------------> A6
  +--> [A4.09] Close ------------------------------> Game

[A4.10] Core --> Arkade SDK --> available wallet state --> UI
```

- Game delegates account presentation to the service; it does not need its own wallet UI or SDK dependency.
- Service: UI presents the menu; Core distinguishes active identity from operation availability; Arkade supplies wallet details/balance. Unknown or failed balances must not be presented as zero.
- Complexity: refresh timing and offline/stale-state presentation need design. The confirmed A2 plan remembers completed accounts across browser restarts; full menu data loading and refresh remain A4 work.

### A5. Inspect Activity

Optional educational view.

```text
[A5.01] Player: Account --> Activity
                       |
                       v
[A5.02] UI --> Core: request available activity
           |
           +--> [A5.03] Service workflow records
           |
           +--> [A5.04] Arkade: SDK history/status, if supported
                       |
                       v
[A5.05] UI: available entries + outcome/status
    Educational classification where known:
    No-chain / on-chain / off-Chain
                       |
                       v
                  [A5.06] Back to Account
```

- Game provides gameplay context only where needed; the service owns wallet-operation status and educational presentation. No fake transaction outcomes.
- Proposed approach: combine service workflow records with SDK-supported data. The brief does not settle storage, history APIs, or whether history survives a refresh/restore; do not promise complete cross-device history.
- Keep this optional. An off-Chain success is not immediate Bitcoin L1 settlement, and local workflow records are not proof of payment. Technology explanations belong here, not in ordinary action labels.

### A6. Log out and return to ordinary gameplay

```text
[A6.01] Player: Account --> Log Out
                       |
                       v
[A6.02] Core: check active operations
           |
           +--> [A6.03] Pending --> UI: explain unresolved work
           |               [logout policy still to decide]
           |
           +--> [A6.04] Safe to log out
                       |
                       v
            [A6.05] End active service session
            [A6.06] Arkade: release session resources as needed
                       |
                       v
[A6.07] Core: no active profile --> notify Game
                       |
                       v
[A6.08] UI: Create Account / Restore Account
[A6.09] Game: ordinary gameplay remains available
```

- Game responds to service availability; account logout must not make normal gameplay unusable. The exact disconnect event/API contract is still undecided.
- Service: Core owns session transition and pending-work policy; UI explains consequences; Arkade handles SDK-specific lifecycle cleanup. Logout is not an on-chain transaction and does not erase wallet assets.
- Complexity: implement clearing remembered account material on logout, warn about losing access to an unsaved disposable profile, and define mid-run behavior. The brief ties feature eligibility to a connected run; connecting or switching accounts mid-run must not silently override that rule.

## B. Pay-to-play

An optional way to pay currency to make up for a lack of skill. The concrete v1 mechanic is paying test sats to continue from a checkpoint after dying, not paying an entry fee to play the game. Restarting normally remains free.

### B1. Die and choose restart or paid continuation

```text
[B1.01] Player dies
  |
  v
[B1.02] Game: death screen + checkpoint context
  |
  +--> [B1.03] Restart Game --> ordinary No-chain restart
  |
  +--> [B1.04] Continue
         |
         v
       [B1.05] Game checks service availability + run eligibility
         |
         +--> [B1.06] Unavailable --> disabled + explanation
         |                    |
         |                    v
         |              [B1.07] Restart; connect for a future run
         |
         +--> [B1.08] Available --> requestContinue(checkpointId, priceSats)
                              |
                              v
                         [B1.09] Core --> UI: payment overlay (B2)
```

- Game owns death, checkpoints, the test-sat price, and the free restart path. It requests a continuation through the public API rather than initiating an SDK payment itself.
- Service: Core checks account/operation availability and coordinates the React payment overlay. No payment occurs merely because the player died or opened the overlay.
- Complexity: account presence alone is not proof of connectivity or run eligibility. The brief's explanation points disconnected players toward a future connected run; the exact run/account switching rules remain unresolved.

### B2. Review the price and pay to continue

```text
[B2.01] UI: show checkpoint + price in test sats
  |
  +--> [B2.02] Player backs out --> Game: death screen, no payment
  |
  +--> [B2.03] Player confirms payment
         |
         v
       [B2.04] Core: begin continuation workflow
         |
         v
       [B2.05] Arkade SDK / Signet infrastructure
       [B2.06] Prepare --> Pay --> Confirm
         |          [UI: lightning loader]
         |
         +--> [B2.07] Failure / pending --> B3 / B4
         |
         v
       [B2.08] SDK reports successful completion
         |
         v
       [B2.09] Core: continuePurchased(checkpointId, sats)
         |
         v
       [B2.10] Game: resume matching checkpoint
```

- Game revives the player only after actual success, never after clicking Pay or submitting a transaction. The confirmation step is a proposed explicit authorization within the brief's payment overlay.
- Service: UI owns price/context and progress; Core owns orchestration and the success event; Arkade owns the real Signet BTC Lightning workflow. Whether a step is off-Chain or on-chain depends on the actual operation, not its button label.
- Complexity: payment recipient, request creation, fees, and current Arkade Intents/solver availability need validation. Run/operation identifiers must prevent double charges and stale events; the brief's minimal example API does not yet define those fields.

### B3. Handle insufficient funds or a failed payment

```text
[B3.01] Player attempts to pay
  |
  v
[B3.02] Core --> Arkade: check/execute payment workflow
                   |
                   +--> [B3.03] Insufficient funds
                   |      |
                   |      v
                   |    [B3.04] UI: explain test-sat shortfall
                   |
                   +--> [B3.05] Confirmed failure
                   |      |
                   |      v
                   |    [B3.06] UI: explain failure
                   |
                   +--> [B3.07] Outcome unknown --> B4: reconcile first

[B3.08] UI: known failure / shortfall
  |
  +--> [B3.09] Back --> Game: Restart Game remains available
  |
  +--> [B3.10] Retry when resolved --> Core: safe new attempt
```

- Game stays on the death/restart path; insufficient funds and failed operations never grant continuation. A failed network response must not be treated as proof that no payment happened.
- Service: Arkade supplies the operation outcome; Core distinguishes failure from uncertainty and reports failure through the proposed `operationFailed` contract; UI gives a useful explanation instead of leaving the loader running forever.
- Complexity: how a new wallet obtains test sats is not specified yet. Do not invent an automatic faucet or pretend retry funds the wallet; resolve funding and safe-retry rules before implementation.

### B4. Leave a slow payment without losing track of it

```text
[B4.01] Payment still pending
  |
  +--> [B4.02] Around 10 seconds --> UI: still processing
  |
  +--> [B4.03] Longer threshold (example: 30-60 seconds)
         |
         v
       [B4.04] UI: allow return to Restart
         |
         +--> [B4.05] Player keeps waiting
         |
         +--> [B4.06] Player restarts --> Game: new run
                                  |
                                  v
       [B4.07] Core + Arkade: continue resolving original operation
         |
         +--> [B4.08] Success, original context valid --> continue event
         +--> [B4.09] Late success, context obsolete --> record / explain
         +--> [B4.10] Failure / recovery needed --> status / recovery UI
```

- Game can restart without waiting indefinitely. Proposed safeguard: success for an abandoned run must not revive the new run or move it to an old checkpoint.
- Service: UI shows the lightning loader and slower-processing copy; Core tracks the pending operation independently of overlay visibility; Arkade checks completion and performs supported wallet recovery. Closing UI is not transaction cancellation.
- Complexity: durable pending state, reload recovery, and what to do about payment succeeding after restart are unresolved. Do not promise an automatic refund; compensation/recovery depends on the payment design and verified SDK support.

## C. Achievements

Turn game accomplishments into player-owned achievement assets. Normal game progress does not depend on claiming them. The initial candidates are First Extraction, Ghost Run, Second Chance, and Final Extraction; a test-sat victory reward is a separate stretch goal.

### C1. Earn an achievement opportunity

```text
[C1.01] Game observes an accomplishment
  |
  +--> [C1.02] Level 1 complete ------------> First Extraction
  +--> [C1.03] Level complete, undetected --> Ghost Run
  +--> [C1.04] Paid continuation succeeded -> Second Chance
  +--> [C1.05] Game complete ---------------> Final Extraction
  |
  v
[C1.06] Game: present achievement opportunity + normal next actions
  |
  +--> [C1.07] No eligible account --> Claim disabled + explanation
  |
  +--> [C1.08] Eligible account --> Player may Claim Achievement (C2)
  |
  +--> [C1.09] Player skips --> ordinary gameplay continues
```

- Game owns accomplishment detection and supplies the achievement ID/name. Second Chance follows confirmed paid continuation, not merely an attempted payment; exactly where its claim prompt appears is still to decide.
- Service: Core exposes availability; UI explains unavailable claims and hosts the claim workflow when requested. Detecting a game accomplishment alone does not issue an asset or invoke the Arkade SDK.
- Boundary: the browser game is not cheat-resistant. A completed level can remain ordinary No-chain gameplay until a wallet operation is requested; do not describe client-reported achievements as securely verified economic rewards.

### C2. Claim the achievement

```text
[C2.01] Player: Claim Achievement
  |
  v
[C2.02] Game: requestAchievement(id, name)
  |
  v
[C2.03] Core: check active profile + claim state
  |
  v
[C2.04] UI: claim progress + lightning loader
  |
  v
[C2.05] Arkade SDK: issue or transfer intended achievement asset
  |
  +--> [C2.06] Failed / uncertain --> C3
  |
  v
[C2.07] SDK reports successful completion
  |
  v
[C2.08] Core: achievementClaimed(achievementId) --> Game
  |
  v
[C2.09] UI: success --> View Achievements (C4) / return to game
```

- Game requests the claim and responds to confirmed success; showing a results screen does not mean the wallet already owns the achievement.
- Service: React UI presents progress; Core coordinates the claim and completion event; Arkade performs the intended Arkade Assets issue/transfer operation. Wallet-owned state replaces the need for a custom application achievements database.
- Complexity: who issues assets, who funds issuance/transfers, and how legitimate achievement assets are identified remain open. No issuer secret may be embedded in the public client; the no-custom-server design must be validated before claiming this flow is feasible.

### C3. Handle an interrupted or repeated claim

```text
[C3.01] Player retries a claim / repeats the same accomplishment
  |
  v
[C3.02] Core: inspect prior claim state
  |
  +--> [C3.03] Pending / uncertain --> Arkade: reconcile outcome first
  |                              |
  |                              v
  |                         [C3.04] UI: status / retry later
  |
  +--> [C3.05] Already owned --> UI: show existing achievement
  |                      [proposed single-award policy]
  |
  +--> [C3.06] Confirmed failure, not awarded --> offer safe retry (C2)
  |
  +--> [C3.07] Cannot determine --> UI: explain / return to game
```

- Game remains playable while claim state resolves; another click or repeated level completion must not be assumed to authorize a duplicate issuance.
- Proposed service behavior: Core reconciles workflow records with Arkade wallet/operation state before retrying; UI distinguishes pending, failed, and already owned. A local success flag alone does not prove wallet ownership.
- Complexity: decide whether achievements are awarded once per profile or can be earned repeatedly, and how that rule survives restoration. Transfers, asset identity, and unavailable history complicate duplicate detection; the diagram's single-award branch is a proposal, not an approved rule.

### C4. View owned achievements

```text
[C4.01] Player: Account --> View Achievements
  |
  v
[C4.02] UI: lightning loader
  |
  v
[C4.03] Core --> Arkade SDK: query active wallet's assets
  |
  +--> [C4.04] Recognized achievements
  |      |
  |      v
  |    [C4.05] UI: list
  |      |
  |      +--> [C4.06] Back --> Account menu
  |
  +--> [C4.07] None owned
  |      |
  |      v
  |    [C4.08] UI: empty collection
  |
  +--> [C4.09] Query failed
         |
         v
       [C4.10] UI: retry / back to Account
```

- Game does not issue a new achievement just because this screen opens. This is a read/list journey, separate from the claim flow, and is also available after restoring a compatible account.
- Service: Arkade retrieves owned assets; Core interprets which represent this game's achievements; React UI presents them. The intended technology is Arkade Assets, not a custom achievements database.
- Complexity: asset identity, metadata, issuer recognition, and current SDK/Signet query support remain open. Do not promise that every asset in a wallet is a game achievement or mistake a failed query for an empty collection.

### C5. Receive a victory reward

Optional stretch goal; a test-sat payout, distinct from the Final Extraction achievement asset.

```text
[C5.01] Player completes the game
  |
  v
[C5.02] Game: show victory + check reward availability
  |
  +--> [C5.03] Reward absent / unavailable --> normal victory
  |
  +--> [C5.04] Reward enabled + eligible account
         |
         v
       [C5.05] Core: request reward workflow [contract to define]
         |
         v
       [C5.06] UI: receiving reward + lightning loader
         |
         v
       [C5.07] Arkade SDK / external funded source: receive test sats
         |
         +--> [C5.08] Failed / pending --> UI: status; victory preserved
         |
         v
       [C5.09] Confirm receipt --> UI: reward received + updated balance
```

- Game owns the win condition and keeps the victory valid regardless of payout. Receiving currency is separate from owning the Final Extraction achievement; neither implies the other succeeded.
- Service: UI presents receive status; Core orchestrates eligibility/status and a still-undefined game callback; Arkade handles the real Signet receive workflow and balance refresh. Never display a fabricated reward transaction.
- Complexity: identify a funded sender, payout authorization, replay limits, and supported receive infrastructure without exposing credentials or adding a custom server. This remains a non-cheat-resistant proof of concept and follows the core account/payment/achievement flows.






