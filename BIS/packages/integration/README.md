# Integration package

Production UI and state, consumed only through public exports. `src/core` owns lifecycle and state; `src/ui` owns components and all light production styling; `src/arkade` owns real Signet SDK creation and identity reconstruction.

Get Recovery Phrase is available at the bottom of Balance, above Back. `openAccountRecovery()` opens the numbered seed-word layout and immediately reads the saved phrase inside the production UI; the words are masked by default, with inline copy and visibility controls beside `Seed words`. Account creation uses the same display under Set Recovery Phrase. Public state exposes only `accountRecovery` and `recoveryStatus`, never the words. Back returns to the entry screen, and leaving/unmounting clears the loaded phrase. Isolated verification: `node --test BIS/packages/integration/tests/recovery-access.test.mjs` and the demo's `/tests/recovery-host.html`.

```javascript
import { createBisContext, createBisAdminContext, createBisUi } from '@bis/integration';
import '@bis/integration/style.css';
const context = createBisContext();
const restarted = new Set();
const unsubscribeEvents = context.onEvent(event => {
  if (event.type !== 'restartRequested' || restarted.has(event.logoutId)) return;
  restarted.add(event.logoutId);
  window.location.reload(); // host-owned policy; BIS itself never reloads
});
const ui = createBisUi(context);
ui.mount(container); // host-owned positioned element; initially empty
ui.showAccountButton();
// The rendered Account button invokes context.openAccountDialog().
const unsubscribe = context.subscribe(() => console.log(context.getState().view));
// Admin UI only:
const adminContext = createBisAdminContext(context);
await adminContext.resetClient(); // explicit first-run reset; removes BIS account storage
// Host cleanup before replacement:
unsubscribeEvents();
unsubscribe();
ui.unmount();
context.dispose();
```

The demo rebuilds all handles after reset, clears selection, and leaves runtime content empty. `getState()` returns an immutable snapshot; `subscribe()` returns cleanup. `closeAccount()` restores the prior presentation. Mounting twice in the same container is idempotent; unmount before changing containers. Calling actions on a disposed context throws. `GameOverlay` remains a compatibility wrapper around the same UI.

The Account chooser enables Create Account and Restore Account. A3 uses twelve numbered word inputs, initially masked with one asterisk per character, with one Show checkbox and explicit Paste from Clipboard. Word-list and checksum validation gate Restore; successful Signet connection and durable saving return directly to Account. `openRestoreAccount()` opens entry when logged out; recovery submission stays inside the private production UI/Core boundary. Creation uses the real Signet SDK with memory repositories; Continue commits encrypted identity to origin-scoped IndexedDB. Refresh before Continue forgets unfinished creation. The active Account menu shows Accounts Details, side-by-side Send/Receive/Swap, Log Out, and Back. Accounts Details opens a submenu containing Balance, Transactions, Assets, and Back. Each option returns to the submenu; its Back returns to Account. Balance shows identity/network and available/total balances with Refresh; A6 is implemented with manual storage verification pending. `ready()` awaits hydration, `createAccount()` and `continueAccount()` drive creation, and `onEvent()` exposes safe `accountConnected` and `accountDisconnected` payloads. Public state never contains the phrase or SDK types. Ordinary disposal preserves saved identity. Browser storage is test-only, automatically accessible to this origin, and does not protect against compromised same-origin code. Live deletion-based reset verification remains manual under the repository rules.

The active Account action opens Account Log Out. The backup checkbox is always required. When locally saved pending transfer, send, or mint operations exist, a second initially unchecked checkbox reads exactly `I accept losing my (5) pending transactions.` with the actual count. It is hidden for zero pending operations. `setLogoutPendingAcknowledged(boolean)` controls this additional gate; `logoutPendingCount` is null if counting fails, which blocks cleanup rather than assuming zero. The pending set is rechecked at confirmation and inside the cleanup lock.

Confirmed logout clears all BIS-owned account records from IndexedDB and all known BIS transfer/send/mint journals (including legacy and other-wallet journals), plus saved demo preferences from web storage. It invalidates local account state and requests host-owned restart, notifying other affected live BIS contexts with the same logout ID. The IndexedDB store retains only a monotonic generation and a non-secret logout receipt (ID, public profile ID and generation) to reject stale saves/notifications; saving a new account removes the receipt. No recovery material remains after cleanup. Other applications' storage is untouched. Current SDK wallets explicitly use in-memory repositories, so there is no BIS SDK database to erase. Submitted transactions are not cancelled, and restoring the same phrase does not restore discarded local recovery records. No operator request is needed. Active local wallet work prevents cleanup until it finishes; unreadable records or cleanup failures retain an error rather than report success.

