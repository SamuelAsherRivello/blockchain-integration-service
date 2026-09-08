# Demo application

Admin UI is a dark, lean navigator of implemented BIS demonstrations. Categories with no implemented stories are hidden. Initially nothing is selected and Runtime Preview UI is empty.

Choose **Account / Account Button** to render the production entry button or **Account / Account Dialog** to open Account directly. The Account summary lists A1-A6; creation, restoration, balances, activity, logout, receive, send, and transfer remain accessible through the production flow. Sections B-F also list their implemented story IDs beneath their headings. Both entry points use the existing production APIs. The Account Dialog opens the production Account dialogue for the actual stored state; none automatically creates an account. Create Account generates a real Signet identity, displays the private recovery phrase, and saves/activates only on Continue. Saved accounts survive reload and browser restart; the admin selection does not. The active Account menu contains Account Details, Transactions, side-by-side Send and Receive above Log Out, and Back. Receive displays both receiving addresses; Send is coming soon. Account Details contains identity/network, available/total sats, Refresh, Recovery Phrase and Back to Account, with no Log Out action. Balance failure hides old amounts; no balance cache is persisted. A4 funded Signet verification remains pending. Log Out opens an unchecked backup acknowledgement, shows failure with OK closing the failed page, and preserves the selected story on success. A3 restores account access through the production numbered grid, Show checkbox, paste, and BIP39 validation. Success returns directly to Account; network failure shows an operation error with OK. See `.openspec/changes/archive/2026-09-03-add-a3-account-restoration/A3_VERIFICATION.md`. A6 logout is implemented with manual storage verification pending; see `.openspec/changes/archive/2026-09-03-add-a6-account-logout/A6_VERIFICATION.md`.

Reset Client clears BIS account storage and transient state, recreates the session, clears selection, and leaves runtime content empty. It remains enabled for a saved account even without a selected story. Real deletion-based reset checks must be completed manually under the repository database rule; reset lifecycle tests use isolated in-memory doubles.

- `src/admin`: explicit story catalog and Admin UI controls.
- `src/preview`: a single 9:16 host container; no simulated game menus.
- `src/App.tsx`: selection, public context subscriptions, mounting and cleanup.
- `src/style.css`: dark demo page/navigation/frame styles only.

Runtime Preview UI uses only production factories and the public integration stylesheet. It must not duplicate production components or use admin controls. Admin UI observes production context first; `createBisAdminContext(context)` is the fallback for specific development operations.

Every new integration feature must have an Admin UI demonstration and a synchronized entry in `BIS/documentation/User Story Diagrams.md`. Catalog presence proves an available demonstration, not completion of every branch in the broader story.


Runtime Preview offers 1000%, 50% (default), and 25% content scale. The outer 9:16 frame stays fixed; a demo-owned DOM layer expands inversely and is transformed to fit. At 50%, BIS receives twice the layout width/height. Changing scale preserves the mounted UI and account state; integration styles remain unchanged.

## D2a Receive Funds

