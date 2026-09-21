# Proposal

## Why

Assets currently have the desired compact collection window, but Assets, Contracts, and Transactions do not have one explicit shared contract for page height, list viewport, scrollbar visibility, and closed-row geometry. This makes the three account collections feel inconsistent and can hide the scrollbar when the list is short or empty.

## What Changes

- Give the shared Assets, Contracts, and Transactions list pages one explicit parent-card height matching the existing compact collection presentation.
- Reserve a fixed list viewport sized for exactly 3.5 shared item rows, regardless of whether the collection contains zero, one, or many items.
- Always render a persistent vertical scrollbar and stable scrollbar gutter for each collection list.
- Use one shared item width and height for asset, contract, and transaction rows, without changing their data, ordering, selection, detail, or action behavior.
- Add focused layout verification for equal card height, list viewport height, persistent scrollbar styling, and equal row geometry at narrow supported preview sizes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `account-assets`: Require the Assets list page and rows to use the shared collection dimensions and persistent scrollbar behavior.
- `account-contracts`: Require the Contracts list page and rows to use the same shared collection dimensions and persistent scrollbar behavior as Assets.
- `account-activity`: Require the Transactions list page and rows to use the same shared collection dimensions and persistent scrollbar behavior as Assets and Contracts.

## Impact

- Shared collection layout styles under `BIS/packages/integration/src/ui/overlay.css`.
- Shared list-frame behavior and/or class contract under `BIS/packages/integration/src/ui/ItemList.tsx` if needed to make the dimensions explicit.
- Focused browser/layout fixtures under `BIS/packages/integration-demo/tests/`.
- No public API, wallet operation, data model, dependency, or persistence changes.
