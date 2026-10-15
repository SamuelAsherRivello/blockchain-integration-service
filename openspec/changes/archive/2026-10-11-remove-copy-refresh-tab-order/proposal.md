# Proposal

## Why

The browser-based BIS experience currently places small utility controls in the sequential keyboard tab order. Copy buttons and the circular refresh icon beside a view title are useful with a pointer but add noise to keyboard navigation, especially when a page contains several copyable fields. Removing those utility controls from sequential tab order will keep focus movement centered on content, inputs, navigation, and primary actions while preserving the utilities' existing pointer behavior.

## What Changes

- Remove every shared BIS copy control from the sequential tab order while preserving its accessible label, clipboard behavior, checked success state, and failure fallback.
- Remove the circular refresh icon beside dialog and collection titles from the sequential tab order while preserving its refresh action, disabled/loading state, accessible name, and visual feedback.
- Cover title refresh instances consistently, including Balance/Account views, Assets, Contracts, Transactions, Receive, and Game Wallet refreshes.
- Add browser-level or DOM-focused verification that copy and title-refresh controls have `tabIndex=-1` and that the remaining intended controls retain normal keyboard reachability.
- Keep paste, seed visibility, tooltip targets, text inputs, collection rows, Back and other workflow actions, scroll regions, and the split-pane resize handle in the tab order unless a later accessibility review identifies a separate issue.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `copyable-value-fields`: Copy controls remain usable and correctly announced but are excluded from sequential tab navigation.
- `account-activity`: The Transactions title refresh utility is excluded from sequential tab navigation while manual refresh remains available by pointer and programmatic action.
- `account-assets`: The Assets title refresh utility is excluded from sequential tab navigation while existing refresh behavior remains unchanged.
- `account-balance`: Balance refresh follows the shared title-refresh tab-order policy.
- `account-address-receiving`: Receive title refresh follows the shared title-refresh tab-order policy.
- `admin-game-wallet`: Game Wallet refresh follows the shared title-refresh tab-order policy.

## Impact

- Likely implementation area: shared React UI primitives in `BIS/packages/integration/src/client/ui-layer-react/IconButton.tsx` and call sites that render title refresh icons.
- Likely test area: integration and integration-admin browser/DOM acceptance fixtures covering copyable fields, balance, assets, activity, receive, and Game Wallet views.
- No public API, wallet behavior, clipboard content, visual styling, or refresh data contract should change.
- The change affects keyboard focus order only. The recommendation to keep paste, visibility, tooltip, navigation, list, input, scroll, and resize controls tabable is an explicit scope boundary, not an approval to change those controls.