Account / Account Dialog opens production Receive when logged in, or the ordinary account chooser when logged out. Account creation/restoration remains explicit; afterward use the normal Receive button. Arkade and Bitcoin address Copy and Refresh remain usable. The Lightning invoice section is hidden while Signet receiving is unsupported. See [D2b reintroduction conditions](../../documentation/User%20Story%20Diagrams.md#d2b-receive-funds-using-lightning-invoices). No account, invoice, funding request, or payment is automatically created.

The isolated `/tests/receive-host.html` covers clipboard denial, exact copy, Refresh failure/retry, navigation defaults, and portrait layout. `/tests/ui-host.html` provides the independent public-API host. See [D2a verification](../../../.openspec/changes/archive/2026-09-04-add-d2a-address-receiving/verification.md). D2b live invoices/recovery/clearing guards, D3 sending, and D4 transfers are separate; this demonstration does not claim them complete.

## Admin test funding

Fund Signet Sats prepares the active wallet's Bitcoin boarding address and opens https://signetfaucet.com/. The site does not support URL address prefill, so the app attempts to copy the address and otherwise displays it for manual copying. Paste it into the faucet and complete its form yourself. This does not submit a funding request or change balances. On-chain funds require boarding before they are spendable for achievements.



## A5 Inspect Activity

Account / Account Dialog opens the production Account flow. Accounts Details > Transactions shows three-line operation/amount, network and identifier rows without icons; selecting one opens Transaction Detail. The Copy Transactions icon exports every current record in order with full direction, supported status, identifiers and exact asset quantities; detail Copy copies only the selected report. Clipboard failure offers selectable export text. Account ID appears only on Accounts Details. No account or transactions are seeded. The isolated tests/activity-host.html verifies 24-row Copy-all, exact asset quantities, clipboard fallback, compact layout, internal scrolling, errors and navigation. tests/activity-sdk.html performs read-only SDK inspection of the saved account and serializes bigint quantities exactly without displaying recovery material. Live outgoing, confirmed-state rendering and Copy-all were rechecked on 2026-09-08. The same-transaction live confirmation transition remains pending; see .openspec/changes/add-a5-inspect-activity/A5_VERIFICATION.md for current evidence.

D4 Account Transfer opens the production transfer UI for an active account and the normal account entry otherwise. Both directions support eligibility-based Max, quotes and explicit transfer confirmation, subject to unresolved-operation guards; live completion remains unverified. Account Details shows Total above Bitcoin/Arkade balances. Isolated checks: `/tests/transfer-host.html`.

D5a exposes **Recovery details** within the same pending transfer screen: inspect and explicitly copy a public-status handoff with manual-copy fallback. Nothing is sent and no transfer is cancelled. Isolated no-mutation checks: `/tests/recovery-report-host.html`. D5b actual cancellation is a separate feasibility-blocked proposal.
## C1 / C4 Assets

The Runtime Preview exposes **Account → Assets → Asset Detail** with metadata images, exact quantities, a single-line copyable ID and inline Details copy. Burn above Back opens **Confirmation / Are you sure? / OK / Cancel**. Only OK burns the entire selected holding. Success refreshes the list; unresolved submission is not automatically retried. This is separate from C4's console-only query. `/tests/account-assets-host.html` checks navigation, copying, images, refresh states, narrow layouts and confirmed burn outcomes using synthetic wallet callbacks; it never burns real holdings.

C1 Mint Asset opens a dark Admin-only modal with Destination (Player wallet or Game wallet), Name, Ticker, Amount, Decimals, optional Icon URL, and Control Asset fixed to None. Three quick-fill buttons provide Achievement: Level 1/2/3, tickers LVL1/2/3, amount 1, decimals 0 and the matching absolute GitHub Pages trophy icon URL. Each icon is a 64 by 64 transparent PNG with digit 1, 2 or 3 on the same pixel-art trophy. See [trophy assets and public URLs](public/assets/achievements/README.md). The initial form still has a blank optional Icon URL. Presets are editable examples and do not submit. Mint is explicit. The asset summary is form input, not proof of ownership.

C4 List Assets prints fresh generic wallet holdings to Console. Both actions use the public production context and leave Runtime Preview unchanged. Pending/results/errors are shown as public JSON. Console history is transient and bounded; refresh and successful Reset Client clear it. Game wallet is the default destination. The selected wallet funds and receives its own mint. Select either destination before resuming its pending mint; resuming restores the original request and locks its destination for status reconciliation. Missing wallets and failed pending-state reads prevent submission to that wallet. Admin uses the same production mint method as trophy collection; it does not veto a mint using a separate balance precheck. Actual funds and reservation failures are returned by production at the explicit Mint action. Neither destination falls back to the other.

The real Admin mint/list round trip passed in Chrome on 2026-09-04 for the reported wallet: a new Level 1 asset was minted and a fresh list returned both the externally minted trophy and the new BIS trophy, each quantity 1. The earlier registered-transfer blocker was not reproduced. See [C1/C4 evidence](../../../.openspec/changes/archive/2026-09-04-add-achievement-opportunities-and-collection/C1_C4_VERIFICATION.md) for public asset/operation IDs and the distinction between live and isolated checks. List Assets pending followed by success is ordinary request progress.

Development-only verification hosts: `/tests/asset-live-host.html` reads fresh holdings and retries an existing completed receipt without offering a new mint; `/tests/asset-ui-host.html` exercises the actual Admin/mint components with labeled isolated callbacks; `/tests/asset-console-host.html` checks the actual App Console with isolated account/storage and synthetic results. All are excluded from production build inputs. Browser checks cover responsive scrolling, keyboard focus restoration, immutable unresolved retries, Console retention/reset and preview isolation.

## D3a Send Funds

Admin **D3a Send Funds** opens the production Arkade-address Send flow for an active account or the usual account chooser when logged out. Recipient/Paste, sats/Max, exact fee review and explicit confirmation use public APIs. No accounts or payments are seeded. D5 recovery remains separate; existing spending locks are preserved. `/tests/send-host.html` is an isolated production-component fixture, not a live payment demonstration. Automated/browser checks pass; live sender/recipient acceptance remains pending.


## Pending Operation Dialog

Runtime pages render immediately underneath a host-scoped covering layer. Loading..., Creating..., Saving..., Restoring..., Sending..., Transferring..., Burning..., Checking... and Logging out... appear above the spinning bolt. The backdrop keeps the page inert while data, rendering and required images finish; Admin remains usable. There is no inline loading/progress/completion text.

Read failures retry once automatically with existing deadlines (Transactions 75 seconds per attempt, Assets 30 seconds; otherwise 30 seconds where missing). Final errors show only OK, closing the prompt and source page. Mutation submissions are never automatically repeated. Unconfirmed outcomes retain recovery records and show truthful feedback with OK. Burning... remains through holdings refresh; success reveals refreshed Assets without Asset burned. Background reconciliation does not open a loading prompt.

`/tests/pending-operation-host.html` exercises production components with delayed isolated reads and callbacks, including Burn/refresh, errors, source-page closure, lifecycle operations, keyboard containment and host sizing. It performs no live wallet mutations. See `.openspec/changes/archive/2026-09-04-add-pending-operation-dialog/verification.md` for results.


B1 **"Pay 1000 Sats To Continue" (Player->Game)** uses the shared public continuation controller and BIS-owned price. The literal quotes are intentional. Confirmed success reports the result in Console and shows **User paid 1000 sats to continue** in Runtime Preview through the production toast system. The button stays disabled during submission and pending reconciliation. A new deliberate click after a final result begins a new attempt; historical journals remain available through B1's status API and are not replayed as new gameplay rewards. This demo creates no death/revival gameplay or managed Admin wallet. `/tests/continue-host.html` is a test-only memory-isolated adapter fixture; it cannot send live funds.

### F. Game Wallet

Import the game wallet directly in Admin using its recovery phrase. Never put that phrase in an environment file, chat, GitHub Secret or build configuration. Imported wallets are retained separately from the player; re-enter a phrase to select a prior wallet. Reload restores the last selection. The F1. Game Wallet row shows Login, then Logout after import. Wallet Details and balance are beside F3. Details refreshes addresses and balances into the Admin console for inspection and manual copying. Logout deselects the wallet without deleting saved identities. No new funding button is provided.

Importing or restoring the selected F1 wallet automatically sets the demo's Continue recipient to its Arkade receiving address. B1 becomes available when that address is loaded and the player is logged in. Logout clears the demo recipient. Existing pending payments keep their original recipient. Admin can be closed while receiving.

In the local Vite admin, loading the selected wallet also saves only its public address to `src/game-wallet-public.json` and the sibling Stealth project's `STEALTH_STEEL/src/runtime/integration/game-wallet-public.json`. Both repositories must be present in their existing Bitcoin/BabylonJS folders. The console reports success or failure; F3 Details retries a failed save. Logout does not erase the project address. Stealth consumes this committed public configuration, with `VITE_BIS_GAME_WALLET_ADDRESS` as a fallback when it is empty. Rebuild and deploy Stealth to update GitHub Pages. The development-only save endpoint accepts same-origin localhost JSON requests; a published static admin cannot edit project files. No recovery phrase is sent to this endpoint or written to either configuration.


F3 shows the payment-usable balance left of Details, including 0. Arkade script events update it automatically while Admin is open, without a balance polling timer. Details retries after a disconnection. Bitcoin onchain changes alone are not subscribed by this Arkade event stream.

## F3 payments and notifications

F3 **Send 1000 Sats (Game->Player)** sends immediately from the imported F1 wallet to the active preview player. It disables without an eligible player/sender or while unresolved. `createBisGameWallet` exposes `canPayPlayer`, `payPlayer`, `hasPendingPlayerPayment`, and `checkPlayerPayment`; `BisContext.getPaymentRecipient()` resolves the active player's public recipient without opening Account.

Shared session notifications announce incoming sats and own transfers, with `(Pending)` followed by a final receipt, known sender ID or `Unknown User`, and a silent initial history baseline. Payment credentials remain inside integration. Browser test doubles are isolated under `tests/f2-payment.html`; live two-wallet Signet acceptance remains pending.


F3 appends **(Awaiting Balance)** for loading or insufficient payment funds. Other eligibility blockers retain their safeguards and appear separately from the button suffix. F2 uses live transaction evidence for boarding status.
