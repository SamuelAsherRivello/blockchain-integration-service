# Integration package

Production UI and state, consumed only through public exports. `src/core` owns lifecycle and state; `src/ui` owns components and all light production styling; `src/arkade` owns real Signet SDK creation and identity reconstruction.

Recovery Phrase is available at the bottom of Account Details, above Back and from the logout confirmation. `openAccountRecovery()` opens the numbered seed-word layout and immediately reads the saved phrase inside the production UI; the words are masked by default, with inline copy and visibility controls beside `Seed words`. Public state exposes only `accountRecovery` and `recoveryStatus`, never the words. Back returns to the entry screen, and leaving/unmounting clears the loaded phrase. Isolated verification: `node --test packages/integration/tests/recovery-access.test.mjs` and the demo's `/tests/recovery-host.html`.

```javascript
import { createBisContext, createBisAdminContext, createBisUi } from '@bis/integration';
import '@bis/integration/style.css';
const context = createBisContext();
const ui = createBisUi(context);
ui.mount(container); // host-owned positioned element; initially empty
ui.showAccountButton();
// The rendered Account button invokes context.openAccountDialog().
const unsubscribe = context.subscribe(() => console.log(context.getState().view));
// Admin UI only:
const adminContext = createBisAdminContext(context);
await adminContext.resetClient(); // explicit first-run reset; removes BIS account storage
// Host cleanup before replacement:
unsubscribe();
ui.unmount();
context.dispose();
```

The demo rebuilds all handles after reset, clears selection, and leaves runtime content empty. `getState()` returns an immutable snapshot; `subscribe()` returns cleanup. `closeAccount()` restores the prior presentation. Mounting twice in the same container is idempotent; unmount before changing containers. Calling actions on a disposed context throws. `GameOverlay` remains a compatibility wrapper around the same UI.

The Account chooser enables Create Account and Restore Account. A3 uses twelve numbered word inputs, initially masked with one asterisk per character, with one Show checkbox and explicit Paste from Clipboard. Word-list and checksum validation gate Restore; successful Signet connection and durable saving return directly to Account. `openRestoreAccount()` opens entry when logged out; recovery submission stays inside the private production UI/Core boundary. Creation uses the real Signet SDK with memory repositories; Continue commits encrypted identity to origin-scoped IndexedDB. Refresh before Continue forgets unfinished creation. The active Account menu shows Account Details, Account Activity, side-by-side Send and Receive, Log Out, and Back. Account Details shows identity/network and available/total balances with Refresh and Back to Account; A6 is implemented with manual storage verification pending. `ready()` awaits hydration, `createAccount()` and `continueAccount()` drive creation, and `onEvent()` exposes safe `accountConnected` and `accountDisconnected` payloads. Public state never contains the phrase or SDK types. Ordinary disposal preserves saved identity. Browser storage is test-only, automatically accessible to this origin, and does not protect against compromised same-origin code. Live deletion-based reset verification remains manual under the repository rules.

The active Account action opens the A6 backup confirmation. `openLogoutConfirmation()` starts it with an unchecked acknowledgement; `setLogoutBackupAcknowledged(boolean)` controls the gate; `confirmLogout()` performs guarded local logout; `cancelLogout()` returns to Account. `retry()` retries a failed logout after reconciling persisted state. Busy logout cannot be cancelled. Success retains the open logged-out dialogue and emits `accountDisconnected` with the former public `profileId`; other live contexts reconcile the same transition. Logout does not expose the recovery phrase, require connectivity, or clear Admin selection. Game-specific run eligibility remains the host's responsibility.

Run core tests from the repository root: `node --test packages/integration/tests/*.test.mjs` (Node 24+). A real-storage plain-host browser fixture is available at `/tests/ui-host.html`. `/tests/logout-host.html` and its `?plain` mode provide explicitly isolated storage-double component checks; they are not part of the production demo. See `.openspec/changes/archive/2026-09-03-add-a6-account-logout/A6_VERIFICATION.md` for pending manual real-storage checks.

A4 exposes provider-neutral `state.balance` (idle/loading/ready/unavailable) and `refreshBalance()`. It requests fresh data on Account Details entry or Refresh, clears amounts while loading or unavailable, and never persists balances. Network failure preserves account access. Closing, changing accounts, and disposal invalidate results. No timer drives UI refresh. See `.openspec/changes/archive/2026-09-03-add-a4-account-balance/A4_VERIFICATION.md`; funded Signet verification remains pending.

`openAccountDetails()` navigates from the active Account menu. `state.accountDetails` distinguishes the two dialogs. `closeAccount()` returns from Details to Account before leaving to the host. The Account menu never requests balances.

Admin context also exposes `fund1000Sats()` for explicit Signet test funding. It derives the active account's public Arkade address internally and submits it with amount 1000 to the official wallet's configured Signet faucet. It returns an acknowledgement message or rejects with a sanitized error; it does not expose recovery material, update balance state, or automatically retry. This is a demo/admin utility, not a production gameplay API.


