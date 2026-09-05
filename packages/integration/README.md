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

The Account chooser enables Create Account and Restore Account. A3 uses twelve numbered word inputs, initially masked with one asterisk per character, with one Show checkbox and explicit Paste from Clipboard. Word-list and checksum validation gate Restore; successful Signet connection and durable saving return directly to Account. `openRestoreAccount()` opens entry when logged out; recovery submission stays inside the private production UI/Core boundary. Creation uses the real Signet SDK with memory repositories; Continue commits encrypted identity to origin-scoped IndexedDB. Refresh before Continue forgets unfinished creation. The active Account menu shows Account Details, Transactions, side-by-side Send and Receive, Log Out, and Back. Account Details shows identity/network and available/total balances with Refresh and Back to Account; A6 is implemented with manual storage verification pending. `ready()` awaits hydration, `createAccount()` and `continueAccount()` drive creation, and `onEvent()` exposes safe `accountConnected` and `accountDisconnected` payloads. Public state never contains the phrase or SDK types. Ordinary disposal preserves saved identity. Browser storage is test-only, automatically accessible to this origin, and does not protect against compromised same-origin code. Live deletion-based reset verification remains manual under the repository rules.

The active Account action opens Account Log Out. The backup checkbox is always required. When locally saved pending transfer, send, or mint operations exist, a second initially unchecked checkbox reads exactly `I accept losing my (5) pending transactions.` with the actual count. It is hidden for zero pending operations. `setLogoutPendingAcknowledged(boolean)` controls this additional gate; `logoutPendingCount` is null if counting fails, which blocks cleanup rather than assuming zero. The pending set is rechecked at confirmation and inside the cleanup lock.

Confirmed logout clears all BIS-owned account records from IndexedDB and all known BIS transfer/send/mint journals (including legacy and other-wallet journals), plus saved demo preferences from web storage. It reloads the app and notifies other live BIS tabs to reload, discarding their UI and SDK memory. The IndexedDB database/object-store structure can remain empty; no account or coordination records remain. Other applications' storage is untouched. Current SDK wallets explicitly use in-memory repositories, so there is no BIS SDK database to erase. Submitted transactions are not cancelled, and restoring the same phrase does not restore discarded local recovery records. No operator request is needed. Active local wallet work prevents cleanup until it finishes; unreadable records or cleanup failures retain an error rather than report success.

This supersedes the earlier preserve-transfer-journal logout behavior and unresolved-send logout prohibition. Admin Reset and spending guards are unchanged. Ordinary refresh still preserves remembered account access and operation journals; preview scale and split layout now reset to defaults. Production cleanup is user-triggered; verification uses isolated storage doubles, not the live wallet.

Run core tests from the repository root: `node --test packages/integration/tests/*.test.mjs` (Node 24+). A real-storage plain-host browser fixture is available at `/tests/ui-host.html`. `/tests/logout-host.html` and its `?plain` mode provide explicitly isolated storage-double component checks; they are not part of the production demo. See `.openspec/changes/archive/2026-09-03-add-a6-account-logout/A6_VERIFICATION.md` for pending manual real-storage checks.

A4 exposes provider-neutral `state.balance` (idle/loading/ready/unavailable) and `refreshBalance()`. It requests fresh data on Account Details entry or Refresh, clears amounts while loading or unavailable, and never persists balances. Network failure preserves account access. Closing, changing accounts, and disposal invalidate results. No timer drives UI refresh. See `.openspec/changes/archive/2026-09-03-add-a4-account-balance/A4_VERIFICATION.md`; funded Signet verification remains pending.

`openAccountDetails()` navigates from the active Account menu. `state.accountDetails` distinguishes the two dialogs. `closeAccount()` returns from Details to Account before leaving to the host. The Account menu never requests balances.

Admin context also exposes `fund1000Sats()` for explicit Signet test funding. It derives the active account's public Arkade address internally and submits it with amount 1000 to the official wallet's configured Signet faucet. It returns an acknowledgement message or rejects with a sanitized error; it does not expose recovery material, update balance state, or automatically retry. This is a demo/admin utility, not a production gameplay API.


