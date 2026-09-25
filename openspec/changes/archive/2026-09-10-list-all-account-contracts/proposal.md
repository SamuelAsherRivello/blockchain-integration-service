## Why

The account Contracts page can receive a confirmed contract toast while the list appears empty. A confirmed claim or refund is still contract evidence for the account and must remain inspectable from the account ledger.

## What Changes

- Treat Account -> Contracts as a complete account contract ledger, not only an active-contract view.
- Keep terminal claimed, refunded and failed contracts visible with their final operation and financial status.
- Use the shared account collection list shell for Contracts so returned rows receive the same fixed list area and row styling as Assets and Transactions.
- Change the known-empty message to `No contracts.` so the page does not imply hidden active-only filtering.

## Capabilities

### Modified Capabilities

- `account-contracts`: Account contract list completeness and terminal-state presentation.

## Impact

Updates `BIS/packages/integration/src/ui/AccountContracts.tsx` and focused integration/demo tests. No wallet signing, storage, network, dependency or public-port changes.