## Account Activity (A5)

Account Activity appears below Account Details. The dialog shows Account ID and one read-only Transactions text area with Copy for the entire list. It includes all incoming/outgoing history Arkade supplies, including spent records, newest first. Each line contains sats, direction, supported status, and available transaction/output identifiers.

Public context methods: openAccountActivity() and refreshActivity(); getState().activity exposes idle/loading/ready/unavailable and normalized transactions. accountActivity identifies the open route. Existing subscribe() delivers updates. refreshActivity() observes until the view is closed or its operation is cancelled; UI callers use it without awaiting the subscription lifetime. BisActivity and BisTransaction are public types with no SDK types or credentials.

History loads on entry, updates through SDK notifications and a 15-second reconciliation read, and clears on Back, account change, logout/reset, or disposal. A read-only wallet performs no payment or settlement. Copy is disabled without current transaction lines. See .openspec/changes/add-a5-inspect-activity/A5_VERIFICATION.md for live verification limits.

Receive (`openAccountReceive()`) displays the Arkade and Bitcoin addresses with copy controls and Refresh. Addresses load only in Receive and clear on leaving; `refreshBalance()` refreshes the data for the current Details or Receive page. Send (`openAccountSend()`) opens a coming-soon dialog and performs no wallet operation; implementation is deferred as D3.

D2a completes this address journey, including clipboard errors/manual selection, Refresh retry, navigation, and demo/plain-host verification. `state.invoiceReceiving` exposes a provider-neutral unavailable reason; the Lightning invoice section is hidden pending the [D2b reintroduction conditions](../../documentation/User%20Story%20Diagrams.md#d2b-receive-funds-using-lightning-invoices). No fee prompt, invoice generation, receipt processing, or invoice-specific Log Out/Reset guard is implemented by D2a. See [D2a evidence](../../.openspec/changes/add-d2a-address-receiving/verification.md); live receiving remains D2b and account transfer remains D4.

## Account Transfer UI

Account Details now shows `totalSats` first, then `bitcoinSats` and `arkadeSats` side by side with Copy controls. `availableSats` remains in the public result for compatibility and spendability checks; it is not the full Arkade total. Bitcoin is SDK boarding total; Arkade is total minus boarding.

`openAccountTransfer()` opens the active account's production transfer screen; `accountTransfer` reports that presentation. Back returns to Account Details with a fresh balance read. Both directions support eligibility-based Max, quote review and explicit confirmation through `quoteAccountTransfer`, `confirmAccountTransfer` and `checkAccountTransfer`. Review never submits funds. Unresolved journal records block further transfers and account clearing. Status exposes the recorded phase, public operation IDs, sanitized interruption category and verification availability; Check Status never signs or retries a transfer. Submission allows time for the operator's advertised session. Actual bidirectional completion remains unverified; see [transfer verification and recovery](../../.openspec/changes/add-bitcoin-boarding-settlement/BOARDING_VERIFICATION.md).
D5a read-only transfer recovery: pending Account Transfer offers **Recovery details**, a selectable public-status report and **Copy recovery details**. Clipboard failure provides manual-copy guidance. The report omits secrets, raw errors, addresses and balances, and nothing is sent to support automatically. Existing status/clearing guards are unchanged. D5b actual cancellation remains separately blocked by operator feasibility; copying does not unlock an account.

## Asset minting and listing

The UI-independent public API is `context.mintAsset({ operationId, name, ticker, amount, decimals, iconUrl? })`, `context.listAssets()`, and `context.getPendingAssetMint()`. Use a fresh operation ID for an intentional new mint and reuse the exact request for a retry. `validateMint(request)` provides the same form validation without a wallet operation.

Amount is a human-readable decimal string; returned quantity is a base-unit decimal string. Supply is positive, exact, and bounded to unsigned 64-bit units; decimals is 0–18. Control assets and reissuance are not exposed. All positive wallet assets are listed, including assets without BIS metadata. Optional icon URLs are returned as text, never fetched automatically.

Minting uses the active wallet and its spendable Signet funds. Results are `minted`, `already-minted`, or a safe typed error; listing returns `success` with an assets array or an error. These calls never mount UI or change account navigation. No game-specific semantics exist in BIS.

A public local journal binds operation IDs to complete requests and survives logout/reset. Unresolved operations prevent new mints for that account. Same-origin wallet locking coordinates with transfers and account clearing; cross-device exactly-once behavior is not guaranteed. A registered unresolved transfer also blocks minting. An `already-minted` result records the prior issuance; call `listAssets()` for current ownership.

Implementation verification: `.openspec/changes/add-achievement-opportunities-and-collection/C1_C4_VERIFICATION.md`. Live mint/list round-trip verification is pending resolution of the existing wallet transfer.
