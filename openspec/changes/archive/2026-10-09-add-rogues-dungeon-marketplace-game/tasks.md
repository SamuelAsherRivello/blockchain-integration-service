# Tasks

## 1. Registered game configuration

- [x] 1.1 Replace the Marketplace's single-game catalog configuration with a typed registered-game collection that preserves the existing Stealth & Steel game-wallet address and adds the exact `bisGameId` `Rogue's Dungeon` without a wallet address; verify the JSON/configuration contains no private or recovery fields.
- [x] 1.2 Update Marketplace catalog tests to assert both registered games, the exact apostrophe-containing ID, the retained Stealth & Steel address, and the absence of an address or item list for Rogue's Dungeon; verify with `node --test BIS/packages/marketplace/tests/client/catalog.test.mjs`.

## 2. Marketplace selection and empty state

- [x] 2.1 Render game-filter options from the registered-game collection and make `Rogue's Dungeon` selectable without adding it to the equipment definition or mint catalog; verify the UI source and focused tests expose both display names.
- [x] 2.2 Make a selected registered game without a wallet or verified items show a truthful empty state and skip public inventory reads, wallet login requirements, minting, transfer, and trading operations; verify with focused Marketplace tests covering selection, empty state, and no inventory-reader call.
- [x] 2.3 Preserve the existing default Stealth & Steel selection, item filtering, active game-wallet override, and catalog rendering after switching between games; verify with the Marketplace catalog and browser-facing regression tests.

## 3. Issuance isolation and documentation

- [x] 3.1 Add regression coverage proving `bisMarketplaceItems`, `marketplaceItemMetadata`, and the Admin Marketplace mint batch still contain only the nine Stealth & Steel equipment items and never generate a Rogue's Dungeon mint request; verify with `node --test BIS/packages/integration-admin/tests/client/marketplace-catalog.test.mjs BIS/packages/integration-admin/tests/client/marketplace-mint-batch.test.mjs`.
- [x] 3.2 Update the Marketplace package product/readme documentation to describe registered games with empty pre-launch entries and explicitly distinguish game registration from catalog issuance; verify the links and documented behavior remain consistent with the implemented configuration.

## 4. Integration verification

- [x] 4.1 Run `npm run typecheck` and the relevant Marketplace/Admin test suites; verify no existing Stealth & Steel classification, minting, burning, or trading behavior regresses.
- [x] 4.2 Run `npm run build --workspace @bis/marketplace` and inspect the Marketplace route manually or with the existing browser checks; verify `Rogue's Dungeon` is selectable, displays the empty state, and does not initiate a wallet or asset operation.
