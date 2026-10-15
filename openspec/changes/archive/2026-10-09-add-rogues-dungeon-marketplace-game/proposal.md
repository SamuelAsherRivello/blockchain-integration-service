# Proposal

## Why

The Marketplace currently exposes only Stealth & Steel as a selectable game, which makes the catalog structure appear coupled to the only game that has been implemented. Add `Rogue's Dungeon` as a registered game identity now so the Marketplace can present the planned game's existence before its runtime, wallet, or equipment catalog is available.

The requested identifier is the exact `bisGameId` value `Rogue's Dungeon`; this intentionally preserves the user's supplied value even though the existing Stealth & Steel identifier uses lowercase kebab-case.

## What Changes

- Add `Rogue's Dungeon` to the Marketplace's game registry and selectable game filter.
- Keep the new game visible as a valid Marketplace selection even when it has no game implementation, wallet address, assets, or equipment entries.
- Keep the current Stealth & Steel catalog, inventory classification, prices, artwork, minting, burning, and trading behavior unchanged.
- Prevent the new game from being treated as a mintable catalog merely because its game identity is registered; no Rogue's Dungeon asset definitions or Admin mint batch are introduced by this change.
- Add focused tests for game visibility, empty-state behavior, and isolation from the existing Stealth & Steel issuance flow.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `marketplace-catalog`: The public Marketplace game selection expands beyond Stealth & Steel and must represent a registered game with no catalog or inventory without fabricating items or wallet availability.

## Impact

Marketplace UI and public catalog configuration will change, along with the shared game identity model only where needed to represent registered games. Admin marketplace issuance and shared Stealth & Steel equipment metadata remain unchanged. The change affects Marketplace tests and may require a small catalog type/API adjustment; it does not add a game repository, wallet, asset minting, or external service.
