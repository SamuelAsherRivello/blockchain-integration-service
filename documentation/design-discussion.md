# Design discussion

## D4 proposed boarding settlement (2026-09-04)

**Later confirmed mockup revision:** Total balance appears first in Account Details. Bitcoin balance and Arkade balance appear side by side beneath it, left and right respectively, with separate fields and Copy controls. Remove Available balance from the proposed player-facing UI. A Bitcoin <-> Arkade button immediately above Recovery Phrase opens Account Transfer. The transfer dialog shows balances, direction, editable amount with minus/plus/Max, and Review Transfer; review shows fee/net/projected balances and Confirm Transfer. Back returns through entry to Account Details. See the [D4 ASCII mockups](User%20Story%20Diagrams.md#d4-make-deposited-bitcoin-available).

This supersedes the earlier one-way Make Available recommendation below. Both directions and selected amounts are now proposed. Total is the sum of Bitcoin-side and full Arkade-side holdings; spendability is checked independently. Partial boarding/change, adjustment step, and the reverse path's account-controlled Bitcoin destination still need definition/verification. Runtime changes and fund movement have not been performed.

- Proposal: [add-bitcoin-boarding-settlement](../.openspec/changes/add-bitcoin-boarding-settlement/proposal.md). This section records recommendations, not approved behavior or implementation. D4 preserves existing D1 issuer, D2 Lightning receiving, and D3 sending references.
- A confirmed Bitcoin boarding deposit increases Total but needs an explicit settlement into Arkade funds before it becomes Available. Additional waiting or refreshing does not initiate settlement in the current integration.
- Recommend Account Details entry/Refresh detect eligible deposits and offer Make Available. Receive explains the additional step. The player reviews eligible amount, fee, and net receipt, then confirms. No automatic settlement on deposit, login, restoration, balance refresh, or achievement requests.
- Core owns a per-profile operation and non-secret recovery records; the Arkade adapter revalidates and settles only reviewed eligible boarding inputs to the same account. Fees/input changes require another review. Unsupported fee estimation, expired deposits, or operator rejection must be explicit, not represented as indefinite confirmation waiting.
- Keep ordinary navigation available. Block Log Out and Admin Reset while the operation is unresolved, coordinate this with D2's proposed pending-receipt guard, and reconcile after interruption before retry. Closing the browser does not guarantee cancellation or continued processing.
- Verify settlement and fresh balances independently, then refresh Activity. Show pending/uncertain results truthfully and never infer success from a locally adjusted balance. D4 Admin opens the production flow. SDK/operator eligibility, fee review, interruption recovery, and live settlement remain verification gates.
- Recommended order: deliver and verify D4, then resume the achievement feasibility gate. No automatic achievement issuance follows funding. No runtime code or funds are changed by this proposal.

## Recovery Phrase access

- Account Details includes Recovery Phrase at the bottom, above Back. The separate Recovery Phrase dialog immediately reads the saved active identity and opens the numbered seed-word layout, with the warning "Anyone with this phrase can access your account." and the existing Signet-only warning.
- The words are masked by default. `Seed words`, inline Copy, and an off-state visibility eye appear above the numbered layout after the local read succeeds; there is no separate Show Recovery Phrase or Copy Recovery Phrase button. Recovery material is never included in public state or events.
- Account Log Out includes View Recovery Phrase. Back returns to that confirmation with the backup checkbox unchecked; entering from Account Details returns to Account Details.
- Back, account changes, reset, UI unmount, and disposal clear the revealed value and invalidate delayed reads. Reopening always starts hidden. Read and clipboard failures use generic messages and allow retry.
- Verification uses invalid placeholder words and in-memory storage; no real recovery material was accessed. The core suite and isolated browser recovery checks cover reveal/copy, navigation, narrow layout, and lifecycle cleanup.

## Account Send and Receive

- Account has side-by-side Send and Receive buttons immediately above Log Out. Send opens a coming-soon dialog; real sending is deferred as D3.
- Receive includes the active account's Arkade address and Bitcoin boarding address, each with a Copy button and selectable full value. Signet test funds only.
- Addresses load only on Receive entry and Refresh. Account Details loads balances only. Back, account replacement, logout, and disposal clear them and invalidate pending results. Refresh clears prior addresses; failures offer retry without logging the user out.
- This supersedes the A4 deferral only for these two addresses. Lightning invoice generation remains deferred as D2 in User Story Diagrams; no new swap dependency or invoice UI is included.
- The existing A4 Admin demonstration uses the same production account menu, with address fields reached through Receive.

## A4 confirmed scope and implementation

- Both Account and Account Details show the same three-line information block below the title: "You are now logged in.", "Account ID: <first 4>…<last 4>" (ID in code styling), and "Network: Signet".
- Account is a menu titled Account with Account Details, Account Activity, Log Out and Back. Account Details has its own title, identity/network information, available/total balances and only Refresh/Back actions. Back returns to Account. No balance request runs merely from opening Account.
- Load on Account Details entry/manual refresh only. Clear amounts when loading or unavailable. Do not persist balances, reuse prior dialog values, or show stale amounts after failure, even within the same dialog. This supersedes the earlier tentative stale-value policy.
- Balance failure retains verified account access. Missing/unreadable keys remain an account-access error; Signet is not a connectivity indicator.
- A5 Account Activity is a separate implemented dialog; C4 assets/achievements and custom rendering remain separate. Receiving addresses are covered by the later address decision above.
- Adapter/core/UI/demo are implemented. Real zero balance and browser failure/recovery checks passed; funded Signet verification remains pending. See ../.openspec/changes/archive/2026-09-03-add-a4-account-balance/A4_VERIFICATION.md. Earlier A2/A6 manual storage checks remain pending.

## A3 confirmed behavior and implementation

- Any word field accepts multiple space-separated words and fills sequential fields starting there. Typing a separating space advances focus; overflow beyond field twelve preserves the existing grid with an error.

- Account access only: restore the same twelve-word English identity, require a successful Signet connection, save using existing encrypted persistence, and immediately return to the Account dialogue showing "You are now logged in as Account ID: <first 4 characters>…<last 4 characters>." No Continue step, balances, achievements, or full A4 menu.
- Use a numbered grid with manual entry. Initially hide nonempty fields with one `*` per character. One Show checkbox reveals/hides the entire grid.
- Paste from Clipboard first unchecks Show, then fills all twelve fields. Wrong word counts preserve the grid and show an error. Clipboard access is explicit; permission failure permits manual entry.
- Empty fields are neutral; valid English BIP39 words have green indicators and invalid words red. Restore requires the complete checksum to pass. Valid words remain green when a phrase-level checksum error appears.
- Connection failure retains the phrase temporarily and hidden for Retry; Back clears it. Save failures reconcile before retry. Cancellation and concurrent account changes cannot allow stale restoration to overwrite stored state.
- Implemented production flow and Admin demonstration; live Signet restoration, same-identity persistence, browser restart, and isolated failure/UI checks are recorded in `../.openspec/changes/archive/2026-09-03-add-a3-account-restoration/A3_VERIFICATION.md`. Earlier manual A2/A6 storage-clearing checks remain separate.

## Confirmed decisions

- Repository name: blockchain-integration-service (user decision, 2026-09-03).
- Source baseline: documentation/BGS_PROJECT_BRIEF.md, imported from the supplied Google Doc.
- Use OpenSpec and settle naming, folder structure, and integration contracts before implementation.
- Preserve the brief's separate game repository and frontend/core/Arkade responsibilities.
- Track planning files under `.openspec/`, with an ignored local `openspec` compatibility link for the stock CLI.
- Grill Me is optional and user-invoked before or after proposal creation. It is not a schema prerequisite; retain `spec-driven`.
- Approved: one integration package under `packages/integration`, with `core`, `ui`, and `arkade` internals; one consuming app under `packages/integration-demo`, with `admin` and `preview` folders.
- Initial baseline was a coming-soon Account overlay. The current account-entry implementation and public contract are described below; A2 now adds real Signet creation and encrypted account persistence, pending manual reset verification.
- GitHub Pages publishes the demo app. Local development uses the React development server when needed.

## Questions for iteration

1. Retain Blockchain Gaming Services / BGS as product and API names, or align with Blockchain Integration Service?
2. Resolved: one integration package with explicit internal layers, consumed by the demo app.
3. Resolved: source under packages/integration/src and packages/integration-demo/src; docs under documentation. Test organization can grow with behavior.
4. Who mounts the React overlay and owns its container, styling, focus, resizing, and disposal?
5. Define initialization, availability, account lifecycle, request methods, events, and subscription cleanup.
6. When is connected mode fixed for a run? What happens after logout or account change?
7. How do operation/run IDs prevent duplicate charges and stale success events reviving the wrong checkpoint?
8. Who receives continue payments, creates payment requests without a custom server, and verifies completion?
9. Who issues achievements, funds issuance, defines asset identity, and handles duplicate claims and wallet restoration?
10. Verify current official Arkade Signet wallet, payment, asset, and recovery capabilities before implementation.

These questions and recommendations are not approved design decisions. The next outcome is a reviewed OpenSpec proposal, design, requirements, and tasks.

## Account entry implementation

- Production factories: `createBisContext()`, `createBisAdminContext(context)`, `createBisUi(context)`. UI exposes `mount(container)`, `showAccountButton()`, and `unmount()`; context exposes opening/closing, immutable state, subscriptions, and disposal.
- Runtime Preview UI consumes production API only. Admin UI consumes production state first and uses admin context only for transient reset. No private imports or security bypasses.
- Demo styles own the dark surrounding page/frame; integration styles own light centered production content. Hosts choose the mount container; future multi-container layouts are deferred.
- Admin shows implemented demonstrations and nonempty categories only. Initial selection is empty. Reset recreates clients, clears selected story and BIS-owned persisted account material, and leaves runtime content empty. This supersedes the A1 preserve-storage behavior; live reset verification remains manual.
- A1 is complete: Account button > Account dialogue > Back. A2 owns creation and the minimal active Account dialogue; A3 owns restoration, A4 the lean balance dialog, and A6 functional logout. Keep each story small enough to complete fully, then try it together and refine with hands-on feedback.
- New features must include an Admin UI demonstration and synchronized, accurate user-story documentation.





## A2 confirmed behavior and implementation status

- Create Account is enabled when logged out. Recovery display is immediate; optional external saving does not block Continue. Only Continue commits and activates the account.
- The real host and Runtime Preview use identical production persistence. Completed accounts survive refresh/browser restart on the same origin/browser profile. Interrupted creation restarts from the beginning.
- Active Account shows "You are now logged in as Account ID: <first 4 characters>…<last 4 characters>.", enabled Log Out, and Back, with Create/Restore hidden. Admin Reset Client remains the separate first-run reset; A6 provides production logout.
- Refresh clears admin selection and leaves the viewport empty; selecting A2 recognizes a saved account. Story IDs do not dictate development order.
- SDK creation, reload/restart persistence, and plain-host parity have been verified. Manual real-storage reset checks remain before A2 is reported complete.

## A6 implementation (manual storage verification pending)

- Log Out clears remembered account material only after a backup confirmation modeled on the supplied Arkade Reset wallet screenshots. Use the BIS heading "Account Log Out" and action "Log Out". This is permanent behavior, independent of whether A3 restoration is implemented.
- Ask "Did you back up your wallet?" and explain that clearing this browser's saved account cannot be undone locally and that restoration requires the saved recovery phrase. Wallet assets are not erased by logout.
- Require an initially unchecked "I have backed up my wallet" checkbox. Enable Log Out only while checked; checking alone never executes logout. Each opening starts unchecked. Back returns to Account with the session and saved account unchanged.
- After confirmed, successful logout, show Create Account / Restore Account and keep ordinary gameplay available. Include the confirmation states and cancellation in the A6 Admin demonstration and verification.
- Failed or unconfirmed clearing keeps the dialogue open with Retry; success is reported only after confirmed clearing. Retry reconciles already-cleared and replacement-account cases safely.
- A6 offers no recovery-phrase access. Pending-payment handling is deferred until payment features exist; game-specific mid-run eligibility remains outside this slice. A3 restoration and a future backup-access feature remain separate.
- Public methods are `openLogoutConfirmation()`, `setLogoutBackupAcknowledged(boolean)`, `confirmLogout()`, and `cancelLogout()`. `retry()` handles logout errors. Each observing active context receives `accountDisconnected` with its former public profile ID only after confirmed absence; disposal stops notifications.
- Production UI and the A6 Admin story are implemented. Core storage-double and isolated browser verification are recorded in `../.openspec/changes/archive/2026-09-03-add-a6-account-logout/A6_VERIFICATION.md`; real-storage deletion checks remain manual and pending.


## A5 Account Activity

- Account Activity appears immediately below Account Details. Its dialog shows Account ID, then Transactions as clickable single-line rows in the existing history order: grouped sats, direction, and concise status, separated by pipes (for example, `1,000 sats | Arkade → Bitcoin | Pending`). Rows never wrap; excess text is ellipsized. The dialog opens at 480px tall, capped by the available host height, with a persistent vertical scrollbar in the list even while loading or empty. A single click selects and highlights a row; clicking the selected row again or double-clicking an unselected row opens its Transaction dialog. Back retains the selected row; leaving Activity clears selection.
- Incoming, outgoing, confirmed, and spent records remain visible when supplied by Arkade. Identifiers, asset metadata, and extended status are shown only in the Transaction Detail dialog. Opening a row shows Transaction Detail with one read-only multiline field, a Transaction Copy button, and Back beneath it returning to the list. Account Activity and Transaction Detail both use the same fixed 480px height, capped by available host space, regardless of content or copy feedback. The detail field scrolls internally rather than resizing the dialog. Details label the amount, direction, full status, available type, individual identifiers, and available asset metadata; Copy copies only those selected details.
- A read-only SDK wallet supplies history, coin metadata, and notifications; periodic SDK reconciliation catches missed events and stale connections. No payments or settlement run. Data and observation are transient and cleared on leaving or account change.
- Live pending receipt and automatic refresh, isolated browser checks, and package tests pass. Live confirmation and outgoing/spent evidence remain pending; see ../.openspec/changes/add-a5-inspect-activity/A5_VERIFICATION.md.

## Bitcoin presentation precedence

- Bitcoin receipt Transaction Detail includes confirmations computed from the live chain tip and the confirmed output block height, the available block height, and a Signet explorer URL. Unconfirmed outputs show 0 and first-block waiting guidance without a promised ETA. Missing confirmation evidence is explicitly unavailable; off-chain records do not claim Bitcoin confirmations. These fields update with existing Activity reconciliation and are included in Copy.

- Present Bitcoin before Arkade wherever balances, receiving methods, or functionality are listed together. Receive lists Bitcoin address first; balance breakdowns list Bitcoin first after the combined total; transfer entry and direction choices list Bitcoin first.
- This is a presentation convention, not a change to balance calculations or payment routing.

## D4 UI delivery

**Confirmed next delivery order:** Bitcoin-to-Arkade first: eligibility and fee verification, review, durable operation/reconciliation and clearing guards, then explicit submission and live balance/Activity verification. Resume achievement feasibility after boarding succeeds. Arkade-to-Bitcoin follows independently after verifying its own destination, quotes and recovery; it is not a prerequisite for boarding. Availability must be direction-specific. Unsupported partial amounts are rejected rather than silently converted into whole-deposit transfers. This decision updates planning only; real transfers remain disabled today.

The confirmed balance layout and transfer entry/review are implemented. Plus/minus uses one-sat steps from 0. Max and confirmation remain disabled; unavailable fees and projected balances are explicitly labeled. Public navigation is `openAccountTransfer()` and the new balance fields are `bitcoinSats` and `arkadeSats`, with full totals separated from spendability. Real settlement/withdrawal and achievement checks remain pending. See [UI verification](../.openspec/changes/add-bitcoin-boarding-settlement/UI_VERIFICATION.md).

## D4 explicit bidirectional transfer implementation (2026-09-04)

The user reconfirmed both Bitcoin-to-Arkade and Arkade-to-Bitcoin with chosen amounts, Max, review and explicit confirmation. Both quote/submission paths are implemented with shared durable registration boundaries; actual user-confirmed live transfers remain to be verified. Current live balance is boarding 0 and settled/available Arkade 289715, so verification may start in reverse, then board back. Reverse uses the same account's SDK-derived boarding address and existing Bitcoin balance definition. Automatic reboarding is disabled.

Important correction: SDK 0.4.67 signing-wallet defaults can automatically board deposits. Account restoration/balance/address/funding-address readers now use read-only wallets/identities; only explicit transfer uses a signing wallet with settlementConfig false. A disabled transfer button alone was not sufficient to prevent that background SDK path. See the canonical transfer proposal and BOARDING_VERIFICATION.md for the current recovery contract and evidence.

## C1/C4 generic assets — 2026-09-04

The latest user decision replaces BIS-level achievement semantics with generic asset minting/listing. C1 Mint Asset uses an Admin-owned modal with Name, Ticker, Amount, Decimals, Icon URL and fixed Control Asset None. Three editable Admin presets use Achievement: Level 1/2/3, LVL1/2/3, amount 1, decimals 0 and the matching hosted numbered trophy icon URL. These are example data only. The three 64 by 64 transparent numbered trophy PNGs use versioned GitHub Pages URLs; preserve their published paths and bytes for existing mint metadata. See [trophy assets and public URLs](../packages/integration-demo/public/assets/achievements/README.md). C4 List Assets prints all positive holdings to Console. Neither uses Runtime Preview.

Mint request IDs provide retry protection; names do not imply uniqueness. APIs are mintAsset, listAssets, getPendingAssetMint and validateMint. No control-asset or reissuance feature is included. This supersedes the earlier C1 opportunity-only, game-filtered listing and name-based duplicate assumptions. C2/C3 broader game workflows, B, C5 and D1 remain deferred.

The user's later Signet-wallet screenshots and matching BIS list established an externally minted Level 1 baseline. Current apply verification then successfully minted another Level 1 from BIS with the same identity and SDK 0.4.67; a fresh list returned both distinct asset IDs with quantity 1 and matching hosted metadata. The previously registered transfer blocker was not reproduced, bypassed, or repaired in this slice. Console pending followed by success represents a completed list request. See [current C1/C4 evidence](../.openspec/changes/archive/2026-09-04-add-achievement-opportunities-and-collection/C1_C4_VERIFICATION.md); broad pending-transfer recovery remains separate.

## D3a sending separated from transfer recovery — 2026-09-04

The user explicitly requested two proposals and stories, starting with Send. D3a `add-d3a-address-sending` now delivers Arkade-to-Arkade only: recipient/Paste, spendable funds, sats/Max, exact review and explicit confirmation. Bitcoin source/destination selectors and Lightning/QR/fiat controls are excluded. The production flow and API are implemented with isolated adapter/core/browser tests; live payment acceptance needs selected clean Signet accounts and remains pending. D5 recovery in its separate proposal is not a development prerequisite. Existing pending-transfer locks and concurrent D5 work remain intact; no cancellation or account clearing occurs as part of D3a.


## Wallet isolation — 2026-09-04

The app instance considers only the currently logged-in wallet. Transfer and send journals, status reconciliation, Activity evidence, pending-operation guards, and mutation locks are scoped by profile ID. Existing legacy journals remain intact and are read only for their identified owner; new records use wallet-specific keys. Restoring a wallet restores access to its recovery records. Account changes invalidate reviews and transient UI state; late operation callbacks remain bound to their originating wallet. Funding requests from a previous account cannot block the current account.


## Complete logout cleanup — 2026-09-04

The user explicitly requested complete app-owned browser cleanup on logout. Keep the existing backup acknowledgement. Only when there are more than zero locally saved pending transfers, sends, or mints, show a second required checkbox with the exact text `I accept losing my (5) pending transactions.` using the actual count. Reopening resets it; a changed pending set requires new acknowledgement. Explain separately that submitted transactions may still complete and logout removes recovery information rather than cancelling network transactions.

Complete logout clears the encrypted account and generation records, all BIS journals across saved wallets, and demo preferences; the empty IndexedDB schema may remain. All live BIS tabs reload to discard session state. Unrelated host/browser data is preserved. Current SDK repositories are explicitly in-memory. This supersedes earlier decisions to preserve transfer journals or prohibit logout for pending sends, but does not relax spending or Admin Reset guards. Preview scale and split layout are now session-only so reload does not recreate persisted preferences. Ordinary refresh retains account access and recovery journals. UI and core checks use storage doubles; destructive live-wallet verification is not performed.


## Pending Operation Dialog — 2026-09-04

Confirmed: render a page and immediately cover it until its operation, data refresh, required image preparation and render are complete. Show an operation label ending in ing... above the spinning bolt. Pending is noninteractive; errors offer only OK, closing both the operation dialog and its source page. Data reads retry once automatically using existing deadlines, with 30 seconds where absent. Retain the 75-second Transactions initial-read budget. No automatic resubmission of Burn, Send or Transfer. Keep Burning... through its refresh and reveal ready Assets with no Asset burned. message. Remove inline loading/progress/completion text. Background updates and Admin-only operations do not open the runtime prompt. An unconfirmed outcome uses truthful feedback and OK while retaining recovery information.

This supersedes older inline Loading..., unavailable-page and Retry/Back presentation decisions; existing wallet safeguards and public operation APIs remain authoritative.
