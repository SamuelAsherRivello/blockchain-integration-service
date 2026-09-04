# User Story Diagrams

## Table of contents

- [A. Account](#a-account)
  - [A1. Open Account](#a1-open-the-game-then-account) ✓
  - [A2. Create Account](#a2-create-a-new-disposable-test-account)
  - [A3. Restore Account](#a3-restore-an-account-from-this-experience) ✓
  - [A4. Account Balance](#a4-open-account-with-an-active-profile)
  - [A5. View Activity](#a5-inspect-activity)
  - [A6. Log Out](#a6-log-out-and-return-to-ordinary-gameplay)
- [B. Pay-to-play](#b-pay-to-play)
  - [B1. Death Choices](#b1-die-and-choose-restart-or-paid-continuation)
  - [B2. Pay to Continue](#b2-review-the-price-and-pay-to-continue)
  - [B3. Payment Problems](#b3-handle-insufficient-funds-or-a-failed-payment)
  - [B4. Pending Payments](#b4-leave-a-slow-payment-without-losing-track-of-it)
- [C. Assets](#c-assets)
  - [C1. Mint Asset](#c1-mint-asset)
  - [C2. Claim Asset](#c2-claim-the-asset)
  - [C3. Retry Asset Claims](#c3-handle-an-interrupted-or-repeated-asset-claim)
  - [C4. List Assets](#c4-list-assets)
  - [C5. Victory Reward](#c5-receive-a-victory-reward)
- [D. Proposed features](#d-proposed-features)
  - [D1. Game-controlled wallet or issuer](#d1-game-controlled-wallet-or-issuer)
  - [D2. Lightning invoice receiving](#d2-lightning-invoice-receiving)
    - [D2a. Receive funds using addresses — complete](#d2a-receive-funds-using-addresses)
    - [D2b. Receive funds using Lightning invoices — blocked](#d2b-receive-funds-using-lightning-invoices)
  - [D3. Sending funds](#d3-sending-funds)
  - [D4. Make deposited Bitcoin available](#d4-make-deposited-bitcoin-available)
  - [D5. Cancel Pending Transfer](#d5-cancel-pending-transfer)
    - [D5a. Inspect and Copy Transfer Recovery Details](#d5a-inspect-and-copy-transfer-recovery-details)
    - [D5b. Cancel Pending Transfer](#d5b-cancel-pending-transfer)

## Current implementation

Within the Status column, ✓ marks the completed portion described beside it; any pending work still prevents whole-story completion.

| Story | Admin UI demonstration | Status |
| --- | --- | --- |
| A1. Open Account ✓ | Account / Account Button | Complete: no-profile Account button, Account dialogue, and Back. Active-profile opening belongs to A4. |
| A2. Create Account | Account / Create Account | Implemented; creation and reload/browser-restart persistence verified. Manual real-storage reset verification pending. |
| A3 | Account / Restore Account | Account-access restoration implemented; see A3 verification evidence. |
| A4. Account Balance | Account / Account Balance | Implemented and browser-verified with real zero balance; funded Signet verification pending. |
| A5. View Activity | Account / Inspect Activity | ✓ SDK history, Account Activity UI, Copy-all, lifecycle handling, and production demo implemented. Live confirmation-transition/outgoing-spent evidence and final documentation reconciliation remain pending. |
| A6. Log Out | Account / Log Out | Implemented; core and isolated browser checks pass. Manual real-storage logout verification pending. |
| C1, C4 | Mint Asset / List Assets | ✓ Generic mint/list contracts, exact quantities, Signet adapter, and example presets implemented. Retry/lifecycle safeguards, Admin acceptance, and live mint/list verification remain pending. |
| B1-B4, C2, C3, C5 | Not implemented | Deferred. |
| D4. Account Transfer | Account / Account Transfer | ✓ Both directions, Max, quotes, explicit confirmation, and unresolved-operation guards implemented. A registered transfer remains unresolved; remaining recovery coverage and live completion verification are pending. |
| D5a. Inspect and Copy Transfer Recovery Details | Account / Account Transfer → Recovery details | ✓ Report formatter and expandable UI, explicit copy/manual fallback, and focused unit/browser checks completed. Final story reconciliation and delivery verification remain pending; this does not resolve or cancel transfers. |
| D5b. Cancel Pending Transfer | Not implemented | Blocked on verified operator cancellation scope and terminal-outcome guarantees; no cancellation UI or live cancellation delivered. |
| D1. Game-controlled wallet or issuer | Not listed | Future refactor; further specification required. |
| D2a. Receive funds using addresses | Account / Receive Funds | Complete: address journey, dedicated demo, isolated error checks, and real-account demo/independent-host verification. D2b remains blocked. |
| D2b. Receive funds using Lightning invoices | Not enabled | Blocked on a supported Arkade Signet receiving route and verified quote/recovery support. Live invoices, receipt processing, and related account-clearing guards are not implemented. |
| D3. Sending funds | Account / Send coming-soon dialog | Real sending deferred; all send types require further specification. |

The demo starts empty, including after refresh. Account Button renders the production entry button; Create Account opens the production dialogue directly. Logged-out Account offers enabled Create Account, enabled Restore Account, and Back. Completed accounts are remembered across browser restarts. Logged-in Account shows the title Account with Account Details, Log Out, and Back. Account Details shows the identity, Signet, available/total balances, Refresh, and Back to Account; it has no Log Out button. Reset Client clears BIS-owned account storage and transient state; its real stored-data verification remains manual.

Stories are sized to be completed independently. A1 covers entry; A2 owns creation and the minimal active dialogue, A3 restoration, and A4 the lean balance dialog. Each feature updates its diagram and Admin UI demonstration together. Build one small story, try it together, and refine it through hands-on feedback.

## Reading these diagrams

Based on [the original brief](BGS_PROJECT_BRIEF.md), especially sections 4, 5, 7, 8, and 14, and [confirmed design decisions](design-discussion.md).

These are intended user journeys for discussion, not implemented features or verified SDK capabilities. The current demo implements account entry, A2 creation/persistence, A3 account restoration, and A6 logout; real stored-data reset/logout verification remains pending. Other wallet flows remain planned. API names and events below come from the brief's proposed contract; additional behavior is marked as proposed or unresolved.

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
  +--> [A1.07] Restore Account [enabled; A3]
  +--> [A1.08] Back --> Account button, profile unchanged
```

- Create Account is enabled and primary; Restore Account is enabled and secondary; Back is enabled and secondary. All three action buttons have equal width and padding. Only Create/Restore carry lightning icons. Disabled actions have the prohibited cursor and perform no operation.
- No decorative title icon, coming-soon explanation, Escape handling, backdrop dismissal, wallet initialization, or network operation is part of A1.
- The production context owns state. The mounted production UI renders the dialogue and restores focus to Account after Back. The game owns its own menus and gameplay policy.
- Admin observes public state and disables the story action while the dialogue is open. Reset Client clears selection, runtime state, and BIS-owned saved account material, returning to the Game Viewport placeholder. Preview scaling preserves the active flow.
- Opening Account with an active profile now uses the shared A4 balance dialog; A2 originally supplied its minimal account-access endpoint. Creating and restoring profiles are A2 and A3.

### A2. Create a new disposable test account

Status: implemented, with manual real-storage Reset Client verification pending. Confirmed scope is captured in [add-a2-account-creation](../.openspec/changes/archive/2026-09-03-add-a2-account-creation/proposal.md); the change task list records outstanding verification. Game and Runtime Preview share production persistence behavior. Story IDs identify scope, not development order.

```text
[A2.11] Host opens the production Account dialogue
  |
  +--> [A2.12] Saved active account --> shared Account dialogue (A2.14 / A4)
  |
  +--> [A2.13] No saved account --> Account: You are not logged in.
  |      Create Account / enabled Restore Account / Back
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
  State: You are now logged in as Account ID: <first 4 characters>…<last 4 characters>.
  |
  +--> [A2.15] Log Out [opens A6 confirmation]
  +--> [A2.16] Back --> preceding host presentation

[A2.17] Refresh/close before Continue commits --> next entry starts at A2.13
[A2.18] Refresh/reopen after commit --> retain account; next entry uses A2.12
[A2.19] Admin Reset Client --> clear saved/transient account and selection
  |
  v
[A2.20] Empty Game Viewport; next A2 entry starts at A2.13
```

- Copy to Clipboard appears above Continue and copies only on an explicit click. A3 Paste from Clipboard consumes the same plain, space-separated phrase.
- Game receives account state, not recovery material or Arkade-specific types. Creating an account does not itself mean the wallet is funded or a payment succeeded.
- Service: UI explains and displays recovery; Core orchestrates activation; Arkade owns SDK identity/wallet setup and any required connectivity. SDK 0.4.67 creation has been verified against the live Signet operator with explicit transient repositories.
- Confirmed: persist the completed account on this browser across refreshes and restarts until Log Out (future A6), Admin Reset Client, or loss of browser data. Do not resume an unfinished creation after reopening. The admin selection resets on refresh; the viewport stays empty until a story is selected.
- Confirmed: the minimal logged-in dialogue hides Create/Restore and shows enabled Log Out plus working Back. A4 owns the lean balance dialog; A6 owns functional logout. Admin Reset Client is the first-run reset available in this slice, replacing the previous preserve-persisted-data behavior when A2 is implemented.
- Implemented default: Continue is immediately available without a mandatory backup checkbox or phrase verification, consistent with optional external saving. The linked design records the implemented storage protection, SDK evidence, and failure behavior.
- Security: warn never to enter or reuse a real-funds recovery phrase. Keep recovery material out of game callbacks, logs, analytics, demo event history, and verification captures. Account creation does not imply funding or network availability.

### A3. Restore an account from this experience

Status: implemented for account access only. Verification is recorded in [A3_VERIFICATION.md](../.openspec/changes/archive/2026-09-03-add-a3-account-restoration/A3_VERIFICATION.md).

```text
[A3.01] Player: Restore Account
  |
  v
[A3.02] UI: warning + 12 numbered word fields
        One * per character; one Show checkbox; Paste from Clipboard
  |
  v
[A3.03] Validate English BIP39 words + complete checksum
  |
  +--> [A3.04] Invalid: red word / phrase error; Restore disabled
  |
  v
[A3.05] Core --> Arkade: restore same identity + connect to Signet
  |
  +--> [A3.06] Unavailable: hide retained phrase; Retry / Back
  |
  v
[A3.07] Save account access in existing encrypted persistence
  |
  v
[A3.08] Same profile active --> accountConnected --> Game
  |
  v
[A3.09] Account dialogue: You are now logged in as Account ID: <first 4 characters>…<last 4 characters>. / Log Out / Back
```

- Show starts unchecked. Manual typing remains available while hidden. Paste unchecks Show before filling all twelve fields. Wrong word count leaves existing words unchanged with an error; clipboard denial allows manual entry.
- Empty words are neutral, valid words green, and invalid words red. All-green words with an invalid checksum show a phrase-level error and keep Restore disabled.
- A successful Signet connection is required before persistence/activation. Success returns directly to Account without Continue. Network failure retains the phrase temporarily for Retry; Back clears it. Save failures reconcile before retry, and stale work cannot overwrite another account.
- Restoration preserves the same profile ID and survives reload/browser restart. The supported phrase format is the experience's twelve English words; validity does not prove where a phrase originated. Never enter a real-funds phrase.
- Wallet balances, achievements, other account menu features, and gameplay checkpoints are outside A3. The former wallet/asset loading at A3.07 is deferred.

### A4. Open Account with an active profile

Status: implemented as the lean Account Balance slice. Real zero-balance, refresh/failure, and plain-host/browser checks passed; funded Signet verification remains pending. See [A4 verification](../.openspec/changes/archive/2026-09-03-add-a4-account-balance/A4_VERIFICATION.md). A2/A3 enter this shared dialog after account activation; their account-access behavior remains separate.

```text
[A4.01] Player: Gear --> Account
                   |
[A4.02] Game --> Core: openAccountDialog()
                   |
[A4.03] UI: Account menu --> Account Details
  |
  +--> [A4.04] Details: existing Account ID / Network: Signet
  +--> [A4.05] Available balance / Total balance (sats)
  |             Refresh --> loading --> success / unavailable
  +--> [A4.06] DEFERRED: Assets --> C4
  +--> [A4.07] DEFERRED: activity/history ----> A5
  +--> [A4.08] Log Out ----------------------> A6
  +--> [A4.09] Back: Details --> Account --> Game

[A4.10] Core --> fresh bounded Arkade wallet read --> UI
```

- A4.06 and A4.07 retain their IDs as deferred branches; no placeholder buttons appear. Receiving/funding details and custom asset rendering are separate future features.
- Load on each Account Details entry and Refresh; no continuous UI updates. Available balance is prominent, total secondary. Neither failures nor unknown values become zero.
- Starting a read clears prior amounts. Failure shows "Balance unavailable" and "Unable to retrieve current wallet data." with Refresh available. No balance is persisted or reused after closing/reloading; no stale values or update timestamps are shown.
- Account ID is locally verified identity; Signet is configured network, not a connection indicator. Balance failure does not log out the account or block Back; Log Out remains on the Account menu. Missing/unreadable keys follow account-access errors.
- Leaving, logout confirmation, reset, account replacement, and disposal invalidate pending balance work. Cancelling logout returns to Account without a balance read; reopening Account Details starts a new read. Temporary SDK resources are disposed after the bounded request.

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
[A6.10] UI: backup confirmation; checkbox initially unchecked
           |
           +--> Back --> Account; account remains active and saved
           |
           +--> [A6.11] Check "I have backed up my wallet"
                       --> enable Log Out --> Player confirms
                       |
                       v
[A6.02] Core: validate the confirmed account and storage generation
           |
           +--> [A6.03] Future pending-payment policy (deferred)
           |
           +--> [A6.04] Safe to log out
                       |
                       v
            [A6.05] Clear remembered account material; end active service session
                 |     |
                 |     +--> [A6.12] Failure/unconfirmed --> same dialogue: Retry
                 |                                          |
                 |                         reconcile <------+
                 v
            [A6.06] Arkade: release session resources as needed
                       |
                       v
[A6.07] Core: no active profile --> notify Game
                       |
                       v
[A6.08] UI: Create Account / Restore Account
[A6.09] Game: ordinary gameplay remains available
```

- Implemented with manual real-storage verification pending. See [A6 verification](../.openspec/changes/archive/2026-09-03-add-a6-account-logout/A6_VERIFICATION.md). Game observes the non-secret `accountDisconnected` event after confirmed active-to-absent state; normal gameplay remains usable.
- Service: Core owns session transition and pending-work policy; UI explains consequences; Arkade handles SDK-specific lifecycle cleanup. Logout is not an on-chain transaction and does not erase wallet assets.
- Confirmed scope: use the supplied Arkade Reset wallet screenshots as the behavioral reference for a backup confirmation, with our heading "Account Log Out" and action "Log Out". Ask "Did you back up your wallet?" and warn that clearing the account from this browser cannot be undone locally; restoring access requires the saved recovery phrase. This confirmation is permanent A6 behavior, independent of A3 restoration availability.
- The "I have backed up my wallet" checkbox starts unchecked every time the confirmation opens. Log Out is disabled until checked and becomes disabled again if unchecked. Checking the box alone does not log out; the player must press Log Out. Back cancels without clearing account material or ending the session.
- The Admin Log Out demonstration opens the real Account dialogue, recognizing a saved account or showing the chooser if none exists. Successful logout preserves selection and shows Create Account / Restore Account (Restore is enabled). Back restores the preceding host presentation.
- Failures retain the confirmation with Retry. No success is reported until storage clearing is confirmed; retries reconcile ambiguous completion and never clear a replacement account using an old confirmation. Other live contexts reconcile confirmed logout. Arkade wallets are already disposed after creation, so this slice has no additional network cleanup.
- A6 offers no recovery-phrase access. Pending-payment handling is deferred until payments exist. Game-specific mid-run policy is also deferred; the brief's connected-run eligibility rule is unchanged.

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

## C. Assets

Assets covers the C1-C5 journeys below: earning, claiming, recovering claims, viewing owned assets, and an optional victory reward. Normal game progress does not depend on claiming assets. The initial asset candidates are First Extraction, Ghost Run, Second Chance, and Final Extraction; a test-sat victory reward is a separate stretch goal.

### C1. Mint Asset

Current BIS/Admin flow (supersedes the earlier game-opportunity flow):

```text
[C1.01] Admin: Mint Asset -> Admin-owned modal
[C1.02] Optional quick fill: Achievement: Level 1 / LVL1
[C1.03] Optional quick fill: Achievement: Level 2 / LVL2
[C1.04] Optional quick fill: Achievement: Level 3 / LVL3
[C1.05] Edit name, ticker, amount, decimals, icon URL; Control Asset = None
[C1.06] Explicit Mint -> public mintAsset(request)
[C1.07] No account / invalid / blocked -> Console error; no submission
[C1.08] Confirmed issuance -> Console minted + asset ID; then C4
[C1.09] Close idle form -> Admin; Runtime Preview unchanged
```

- Presets only fill editable fields, with amount 1, decimals 0 and no icon. The game-specific names are Admin example data; BIS applies no accomplishment rules.
- Mint uses the active wallet's spendable Signet funds and no control asset. Operation-ID retries reconcile the original issuance; identical names on deliberate new operations are allowed.
- A submitted but unresolved mint or transfer blocks additional minting. No implicit funding, boarding, or account dialog occurs.
- UI and read-only listing are implemented; live mint-to-list verification is blocked by the account's existing unresolved registered transfer. See the C1/C4 verification record.
- C2/C3 below retain deferred game workflows; they are not prerequisites or API contracts for this Admin demonstration.
### C2. Claim the asset

```text
[C2.01] Player: Claim Asset
  |
  v
[C2.02] Game: request asset claim (asset ID, name)
  |
  v
[C2.03] Core: check active profile + claim state
  |
  v
[C2.04] UI: claim progress + lightning loader
  |
  v
[C2.05] Arkade SDK: issue or transfer intended asset
  |
  +--> [C2.06] Failed / uncertain --> C3
  |
  v
[C2.07] SDK reports successful completion
  |
  v
[C2.08] Core: asset claim confirmed (asset ID) --> Game
  |
  v
[C2.09] UI: success --> View Assets (C4) / return to game
```

- Game requests the claim and responds to confirmed success; showing a results screen does not mean the wallet already owns the asset.
- Service: React UI presents progress; Core coordinates the claim and completion event; Arkade performs the intended Arkade Assets issue/transfer operation. Wallet-owned state replaces the need for a custom application assets database. Diagram actions describe behavior, not renamed implementation APIs.
- Complexity: who issues assets, who funds issuance/transfers, and how legitimate game assets are identified remain open. No issuer secret may be embedded in the public client; the no-custom-server design must be validated before claiming this flow is feasible.

### C3. Handle an interrupted or repeated asset claim

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
  +--> [C3.05] Already owned --> UI: show existing asset
  |                      [proposed single-award policy]
  |
  +--> [C3.06] Confirmed failure, not awarded --> offer safe retry (C2)
  |
  +--> [C3.07] Cannot determine --> UI: explain / return to game
```

- Game remains playable while claim state resolves; another click or repeated level completion must not be assumed to authorize a duplicate issuance.
- Proposed service behavior: Core reconciles workflow records with Arkade wallet/operation state before retrying; UI distinguishes pending, failed, and already owned. A local success flag alone does not prove wallet ownership.
- Complexity: decide whether assets are awarded once per profile or can be earned repeatedly, and how that rule survives restoration. Transfers, asset identity, and unavailable history complicate duplicate detection; the diagram's single-award branch is a proposal, not an approved rule.

### C4. List Assets

```text
[C4.01] Admin: List Assets
[C4.02] Console: pending
[C4.03] Public listAssets -> fresh wallet holdings and metadata
[C4.04] All positive owned assets, including non-BIS assets
[C4.05] Console: asset IDs, quantities, available metadata
[C4.06] Remain in Admin; Runtime Preview unchanged
[C4.07] No owned assets
[C4.08] Console: success with []
[C4.09] Query failed
[C4.10] Console: safe error; explicit retry available
```

- No game-specific filtering, Account navigation, or production asset overlay. Missing optional metadata does not hide an asset; failed required reads are errors.
- Ownership comes from a fresh wallet query, not the earlier mint response or a local asset catalog. Icon URLs remain metadata and are not fetched.
- Live empty-list behavior is verified. A nonempty mint/list and restored-wallet round trip remain pending while the existing transfer is unresolved.
### C5. Receive a victory reward

Optional stretch goal within Assets; a test-sat payout, distinct from the Final Extraction asset.

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

- Game owns the win condition and keeps the victory valid regardless of payout. Receiving currency is separate from owning the Final Extraction asset; neither implies the other succeeded.
- Service: UI presents receive status; Core orchestrates eligibility/status and a still-undefined game callback; Arkade handles the real Signet receive workflow and balance refresh. Never display a fabricated reward transaction.
- Complexity: identify a funded sender, payout authorization, replay limits, and supported receive infrastructure without exposing credentials or adding a custom server. This remains a non-cheat-resistant proof of concept and follows the core account/payment/asset flows.

## D. Proposed features

D1-D3 were restored from surviving planning references. D1 remains a possible future refactor. D2 is now split into independently deliverable D2a and provider-blocked D2b; D3 and D4 retain their existing scope and IDs. Implementation status is stated separately from intended behavior.

### D1. Game-controlled wallet or issuer

**User story:** As a game developer, I want a game-controlled wallet or issuer to award achievements, so issuance can be managed independently of the player's wallet.

**Status:** Brief future idea only; further specification required. The current achievement proposal uses player-wallet self-issuance. A later refactor could introduce a game-controlled issuer and define who funds awards, authorizes them, and establishes trusted asset identity. No issuer credentials may be embedded in the public browser client. Hosting, funding, trust, and the no-custom-server constraint must be resolved before designing or implementing this feature. No executable D1 Admin demonstration is proposed yet.

Source: [achievement proposal](../.openspec/changes/add-achievement-opportunities-and-collection/proposal.md) and [design](../.openspec/changes/add-achievement-opportunities-and-collection/design.md).

### D2. Lightning invoice receiving

This heading/anchor remains for existing links. D2a is delivered independently in [add-d2a-address-receiving](../.openspec/changes/add-d2a-address-receiving/proposal.md). The earlier combined receiving change retains historical work and unfinished D2b live requirements; D2a completion does not complete its remaining tasks.

#### D2a. Receive funds using addresses

**User story:** As a player, I want to open Receive and copy my Arkade or Bitcoin receiving address, so someone can fund my account using a currently supported address without confusing the payment types.

**Status:** Complete for address-based receiving. Account / Receive Funds opens production Receive for an active account, or the normal chooser when logged out. Address copying, errors/retry, navigation, keyboard access, and portrait layout are verified; see [D2a evidence](../.openspec/changes/add-d2a-address-receiving/verification.md). No invoice creation or payment completion is claimed.

**Atomic outcome:** One usable, truthful Receive page from entry through copying an address and returning to Account. Include the production UI, its public state, the Admin demonstration, documentation, and verification as one deliverable.

```text
[D2a.01] Player: Account --> Receive
  |
  v
[D2a.02] Load Arkade and Bitcoin addresses
  |
  +--> Unavailable --> clear explanation + manual Refresh
  |
  v
[D2a.03] Copy either address --> copy feedback / truthful error
  |
  v
[D2a.04] Back --> Account; re-entry starts default Receive presentation
```

**Acceptance criteria:**

- Show separate, labeled Arkade and Bitcoin address fields with independent Copy controls; preserve loading, failure, manual Refresh, and clipboard-error behavior.
- Show only address receiving for now. Hide the entire Lightning invoice section, including its field, Copy control, No Invoice / With Invoice buttons, and unavailable explanation. Reintroduction is gated by D2b below.
- Back and ordinary navigation work. Returning starts at the default presentation; invoice availability does not change either address.
- Include an Admin receiving demonstration using the production public API/UI. Without an account, use the ordinary account chooser; never automatically create an account, request funds, or fabricate a receipt.
- Keep the user-story documentation and demonstration status accurate. Verify address loading/copy/error/Refresh, navigation, keyboard access, and readable 9:16 layout in both the demo and an independent host; keep automated tests, typecheck, and build passing.
- Existing SDK Activity remains unchanged. This story does not claim new transaction processing, Bitcoin-to-Arkade conversion, or live Lightning receipt verification.

**Out of scope:** Invoice amount/fee review, invoice creation, invoice lifecycle, receipt recovery, Lightning Activity reconciliation, and invoice-specific Log Out/Reset protection belong together in D2b. Sending remains D3; Bitcoin/Arkade account transfer remains D4. Do not add speculative provider infrastructure merely to make D2a larger.

**Completion boundary:** D2a is independently deliverable while D2b remains blocked. Its standalone change reuses earlier presentation work and adds its own acceptance evidence; mixed live tasks in the earlier change remain unchecked.

#### D2b. Receive funds using Lightning invoices

**User story:** As a player, I want to create and copy a Lightning invoice for a chosen amount, so someone can fund my account and I can see whether the receipt completed.

**Status:** Deferred and hidden from the app as of 2026-09-04. The user reported that [Arkade Signet](https://signet.arkade.money/) displays "Lightning unavailable: No Lightning solver available". Remove the unavailable placeholder as well as invoice controls; address receiving remains available. This supersedes earlier requirements to display a disabled invoice section. Planned in [add-lightning-invoice-receiving](../.openspec/changes/add-lightning-invoice-receiving/proposal.md). The [receiving specification](../.openspec/changes/add-lightning-invoice-receiving/specs/account-invoice-receiving/spec.md) retains the full approved live behavior. The [implementation evidence](../.openspec/changes/add-lightning-invoice-receiving/verification.md) records the support gate; an unavailable presentation is not delivery of this story.

**If/when to add it back:** Keep invoice UI hidden until the following conditions are met and live receiving is ready to ship. Do not restore it automatically just because the external wallet stops showing its warning.

**Dependencies before live implementation:** Arkade must provide a supported Signet Lightning-to-Arkade receiving route. Then verify a compatible, approved client/provider pairing, a fee quote before invoice generation using the exact payer amount, invoice validation/expiry, and safe claim/reconciliation/restart recovery. Availability of a solver alone does not prove these remaining requirements. No package upgrade, new provider, custom server, or network switch is implicitly authorized.

**Atomic outcome:** Complete a real invoice receipt safely, from amount review through confirmed account receipt and Activity, including account-state protection. Do not ship invoice generation separately from recovery and Log Out/Reset guards.

The original D2.01–D2.13 step IDs below are retained as legacy references for the live flow; D2a owns the already-usable entry/address portion. The following invoice flow is future behavior only.

```text
[D2.01] Player: Account --> Receive
  |
  v
[D2.02] Arkade / Bitcoin addresses + separate Lightning section
  |
  +--> [D2.03] Unsupported service --> Currently unavailable
  |
  v
[D2.04] Default: No Invoice, amount 0, invoice Copy disabled
  |
  v
[D2.05] With Invoice --> amount prompt: Clear / Submit
  |
  v
[D2.06] First Submit --> review payer amount, fee, net receipt
  |
  v
[D2.07] Second Submit --> generate actual invoice
  |
  +--> [D2.08] Error --> explanation; no usable invoice
  |
  v
[D2.09] Receive: invoice + Copy + With Invoice: <amount> sats
  |
  +--> [D2.10] No Invoice / With Invoice --> hide / reuse same valid invoice
  |
  +--> [D2.11] Expired --> Copy disabled; explicit Renew
  |
  +--> [D2.12] Receipt confirmed --> Paid; Copy disabled
  |
  +--> [D2.13] Leave --> reset presentation; retain receipt processing
```

- The amount is what the payer pays; fees and net receipt are reviewed in the same prompt before generation. Clear returns the amount to 0. Changed terms require renewed review. No separate result dialog or Generate button.
- Hiding an invoice does not cancel it. Within the same visit, toggling back reuses the same unpaid, unexpired invoice. Renew retains the payer amount and requires review if fees change. Paid retains the displayed amount and selection.
- Returning to Receive starts at No Invoice/0 with no displayed invoice. Pending processing continues outside Receive while the account is active and resumes after restart; processing with the browser closed is not guaranteed. Activity shows real pending/confirmed receipts without counting one receipt twice.
- Log Out and Reset are blocked while invoices remain payable or receipt processing is unresolved. Ordinary navigation remains available. Receiving leaves Arkade/Bitcoin addresses unchanged and does not include sending, paid continuation, or D4 boarding settlement.

### D3. Sending funds

**User story:** As a player, I want to send funds from my account using the supported payment types, so I can pay a recipient from the Account flow.

**Status:** D3a is the active Arkade-to-Arkade send delivery. D3b invoice sending remains deferred. D5 pending-transfer recovery is a separate proposal/story, not a prerequisite for implementing or testing D3a. D2 receiving and D4 same-account transfer remain separate.

#### D3a. Send funds to an address

**User story:** As a player, I want to send available Arkade test sats to another Arkade address after reviewing the recipient, exact amount, fees and total deducted.

**Status:** Starting implementation from [add-d3a-address-sending](../.openspec/changes/add-d3a-address-sending/proposal.md). Recipient/Paste, live spendable funds, sats amount/Max, separate Review Send and explicit confirmation. Bitcoin destinations/source selectors, Lightning, QR and fiat controls are omitted. The existing pending account remains locked; isolated implementation tests and a separately selected clean account do not depend on D5 recovery.

#### D3b. Pay a Lightning invoice

**User story:** As a player, I want to pay a recipient's Lightning invoice from my account after reviewing its amount and fees.

**Status:** Deferred and explicitly unstarted at the user's request. Separate from D3a and from D2b invoice receiving. No implementation tasks, enabled controls, dependency installation or live invoice payments are authorized by D3a. Future work requires its own proposal and Signet sending/quote/recovery verification; the receiving-route blocker alone does not establish outbound availability.

Source: [Account Send and Receive decisions](design-discussion.md#account-send-and-receive) and the [D2 proposal's separate all-send-types scope](../.openspec/changes/add-lightning-invoice-receiving/proposal.md).

### D4. Make deposited Bitcoin available

**Display name: Account Transfer.** Existing D4 heading/anchor is retained for links.

**User story:** As a player, I want to see my total split into Bitcoin and Arkade balances and choose an amount and direction to transfer within my account.

**Status:** Both Bitcoin-to-Arkade and Arkade-to-Bitcoin now support eligible amount selection, Max, real fee/net/projected-balance review and explicit Confirm Transfer. Partial amounts are preserved; unsupported change amounts are rejected. Background boarding from account inspection is disabled. Reverse Bitcoin returns to this account's boarding address and stays Bitcoin until explicitly transferred back. Durable pending-operation guards prevent blind retries and account clearing while the outcome is unresolved. Actual user-confirmed transfers through the new flow still require live verification. See [implementation evidence and live steps](../.openspec/changes/add-bitcoin-boarding-settlement/BOARDING_VERIFICATION.md) and [the transfer proposal](../.openspec/changes/add-bitcoin-boarding-settlement/proposal.md).

#### Account Details mockup

```text
+--------------------------------------------------+
|                 Account Details                  |
|                                                  |
|                  Total balance                   |
|                 [289,715 sats]                   |
|                     [Copy]                       |
|                                                  |
| Bitcoin balance          Arkade balance          |
| [289,715 sats]            [0 sats]                |
| [Copy]                   [Copy]                  |
|                                                  |
|                    [Refresh]                     |
|                                                  |
|             [Bitcoin <-> Arkade]                 |
|                [Recovery Phrase]                 |
|                     [Back]                       |
+--------------------------------------------------+
```

- Keep the existing account identity/network information and visual styling; this sketch focuses on balance layout and action placement.
- Total balance comes first. Beneath it, Bitcoin balance is on the left and Arkade balance on the right, each with its balance field and Copy control. Copy copies that field's displayed balance. Do not use Available balance as a player-facing label.
- Bitcoin <-> Arkade opens Account Transfer and sits immediately above Recovery Phrase. Back from Account Transfer returns to Account Details.
- Planning assumption: Total = Bitcoin + Arkade. Bitcoin means the account's onchain boarding funds, not a combined onchain/Lightning wallet. Arkade means the full Arkade-side total; transaction eligibility is checked separately and must not be inferred from the displayed total. Failed reads remain unavailable rather than becoming zero.

#### Account Transfer mockup

```text
+--------------------------------------------------+
|                 Account Transfer                 |
|                                                  |
| Total balance                     289,715 sats   |
| Bitcoin balance                   289,715 sats   |
| Arkade balance                          0 sats   |
|                                                  |
| Direction                                        |
| (*) Bitcoin --> Arkade                            |
| ( ) Arkade  --> Bitcoin                           |
|                                                  |
| Amount                                           |
| [ - ] [          1,000          ] [ + ] [Max]      |
|                         sats                     |
|                                                  |
| Fee                               Check below    |
|                                                  |
|                 [Review Transfer]                |
|                       [Back]                     |
+--------------------------------------------------+
                         |
                         v
+--------------------------------------------------+
|                 Account Transfer                 |
|                                                  |
| Review: Bitcoin --> Arkade                        |
| Amount                              1,000 sats   |
| Fee                               <quoted fee>   |
| Added to Arkade                   <net amount>   |
|                                                  |
| After transfer                                   |
| Total balance                     <new total>    |
| Bitcoin balance                   <new amount>   |
| Arkade balance                    <new amount>   |
|                                                  |
|                [Confirm Transfer]                |
|                       [Back]                     |
+--------------------------------------------------+
```

Amounts are illustrative, not a live fee quote or a successful transfer. Reverse-direction review says Added to Bitcoin and previews the corresponding balances.

- Editable amount with minus, plus, and Max; adjustment step remains to be specified. Max respects eligible source funds and fees. Direction changes invalidate prior fee review. Initial Bitcoin-to-Arkade direction is shown in the sketch; unsupported or unfunded directions explain why transfer cannot proceed.
- Review Transfer obtains fee/net terms. Confirm Transfer alone submits. Back from review returns to amount entry; Back from entry returns to Account Details. Changed inputs or fees require another review. No automatic transfer on receipt, account entry, refresh, restoration, elapsed time, or an achievement request.
- Both directions are now in the proposed scope. Partial boarding and same-account Bitcoin change need SDK verification. Arkade-to-Bitcoin must verify a suitable account-controlled onchain destination and recovery path; do not silently send back into a boarding-only address or promise arbitrary partial transfers before support is proven.

#### Transfer lifecycle

**Confirmed delivery order:** Both directions share tested recovery safeguards and independently verified eligibility/quotes. Since the current account holds Arkade funds and no Bitcoin boarding funds, live verification can start Arkade --> Bitcoin, then Bitcoin --> Arkade after confirmation. Verify both actual transfers, fresh balances and Activity before marking D4 complete. Resume separate achievement feasibility afterward. Never automatically move funds for testing or silently increase a partial request to Max.

```text
[D4.01] Account Details / Refresh
[D4.02] Read Bitcoin, Arkade, Total and eligibility
[D4.03] Unconfirmed source --> waiting explanation
[D4.04] Ineligible / unavailable --> explanation
[D4.05] Bitcoin <-> Arkade button above Recovery Phrase
[D4.06] Account Transfer: choose direction and amount
[D4.07] Review Transfer: fee, net and projected balances
[D4.08] Back --> amount entry --> Account Details
[D4.09] Confirm Transfer
[D4.10] Lock operation; revalidate account, inputs and fee
[D4.11] Changed / unsupported --> fresh review or explanation
[D4.12] Submit reviewed transfer in selected direction
[D4.13] Pending / interrupted --> reconcile; no blind retry
[D4.14] Verified failure --> safe retry via fresh review
[D4.15] Uncertain --> Check Status / return to game
[D4.16] Verified completion --> refresh balances and Activity
[D4.17] Read succeeds --> Account Details with actual balances
[D4.18] Read fails --> transfer complete; balance unavailable
```

Prevent duplicate submissions and retain non-secret reconciliation records across reload. Ordinary navigation remains possible; Log Out and Admin Reset remain blocked while unresolved. Closing the browser does not imply cancellation or guaranteed background processing. Do not replace real balances with review projections. A successful transfer with a failed balance refresh is not a failed transfer.

D4's Admin demonstration must use this production flow. Live transfer verification, fee calculation, partial amounts, reverse-direction destination/recovery, and account isolation remain pending. Achievement issuance remains a separate action and feasibility gate; D1-D3 are preserved.

Cancellation recovery is tracked separately in [D5. Cancel Pending Transfer](#d5-cancel-pending-transfer); D4's ID and existing links remain unchanged.

### D5. Cancel Pending Transfer

D5 is split into two independently deliverable stories and proposals. D5a provides a read-only recovery handoff now; D5b owns actual cancellation and remains feasibility-blocked. The D5 heading/anchor is retained for existing links.

#### D5a. Inspect and Copy Transfer Recovery Details

**User story:** As a player with an unresolved transfer, I want to inspect and copy its public recovery details so I can ask trusted operator support to investigate without exposing my recovery material.

**Status:** Implemented and verified with unit tests and an isolated real-browser fixture. [Proposal](../.openspec/changes/add-transfer-recovery-report/proposal.md). No cancellation SDK capability is needed and no live transaction is required for this story's acceptance.

```text
[D5a.01] Account Transfer pending status --> expand Recovery details
[D5a.02] Read known public IDs, direction, amount, phase and verification availability
[D5a.03] Copy recovery details --> copy exactly the displayed report
[D5a.04] Clipboard denied --> select text and copy manually
[D5a.05] Check Status --> update snapshot; failed checks mark verification unavailable
[D5a.06] Verified resolution --> remove pending recovery report
```

**Acceptance criteria:** Report fields are allowlisted, unknown values stay unknown, and no secrets, raw errors, balances or addresses are included. Copying is explicit and sends nothing to the operator. The report asks for batch/commitment outcome or authoritative terminal evidence excluding later settlement. All wallet guards remain unchanged; copying is not cancellation or proof of failure. Stale copy completion cannot show success for a changed report. The report remains manually selectable when clipboard access fails.

#### D5b. Cancel Pending Transfer

**User story:** As a player with an unresolved same-account transfer, I want to explicitly cancel it when supported so I can safely use my account again without risking a duplicate transfer.

**Status:** Proposed, not implemented. The confirmed delivery order is feasibility first: establish exact cancellation scope and a verifiable terminal outcome before building cancellation UI. If those guarantees cannot be established, stop and report the blocker; a disabled cancellation button is not delivery. See [proposal](../.openspec/changes/cancel-pending-transfer/proposal.md) and [feasibility findings](../.openspec/changes/cancel-pending-transfer/FEASIBILITY.md).

**Intended flow after feasibility passes:**

```text
[D5.01] D4 unresolved transfer --> inspect cancellation eligibility
[D5.02] Unsupported / active / unattributable --> keep guards; explain recovery limits
[D5.03] Cancel Pending Transfer --> review direction, sats and public IDs
[D5.04] Back --> original transfer status; no cancellation
[D5.05] Confirm Cancellation --> revalidate account and exact operation
[D5.06] Persist cancellation request boundary --> request cancellation once
[D5.07] Unverified / interrupted --> Check Status; no automatic retry
[D5.08] Verified cancellation --> save terminal outcome; release transfer guard
[D5.09] Transfer completed instead --> existing completion verification
[D5.10] Refresh balances and Activity; any new action needs its normal confirmation
```

**Acceptance criteria:**

- Cancellation targets only the reviewed same-account operation. It does not resume signing, resubmit the payment, cancel all wallet intents or undo completed transfers.
- Opening, Back, navigation, account restoration and Check Status never sign or cancel. Only Confirm Cancellation authorizes the cancellation request.
- Unknown outcomes survive restart and keep new wallet mutations, Log Out and Reset blocked. Missing history, elapsed time, unspent inputs and an ambiguous acknowledgement are not cancellation proof.
- Verified cancellation preserves the original public operation record and appears in Account Activity and Copy Transactions. No refund, blockchain transaction or timestamp is invented.
- A later transfer requires a fresh quote and explicit confirmation. Resolving D5 does not automatically log out, reset, mint or transfer funds.
- Real Signet cancellation requires separate explicit user confirmation and evidence of terminal resolution; fixtures do not count as live acceptance.

**Boundary:** D5b and its `cancel-pending-transfer` proposal are independent of D5a read-only reporting and D3a new sending; cancellation feasibility is not a development prerequisite for either. It does not introduce a separate Admin shortcut or bypass; the production entry remains Account Transfer. Existing story IDs and the D5 umbrella anchor are preserved.