This supersedes the earlier preserve-transfer-journal logout behavior and unresolved-send logout prohibition. Admin Reset and spending guards are unchanged. Ordinary refresh still preserves remembered account access and operation journals; preview scale and split layout now reset to defaults. Production cleanup is user-triggered; verification uses isolated storage doubles, not the live wallet.

Run core tests from the repository root: `node --test BIS/packages/integration/tests/*.test.mjs` (Node 24+). A real-storage plain-host browser fixture is available at `/tests/ui-host.html`. `/tests/logout-host.html` and its `?plain` mode provide explicitly isolated storage-double component checks; they are not part of the production demo. See `.openspec/changes/archive/2026-09-03-add-a6-account-logout/A6_VERIFICATION.md` for pending manual real-storage checks.

A4 exposes provider-neutral `state.balance` (idle/loading/ready/unavailable) and `refreshBalance()`. It requests fresh data on Balance entry or Refresh, clears amounts while loading or unavailable, and never persists balances. Network failure preserves account access. Closing, changing accounts, and disposal invalidate results. No timer drives UI refresh. See `.openspec/changes/archive/2026-09-03-add-a4-account-balance/A4_VERIFICATION.md`; funded Signet verification remains pending.

`openAccountDetails()` opens Balance. `state.accountDetails` distinguishes that page from Account. The UI preserves the Accounts Details submenu when returning from its pages; direct API entry returns to Account. Opening either menu never requests balances.

Admin context also exposes `fund1000Sats()` for explicit Signet test funding. It derives the active account's public Arkade address internally and submits it with amount 1000 to the official wallet's configured Signet faucet. It returns an acknowledgement message or rejects with a sanitized error; it does not expose recovery material, update balance state, or automatically retry. This is a demo/admin utility, not a production gameplay API.


## Transactions (A5)

Transactions appears below Balance in the Accounts Details submenu. It lists all SDK-provided incoming/outgoing history, including spent records, newest first. Rows match asset sizing: bold sats/direction, a status line and shortened ID line, without icons. Selecting a row opens Transaction Detail with the full selectable report and Copy; Back returns to the list. Copy all transactions exports every current row in displayed order, one line per record with full identifiers, supported status and exact asset quantities. Empty/loading lists disable it; clipboard failure exposes a selectable full export with retry.

Public context methods: openAccountActivity() and refreshActivity(); getState().activity exposes idle/loading/ready/unavailable and normalized transactions. accountActivity identifies the open route. Existing subscribe() delivers updates. refreshActivity() observes until the view is closed or its operation is cancelled; UI callers use it without awaiting the subscription lifetime. BisActivity and BisTransaction are public types with no SDK types or credentials.

History loads on entry, updates through SDK notifications and a 15-second reconciliation read, and clears on Back, account change, logout/reset, or disposal. A read-only wallet performs no payment or settlement. Copy is disabled without current transaction lines. See .openspec/changes/add-a5-inspect-activity/A5_VERIFICATION.md for live verification limits.

Receive (`openAccountReceive()`) displays the Arkade and Bitcoin addresses with copy controls and Refresh. Addresses load only in Receive and clear on leaving; `refreshBalance()` refreshes the data for the current Details or Receive page. D3a Send (`openAccountSend()`) opens the production Arkade-to-Arkade send flow. `getSendSpendable()` reads eligible asset-free funds; `quoteAccountSend(recipient, amountSats?)` prepares an exact review (omit amount for Max); `confirmAccountSend(issuedQuote)` explicitly submits that current review once; `checkAccountSend()` reads durable status without resubmission. Quotes expire after 60 seconds. The adapter validates checkpoint-linked inputs, recipient, change and zero-fee conservation, and records the transaction ID before network submission. Pending sends protect account clearing and other spending. Bitcoin destinations, Lightning, QR and fiat controls are not included. D5 transfer recovery is independent. Live payment acceptance remains pending; see [D3a verification](../../../.openspec/changes/add-d3a-address-sending/VERIFICATION.md).

