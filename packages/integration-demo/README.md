# Demo application

Admin UI is a dark, lean navigator of implemented BIS demonstrations. Categories with no implemented stories are hidden. Initially nothing is selected and Runtime Preview UI is empty.

Choose **Account / Account Button** for entry, **Account / Create Account** for creation, **Account / Restore Account** for A3, **Account / Account Balance** for A4, **Account / Inspect Activity** for A5, or **Account / Log Out** for A6. A2, A3, A4, A5, and A6 open the production Account dialogue for the actual stored state; none automatically creates an account. Create Account generates a real Signet identity, displays the private recovery phrase, and saves/activates only on Continue. Saved accounts survive reload and browser restart; the admin selection does not. The active Account menu contains Account Details, Account Activity, side-by-side Send and Receive above Log Out, and Back. Receive displays both receiving addresses; Send is coming soon. Account Details contains identity/network, available/total sats, Refresh, Recovery Phrase and Back to Account, with no Log Out action. Balance failure hides old amounts; no balance cache is persisted. A4 funded Signet verification remains pending. Log Out opens an unchecked backup acknowledgement, supports failure/Retry, and preserves the selected story on success. A3 restores account access through the production numbered grid, Show checkbox, paste, and BIP39 validation. Success returns directly to Account; network failure offers Retry/Back. See `.openspec/changes/archive/2026-09-03-add-a3-account-restoration/A3_VERIFICATION.md`. A6 logout is implemented with manual storage verification pending; see `.openspec/changes/archive/2026-09-03-add-a6-account-logout/A6_VERIFICATION.md`.

Reset Client clears BIS account storage and transient state, recreates the session, clears selection, and leaves runtime content empty. It remains enabled for a saved account even without a selected story. Real deletion-based reset checks must be completed manually under the repository database rule; reset lifecycle tests use isolated in-memory doubles.

- `src/admin`: explicit story catalog and Admin UI controls.
- `src/preview`: a single 9:16 host container; no simulated game menus.
- `src/App.tsx`: selection, public context subscriptions, mounting and cleanup.
- `src/style.css`: dark demo page/navigation/frame styles only.

Runtime Preview UI uses only production factories and the public integration stylesheet. It must not duplicate production components or use admin controls. Admin UI observes production context first; `createBisAdminContext(context)` is the fallback for specific development operations.

Every new integration feature must have an Admin UI demonstration and a synchronized entry in `documentation/User Story Diagrams.md`. Catalog presence proves an available demonstration, not completion of every branch in the broader story.


Runtime Preview offers 100%, 50% (default), and 25% content scale. The outer 9:16 frame stays fixed; a demo-owned DOM layer expands inversely and is transformed to fit. At 50%, BIS receives twice the layout width/height. Changing scale preserves the mounted UI and account state; integration styles remain unchanged.

## D2a Receive Funds

Account / Receive Funds opens production Receive when logged in, or the ordinary account chooser when logged out. Account creation/restoration remains explicit; afterward use the normal Receive button. Arkade and Bitcoin address Copy and Refresh remain usable. The Lightning invoice section is hidden while Signet receiving is unsupported. See [D2b reintroduction conditions](../../documentation/User%20Story%20Diagrams.md#d2b-receive-funds-using-lightning-invoices). No account, invoice, funding request, or payment is automatically created.

The isolated `/tests/receive-host.html` covers clipboard denial, exact copy, Refresh failure/retry, navigation defaults, and portrait layout. `/tests/ui-host.html` provides the independent public-API host. See [D2a verification](../../.openspec/changes/add-d2a-address-receiving/verification.md). D2b live invoices/recovery/clearing guards, D3 sending, and D4 transfers are separate; this demonstration does not claim them complete.

## Admin test funding

Fund Signet Sats prepares the active wallet's Bitcoin boarding address and opens https://signetfaucet.com/. The site does not support URL address prefill, so the app attempts to copy the address and otherwise displays it for manual copying. Paste it into the faucet and complete its form yourself. This does not submit a funding request or change balances. On-chain funds require boarding before they are spendable for achievements.



## A5 Inspect Activity

Account / Inspect Activity opens the production Account flow. Account Activity opens its SDK-backed transaction text area; no account or transactions are seeded. The isolated tests/activity-host.html checks Copy-all, errors, lifecycle, and layout with explicitly labeled fixtures. tests/activity-sdk.html performs read-only SDK inspection of the saved account and never displays recovery material. Live confirmation and outgoing/spent evidence remain pending in .openspec/changes/add-a5-inspect-activity/A5_VERIFICATION.md.

D4 Account Transfer opens the production transfer UI for an active account and the normal account entry otherwise. Both directions support eligibility-based Max, quotes and explicit transfer confirmation, subject to unresolved-operation guards; live completion remains unverified. Account Details shows Total above Bitcoin/Arkade balances. Isolated checks: `/tests/transfer-host.html`.

D5a exposes **Recovery details** within the same pending transfer screen: inspect and explicitly copy a public-status handoff with manual-copy fallback. Nothing is sent and no transfer is cancelled. Isolated no-mutation checks: `/tests/recovery-report-host.html`. D5b actual cancellation is a separate feasibility-blocked proposal.
## C1 / C4 Assets

C1 Mint Asset opens a dark Admin-only modal with Name, Ticker, Amount, Decimals, optional Icon URL, and Control Asset fixed to None. Three quick-fill buttons provide Achievement: Level 1/2/3, tickers LVL1/2/3, amount 1, decimals 0 and the matching absolute GitHub Pages trophy icon URL. Each icon is a 64 by 64 transparent PNG with digit 1, 2 or 3 on the same pixel-art trophy. See [trophy assets and public URLs](public/assets/achievements/README.md). The initial form still has a blank optional Icon URL. Presets are editable examples and do not submit. Mint is explicit. The asset summary is form input, not proof of ownership.

C4 List Assets prints fresh generic wallet holdings to Console. Both actions use the public production context and leave Runtime Preview unchanged. Pending/results/errors are shown as public JSON. Console history is transient and bounded; refresh and successful Reset Client clear it. An unresolved mint reopens with the same request for status reconciliation.

The form and listing were verified in Chrome. Live issuance remains pending because the current account has an unresolved registered transfer; minting does not bypass this wallet guard.

## D3a Send Funds

Admin **D3a Send Funds** opens the production Arkade-address Send flow for an active account or the usual account chooser when logged out. Recipient/Paste, sats/Max, exact fee review and explicit confirmation use public APIs. No accounts or payments are seeded. D5 recovery remains separate; existing spending locks are preserved. `/tests/send-host.html` is an isolated production-component fixture, not a live payment demonstration. Automated/browser checks pass; live sender/recipient acceptance remains pending.