## Transactions (A5)

Transactions appears below Balance (the Account Details route). It lists all SDK-provided incoming/outgoing history, including spent records, newest first. Rows match asset sizing: bold sats/direction, a status line and shortened ID line, without icons. Selecting a row opens Transaction Detail with the full selectable report and Copy; Back returns to the list. Copy all transactions exports every current row in displayed order, one line per record with full identifiers, supported status and exact asset quantities. Empty/loading lists disable it; clipboard failure exposes a selectable full export with retry.

Public context methods: openAccountActivity() and refreshActivity(); getState().activity exposes idle/loading/ready/unavailable and normalized transactions. accountActivity identifies the open route. Existing subscribe() delivers updates. refreshActivity() observes until the view is closed or its operation is cancelled; UI callers use it without awaiting the subscription lifetime. BisActivity and BisTransaction are public types with no SDK types or credentials.

History loads on entry, updates through SDK notifications and a 15-second reconciliation read, and clears on Back, account change, logout/reset, or disposal. A read-only wallet performs no payment or settlement. Copy is disabled without current transaction lines. See .openspec/changes/add-a5-inspect-activity/A5_VERIFICATION.md for live verification limits.

Receive (`openAccountReceive()`) displays the Arkade and Bitcoin addresses with copy controls and Refresh. Addresses load only in Receive and clear on leaving; `refreshBalance()` refreshes the data for the current Details or Receive page. D3a Send (`openAccountSend()`) opens the production Arkade-to-Arkade send flow. `getSendSpendable()` reads eligible asset-free funds; `quoteAccountSend(recipient, amountSats?)` prepares an exact review (omit amount for Max); `confirmAccountSend(issuedQuote)` explicitly submits that current review once; `checkAccountSend()` reads durable status without resubmission. Quotes expire after 60 seconds. The adapter validates checkpoint-linked inputs, recipient, change and zero-fee conservation, and records the transaction ID before network submission. Pending sends protect account clearing and other spending. Bitcoin destinations, Lightning, QR and fiat controls are not included. D5 transfer recovery is independent. Live payment acceptance remains pending; see [D3a verification](../../.openspec/changes/add-d3a-address-sending/VERIFICATION.md).

