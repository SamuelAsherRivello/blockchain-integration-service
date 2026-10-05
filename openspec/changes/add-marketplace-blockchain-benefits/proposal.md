## Why

The Marketplace landing page shows its shop-before-play message but does not explain the Web3 systems that make a game marketplace useful. Visitors need a concise, game-specific explanation they can open without starting a wallet or marketplace operation.

## What Changes

- Make the word `before` in the Marketplace lede an accessible control that opens a centered informational dialog.
- Add a distinct `Blockchain Benefits` dialog headed by `Marketplace`.
- List Marketplace, Account / Wallet, Assets, Contracts, and Payments as short Stealth & Steel examples of their value.
- Allow visitors to dismiss the dialog without affecting the item-detail dialog, catalog filters, wallet state, or trading state.

## Capabilities

### New Capabilities

- `marketplace-blockchain-benefits`: Provide a public, dismissible explanation of Web3 marketplace benefits in the Marketplace application.

### Modified Capabilities

- None.

## Impact

- Affects `BIS/packages/marketplace/src/App.tsx`, Marketplace visual styles, and catalog UI tests.
- Adds no wallet calls, transactions, dependencies, external requests, or API changes.