D2a completes this address journey, including clipboard errors/manual selection, Refresh retry, navigation, and demo/plain-host verification. `state.invoiceReceiving` exposes a provider-neutral unavailable reason; the Lightning invoice section is hidden pending the [D2b reintroduction conditions](../../documentation/User%20Story%20Diagrams.md#d2b-receive-funds-using-lightning-invoices). No fee prompt, invoice generation, receipt processing, or invoice-specific Log Out/Reset guard is implemented by D2a. See [D2a evidence](../../../.openspec/changes/archive/2026-09-04-add-d2a-address-receiving/verification.md); live receiving remains D2b and account transfer remains D4.

## Account Transfer UI

Account Details now shows `totalSats` first, then `bitcoinSats` and `arkadeSats` side by side with Copy controls. `availableSats` remains in the public result for compatibility and spendability checks; it is not the full Arkade total. Bitcoin is SDK boarding total; Arkade is total minus boarding.

`openAccountTransfer()` opens the active account's production transfer screen; `accountTransfer` reports that presentation. Back returns to Account Details with a fresh balance read. Both directions support eligibility-based Max, quote review and explicit confirmation through `quoteAccountTransfer`, `confirmAccountTransfer` and `checkAccountTransfer`. Review never submits funds. Unresolved journal records block further transfers and account clearing. Status exposes the recorded phase, public operation IDs, sanitized interruption category and verification availability; Check Status never signs or retries a transfer. Submission allows time for the operator's advertised session. Actual bidirectional completion remains unverified; see [transfer verification and recovery](../../../.openspec/changes/add-bitcoin-boarding-settlement/BOARDING_VERIFICATION.md).
D5a read-only transfer recovery: pending Account Transfer offers **Recovery details**, a selectable public-status report and **Copy recovery details**. Clipboard failure provides manual-copy guidance. The report omits secrets, raw errors, addresses and balances, and nothing is sent to support automatically. Existing status/clearing guards are unchanged. D5b actual cancellation remains separately blocked by operator feasibility; copying does not unlock an account.

## Asset minting and listing

### Runtime asset inspection

The Accounts Details submenu includes **Assets** immediately below Transactions. `context.openAccountAssets()` opens the production list and `context.refreshAssets()` reads fresh holdings. Public state exposes `accountAssets` and `assets: BisAssets` (`idle`, `loading`, `ready`, or `unavailable`). Calling `listAssets()` directly remains UI-independent.

Selecting a holding opens **Asset Detail** with exact quantity, the metadata icon image, a single-line full Asset ID with Copy, and a **Details** heading with Copy above Name/Ticker/Decimals. HTTPS icons use no referrer; missing, invalid or failed images use neutral artwork. Back restores list selection, scroll and focus. Refresh clears old values and has a 30-second deadline. Missing decimals display base units. Leaving the flow or changing accounts invalidates presentation reads without cancelling independent API callers. Supply and verification badges remain absent.

**Burn**, above Back, opens the reusable **Confirmation** dialog: **Are you sure?**, **OK**, **Cancel**. OK burns the entire selected owned quantity; Cancel or Escape does nothing. `context.burnAsset({operationId, assetId, quantity})` accepts an exact base-unit string and returns `BisBurnAssetResult`. It rechecks holdings, uses existing wallet mutation locks, and journals intent before SDK submission. Completed same-operation retries are idempotent; uncertain submission remains pending and blocks new spending. There is no automatic retry or burn reconciliation. Success refreshes Assets; pending burns count toward logout warnings. Tests use controlled SDK/browser fixtures; no live asset was burned for verification.

### Mint and list APIs

The UI-independent public API is `context.mintAsset({ operationId, name, ticker, amount, decimals, iconUrl? })`, `context.listAssets()`, and `context.getPendingAssetMint()`. Use a fresh operation ID for an intentional new mint and reuse the exact request for a retry. `validateMint(request)` provides the same form validation without a wallet operation.

Amount is a human-readable decimal string; returned quantity is a base-unit decimal string. BIS accepts positive, exact supply capped at unsigned 64-bit units and decimals 0–18; these are application input limits, not claimed protocol maxima. Control assets and reissuance are not exposed. All positive wallet assets are listed, including assets without BIS metadata. Listing returns optional icon URLs as text; runtime asset views render those images.

Minting uses the active wallet and its spendable Signet funds. Results are `minted`, `already-minted`, or a safe typed error; listing returns `success` with an assets array or an error. These calls never mount UI or change account navigation. No game-specific semantics exist in BIS.

A public local journal binds operation IDs to complete requests and survives ordinary refresh and Admin Reset; explicit complete logout erases it. Unresolved operations prevent new mints for that account. Same-origin wallet locking coordinates with transfers and account clearing; cross-device exactly-once behavior is not guaranteed. A registered unresolved transfer also blocks minting. An `already-minted` result records the prior issuance; call `listAssets()` for current ownership. Known accepted transaction IDs survive a later finalization failure and reconciliation. After abort or closure, SDK finalization may continue but journal writes stop; a later locked retry reconciles the original intent without resubmission.

The real Admin mint/list round trip passed on 2026-09-04 with SDK 0.4.67: the same wallet retained its externally minted Level 1 asset and received a distinct BIS-minted Level 1 asset, each quantity 1. The earlier transfer blocker was not reproduced or bypassed. [C1/C4 verification](../../../.openspec/changes/archive/2026-09-04-add-achievement-opportunities-and-collection/C1_C4_VERIFICATION.md) records public identifiers, reference-wallet comparison and isolated versus live evidence. Broad independent-spending/recovery changes remain separate.


## Pending Operation Dialog

Runtime pages render immediately underneath a host-scoped covering layer. Loading..., Creating..., Saving..., Restoring..., Sending..., Transferring..., Burning..., Checking... and Logging out... appear above the spinning bolt. The backdrop keeps the page inert while data, rendering and required images finish; Admin remains usable. There is no inline loading/progress/completion text.

Read failures retry once automatically with existing deadlines (Transactions 75 seconds per attempt, Assets 30 seconds; otherwise 30 seconds where missing). Final errors show only OK, closing the prompt and source page. Mutation submissions are never automatically repeated. Unconfirmed outcomes retain recovery records and show truthful feedback with OK. Burning... remains through holdings refresh; success reveals refreshed Assets without Asset burned. Background reconciliation does not open a loading prompt.

`/tests/pending-operation-host.html` exercises production components with delayed isolated reads and callbacks, including Burn/refresh, errors, source-page closure, lifecycle operations, keyboard containment and host sizing. It performs no live wallet mutations. See `.openspec/changes/archive/2026-09-04-add-pending-operation-dialog/verification.md` for results.


### B1 Request Continue

`context.requestContinue({operationId, sats, context: runId})` initiates one Signet sink payment. Use a stable, host-generated operation ID for each attempt and an opaque run/context string. Whole sats from 1,000 through 10,000 are accepted; invalid input throws before submission. The default Admin price is 1,000 sats, with exactly zero additional fee. A changed operator fee schedule, insufficient funds, or subdust change prevents payment.

The recipient is a freshly generated transient wallet. Its secret is never saved or activated, and the existing player remains logged in. `mechanism: 'sink-payment'` describes the result truthfully: this is not proof of Bitcoin destruction. D1 recipient-wallet management and D6 USD pricing remain deferred.

Only `status: 'succeeded'` means confirmed completion. `pending` means the outcome remains unknown; `failed` means preparation did not submit. Both promise results and `getContinueStatus(operationId?)` retain the original profile, amount and run context. A submitted payment is never automatically retried. Reuse the same ID to reconcile or retrieve the original result; changed amount/context is rejected. A confirmed pre-submission failure also keeps its ID; start a deliberately new attempt with a new ID after resolving the cause.

```ts
const request = { operationId: crypto.randomUUID(), sats: 1000, context: runId };
// Persist request in the host before calling. Do not generate a new ID on timeout.
const result = await bis.requestContinue(request);
if (result.status === 'succeeded' && result.context === currentRunId &&
    result.profileId === bis.getState().profileId && !handled.has(result.operationId)) {
  handled.add(result.operationId);
  // The host owns the continuation action and durable deduplication.
}
// Later/reload: await bis.getContinueStatus(request.operationId)
```

Continuation records live separately from ordinary sends and survive normal logout/reset. Unresolved or unreadable continuation state blocks spending and account clearing. Browser storage removal still destroys local recovery; this is client-side validation, not fail-safe or cheat-resistant game authorization. No entitlement or separate consume operation is stored. Account/network errors do not automatically open UI or fund the player.


B1 can spend SDK-eligible outputs carrying assets. It retains enough sat change and verifies an exact asset extension returning every original asset quantity to the player's change output; none may go to the sink. The quote fingerprint binds the input assets as well as sats. Pending recovery additionally checks the asset-free recipient and the expected player change (script, sats and complete asset manifest). Ordinary Account Send keeps its prior asset-free selection policy.

## Private UI composition

`FitTextButton` keeps the Send/Receive/Swap emoji and labels on one line, reducing their font size only when their available width requires it and restoring normal size when space returns.

Runtime components in `src/ui` remain private; hosts use `createBisUi` or `GameOverlay`. `AccountCard` owns the account frame and heading associations. `RecoveryPhrasePanel` provides the shared read-only Set/Get recovery display; Restore Account reuses `SeedWordsHeading`, the test-wallet warning and visibility/paste controls while retaining its own editable validated grid. Recovery sessions start hidden and reset on leaving, remounting or changing accounts. Recovery material never enters public state or component exports.

`FieldHeading`, `IconButton` and `CopyFieldLabel` compose inline controls. `CopyableValueField` serves addresses, balances and Asset ID; `CopyableTextArea` serves transaction and standalone transfer-report text. `useClipboardCopy` handles explicit writes, duplicate protection and obsolete feedback; callers retain their own success and manual-copy messages. Recovery keeps its successful copy checkmark for the current session. `ReviewDetails`, `formatSats` and `useQuoteExpiry` are shared by Send and Transfer, alongside the existing `AmountChooserRow`. Their wallet controllers remain separate.

Assets and Transactions retain their headings/copy icons and list space/scrollbars even when empty, without empty-state messages. Pending notices stay host-local, burn confirmation remains a native modal, and the separate public recovery-info popup retains its own document. Admin's `StoryAction` lives in the demo package; the demo does not import private runtime primitives. Shared CSS stays in the existing style export, with screen-specific sizing preserved.

Isolated regression fixtures include `/tests/ui-components-host.html` (clipboard races, expiry and Admin actions), `/tests/ui-demo-host.html` (real demo composition with an in-memory context at all preview scales), plus the recovery/copy/restore, address/balance, asset/activity, Send/Transfer and pending-operation hosts. Their isolated Run actions require no live wallet or payments; live buttons in older fixtures are separate and are not part of this verification.

## Independent game host

For optional host-defined rewards, use `createBisAssetCollection(context, { asset, successMessage })`. Supply mint metadata without an operation ID, call `refresh()`, subscribe to `getState()`, and bind explicit actions to `collect()`, `check()` and `acknowledge()`. Disable menu navigation while `busy`; dispose when leaving the host screen. Positive holdings match exact name/ticker/decimals regardless of icon version. This is a demo ownership policy, not issuer authentication. Uncertain submissions retain their request ID for explicit reconciliation. Only a confirmed receipt triggers the supplied success message with its result image through the shared toast UI. The game owns level catalogs, trophy presets and progression; X1 game-controlled issuance remains separate.

See the [BIS-to-game smoke runbook](../../documentation/SMOKE_TEST_BIS_TO_GAME.md) for the fixed package snapshot, Windows tunnels and acceptance sequence. Vite hosts consuming the development source export must configure `esbuild: { jsx: "automatic" }` and `optimizeDeps: { esbuildOptions: { jsx: "automatic" } }`; production consumes the built export. Hosts must handle `restartRequested` after confirmed logout, deduplicate its `logoutId`, and clean up event/state subscriptions, UI and context on teardown. The library no longer reloads the browser. Ordinary Account close preserves stored access; different ports/hostnames use separate browser origins.

## Game pay-to-continue (B2)

Payment-success toasts show a lightning logo to the left of the message. This uses the optional `icon: 'lightning'` toast option and requires no external artwork request.

`getContinuePriceSats()` supplies the fixed 1000-sat demo price. Use `createBisContinue(context, { context: uniqueLossId, onSuccess })` once per defeat. Read `controller.getState()` and subscribe to changes for `sats`, `canPay`, `status` and `message`; `pay()` initiates the payment once. While `status === 'pending'`, disable Pay and Restart. BIS reconciles automatically and never converts a read error or timeout into failure. A definitive failure permits a deliberate retry. The lower-level B1 API remains available and compatible.

After confirmed success the controller sends `User paid 1000 sats to continue` through the shared toast UI and invokes `onSuccess(result)` once, only for the original account. Keep `createBisUi` mounted in a transparent, pointer-pass-through host outside Account so the toast is visible during gameplay. The host owns revival and must dispose the controller when its loss/session is abandoned. Disposal cannot cancel a submitted payment or refund it. Old journal results never grant continuation to a new controller or session.

The stealth game shows a left lightning icon, dynamically inserts the BIS price into `Pay 1000 Sats To Continue`, and places `Restart Game` below. Logged-out Pay is always greyed out. Success replaces the defeated player through the same row/column spawn function used at level start, preserving its position and loadout with full health and fresh rendering/input. It removes enemies in the centered 3x3 grid cells before resuming; other state remains intact. See [B2 verification](../../../.openspec/changes/archive/2026-09-07-add-b2-game-pay-to-continue/verification.md).

## Native UI size (v0.12.0)

Mount BIS at 100% in a positioned host. Font sizes, spacing, controls and dialogs now use the approved compact dimensions directly; remove any temporary `scale(.8)` and `125%` host sizing. Account ID with full-value Copy appears only on Accounts Details. Host loading should use its blocking backdrop until BIS is ready.