D2a completes this address journey, including clipboard errors/manual selection, Refresh retry, navigation, and demo/plain-host verification. `state.invoiceReceiving` exposes a provider-neutral unavailable reason; the Lightning invoice section is hidden pending the [D2b reintroduction conditions](../../documentation/User%20Story%20Diagrams.md#d2b-receive-funds-using-lightning-invoices). No fee prompt, invoice generation, receipt processing, or invoice-specific Log Out/Reset guard is implemented by D2a. See [D2a evidence](../../.openspec/changes/add-d2a-address-receiving/verification.md); live receiving remains D2b and account transfer remains D4.

## Account Transfer UI

Account Details now shows `totalSats` first, then `bitcoinSats` and `arkadeSats` side by side with Copy controls. `availableSats` remains in the public result for compatibility and spendability checks; it is not the full Arkade total. Bitcoin is SDK boarding total; Arkade is total minus boarding.

`openAccountTransfer()` opens the active account's production transfer screen; `accountTransfer` reports that presentation. Back returns to Account Details with a fresh balance read. Both directions support eligibility-based Max, quote review and explicit confirmation through `quoteAccountTransfer`, `confirmAccountTransfer` and `checkAccountTransfer`. Review never submits funds. Unresolved journal records block further transfers and account clearing. Status exposes the recorded phase, public operation IDs, sanitized interruption category and verification availability; Check Status never signs or retries a transfer. Submission allows time for the operator's advertised session. Actual bidirectional completion remains unverified; see [transfer verification and recovery](../../.openspec/changes/add-bitcoin-boarding-settlement/BOARDING_VERIFICATION.md).
D5a read-only transfer recovery: pending Account Transfer offers **Recovery details**, a selectable public-status report and **Copy recovery details**. Clipboard failure provides manual-copy guidance. The report omits secrets, raw errors, addresses and balances, and nothing is sent to support automatically. Existing status/clearing guards are unchanged. D5b actual cancellation remains separately blocked by operator feasibility; copying does not unlock an account.

## Asset minting and listing

### Runtime asset inspection

The active Account menu includes **Assets** immediately below Transactions. `context.openAccountAssets()` opens the production list and `context.refreshAssets()` reads fresh holdings. Public state exposes `accountAssets` and `assets: BisAssets` (`idle`, `loading`, `ready`, or `unavailable`). Calling `listAssets()` directly remains UI-independent.

Selecting a holding opens **Asset Detail** with exact quantity, the metadata icon image, a single-line full Asset ID with Copy, and a **Details** heading with Copy above Name/Ticker/Decimals. HTTPS icons use no referrer; missing, invalid or failed images use neutral artwork. Back restores list selection, scroll and focus. Refresh clears old values and has a 30-second deadline. Missing decimals display base units. Leaving the flow or changing accounts invalidates presentation reads without cancelling independent API callers. Supply and verification badges remain absent.

**Burn**, above Back, opens the reusable **Confirmation** dialog: **Are you sure?**, **OK**, **Cancel**. OK burns the entire selected owned quantity; Cancel or Escape does nothing. `context.burnAsset({operationId, assetId, quantity})` accepts an exact base-unit string and returns `BisBurnAssetResult`. It rechecks holdings, uses existing wallet mutation locks, and journals intent before SDK submission. Completed same-operation retries are idempotent; uncertain submission remains pending and blocks new spending. There is no automatic retry or burn reconciliation. Success refreshes Assets; pending burns count toward logout warnings. Tests use controlled SDK/browser fixtures; no live asset was burned for verification.

### Mint and list APIs

The UI-independent public API is `context.mintAsset({ operationId, name, ticker, amount, decimals, iconUrl? })`, `context.listAssets()`, and `context.getPendingAssetMint()`. Use a fresh operation ID for an intentional new mint and reuse the exact request for a retry. `validateMint(request)` provides the same form validation without a wallet operation.

Amount is a human-readable decimal string; returned quantity is a base-unit decimal string. BIS accepts positive, exact supply capped at unsigned 64-bit units and decimals 0–18; these are application input limits, not claimed protocol maxima. Control assets and reissuance are not exposed. All positive wallet assets are listed, including assets without BIS metadata. Listing returns optional icon URLs as text; runtime asset views render those images.

Minting uses the active wallet and its spendable Signet funds. Results are `minted`, `already-minted`, or a safe typed error; listing returns `success` with an assets array or an error. These calls never mount UI or change account navigation. No game-specific semantics exist in BIS.

A public local journal binds operation IDs to complete requests and survives ordinary refresh and Admin Reset; explicit complete logout erases it. Unresolved operations prevent new mints for that account. Same-origin wallet locking coordinates with transfers and account clearing; cross-device exactly-once behavior is not guaranteed. A registered unresolved transfer also blocks minting. An `already-minted` result records the prior issuance; call `listAssets()` for current ownership. Known accepted transaction IDs survive a later finalization failure and reconciliation. After abort or closure, SDK finalization may continue but journal writes stop; a later locked retry reconciles the original intent without resubmission.

The real Admin mint/list round trip passed on 2026-09-04 with SDK 0.4.67: the same wallet retained its externally minted Level 1 asset and received a distinct BIS-minted Level 1 asset, each quantity 1. The earlier transfer blocker was not reproduced or bypassed. [C1/C4 verification](../../.openspec/changes/archive/2026-09-04-add-achievement-opportunities-and-collection/C1_C4_VERIFICATION.md) records public identifiers, reference-wallet comparison and isolated versus live evidence. Broad independent-spending/recovery changes remain separate.


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
