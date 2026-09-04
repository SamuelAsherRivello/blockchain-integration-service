## Why

Owned assets can currently be listed through the public API and Admin Console, but players cannot inspect them in the runtime Account UI. Add the familiar Transactions-to-Transaction-Detail two-page interaction for Assets and Asset Detail, informed by the user's two Arkade wallet screenshots.

## What Changes

- Rename Account Activity to Transactions in the active Account menu and list heading. Use asset-sized transaction rows with a bold summary, status line and ID line, without icons. Add Assets immediately below Transactions.
- Selecting a row opens Asset Detail in the same production dialog. Back restores the list's selection, scroll position, and keyboard focus; Back from Assets returns to Account.
- Show name, exact owned quantity, ticker and the HTTPS metadata icon URL, with neutral fallback artwork. Asset Detail has a single-line selectable/copyable ID and a Details heading with inline Copy above Name/Ticker/Decimals.
- Load fresh holdings on entry and explicit Refresh, with bounded loading, distinct empty/unavailable states, and account/presentation isolation. Reuse the existing UI-independent listAssets API.
- Preserve Admin C4 List Assets as a console-only action and C1 Mint Asset as its separate Admin flow. Opening or copying assets performs no wallet mutation.
- Add Burn above Back with a reusable Confirmation dialog, Are you sure? body, and OK/Cancel. Only OK submits the selected owned quantity through the installed SDK burn API. Recheck ownership, coordinate existing wallet locks, persist submission intent and suppress duplicate or uncertain retries.
- Supply, verification, Import, Mint, Send, Receive, Reissue and Hide Icon remain outside the runtime asset flow. The screenshots are references; remote icons and Burn are explicitly authorized by the user's later iteration request.

## Capabilities

### New Capabilities
- `account-assets`: Runtime Assets and Asset Detail navigation, fresh ownership presentation, exact formatting, copying, and lifecycle behavior.
- `asset-burning`: Confirmed burning of a selected owned holding with exact amounts, durable submission state and wallet-operation coordination.
- `transaction-row-presentation`: Transactions naming and three-line rows matching asset row sizing.

### Modified Capabilities
- `account-entry`: Add the active-account Assets entry and replace its prior asset-view deferral with the new inspection flow.

## Impact

Implementation touches integration core, Arkade adapter, UI, CSS, public burn types, logout journal accounting and tests. The demo supplies isolated browser fixtures. No dependency, custom server or game-specific asset rule is added; SDK 0.4.67 already exposes AssetManager.burn.

This change is separate from add-achievement-opportunities-and-collection and its live mint acceptance. User invoked apply and subsequently authorized the UI/Burn iteration. Live destructive burn is not part of verification; use controlled SDK-boundary and browser fixtures.
