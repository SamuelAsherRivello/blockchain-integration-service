# Design discussion

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
- Adapter/core/UI/demo are implemented. Real zero balance and browser failure/recovery checks passed; funded Signet verification remains pending. See A4_VERIFICATION.md. Earlier A2/A6 manual storage checks remain pending.

## A3 confirmed behavior and implementation

- Any word field accepts multiple space-separated words and fills sequential fields starting there. Typing a separating space advances focus; overflow beyond field twelve preserves the existing grid with an error.

- Account access only: restore the same twelve-word English identity, require a successful Signet connection, save using existing encrypted persistence, and immediately return to the Account dialogue showing "You are now logged in as Account ID: <first 4 characters>…<last 4 characters>." No Continue step, balances, achievements, or full A4 menu.
- Use a numbered grid with manual entry. Initially hide nonempty fields with one `*` per character. One Show checkbox reveals/hides the entire grid.
- Paste from Clipboard first unchecks Show, then fills all twelve fields. Wrong word counts preserve the grid and show an error. Clipboard access is explicit; permission failure permits manual entry.
- Empty fields are neutral; valid English BIP39 words have green indicators and invalid words red. Restore requires the complete checksum to pass. Valid words remain green when a phrase-level checksum error appears.
- Connection failure retains the phrase temporarily and hidden for Retry; Back clears it. Save failures reconcile before retry. Cancellation and concurrent account changes cannot allow stale restoration to overwrite stored state.
- Implemented production flow and Admin demonstration; live Signet restoration, same-identity persistence, browser restart, and isolated failure/UI checks are recorded in `A3_VERIFICATION.md`. Earlier manual A2/A6 storage-clearing checks remain separate.

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
- Production UI and the A6 Admin story are implemented. Core storage-double and isolated browser verification are recorded in `A6_VERIFICATION.md`; real-storage deletion checks remain manual and pending.


## A5 Account Activity

- Account Activity appears immediately below Account Details. Its dialog shows Account ID, then Transactions with one Copy button and one read-only text area containing all Arkade-provided history, one transaction per line, newest first.
- Incoming, outgoing, confirmed, and spent records remain visible when supplied by Arkade. Each line includes sats, direction, supported status, and available transaction/output identifiers. Copy copies the whole list.
- A read-only SDK wallet supplies history, coin metadata, and notifications; periodic SDK reconciliation catches missed events and stale connections. No payments or settlement run. Data and observation are transient and cleared on leaving or account change.
- Live pending receipt and automatic refresh, isolated browser checks, and package tests pass. Live confirmation and outgoing/spent evidence remain pending; see A5_VERIFICATION.md.
