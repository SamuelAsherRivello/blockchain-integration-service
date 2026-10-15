# Design

## Context

See `proposal.md` for motivation. The current Marketplace stores one public game ID and one registered game-wallet address in `public/catalog.json`; the UI hardcodes the only game filter option, while the shared integration package owns Stealth & Steel equipment definitions, metadata, classification, and Admin mint requests. The new game has no runtime or assets yet, so its registration must not be coupled to wallet or asset issuance behavior.

## Goals / Non-Goals

**Goals:**

- Represent multiple registered games in the public Marketplace configuration, with a display name and exact `bisGameId` for each entry.
- Register `Rogue's Dungeon` with no wallet address or equipment definitions and render a deterministic empty state when selected.
- Preserve the existing Stealth & Steel single-game catalog and Admin mint/verify/burn behavior.
- Keep public configuration free of signing material and avoid initiating network reads for a game with no inventory source.

**Non-Goals:**

- Creating the Rogue's Dungeon game, wallet, assets, artwork, prices, or gameplay metadata.
- Adding Rogue's Dungeon to `bisMarketplaceItems`, `marketplaceItemMetadata`, or the Admin mint batch.
- Changing the existing Stealth & Steel `bisGameId` or migrating previously issued assets.

## Decisions

### Use a registered-game collection in Marketplace configuration

Replace the single-game assumption in the Marketplace-facing catalog configuration with a collection of registered game records. Each record carries the exact game ID and display name; the game-wallet address is optional. The existing Stealth & Steel record retains its current public address. This makes an empty game a first-class selection without pretending it has a wallet or issued catalog.

Alternative considered: add a second hardcoded UI button and special-case it in filtering. Rejected because it would leave the public catalog model single-game and make future game registration repeat UI and loading special cases.

### Keep equipment identity and minting owned by the integration package

Do not generalize or append Rogue's Dungeon to the current equipment definition array. The existing Admin catalog is derived from `bisMarketplaceItems`, and its mint request writes the Stealth & Steel game metadata. Leaving that source unchanged is the simplest guarantee that registering a game does not make it mintable.

Alternative considered: add a generic empty equipment definition for Rogue's Dungeon. Rejected because an empty placeholder could accidentally enter issuance, classification, or verification paths.

### Suppress inventory reads when the selected game has no address

The Marketplace selects inventory configuration from the active registered game. If that record has no public game-wallet address, it returns an empty source with a clear unavailable/empty presentation and does not call the public inventory reader. Anonymous and logged-in Stealth & Steel behavior remains unchanged.

### Preserve the exact requested ID

Use `Rogue's Dungeon` exactly as the requested `bisGameId`, including capitalization and apostrophe. The implementation must treat the ID as data and avoid deriving identifiers by slugifying it. This is a deliberate exception to the existing `stealth-and-steel` naming style and should be covered by tests.

## Risks / Trade-offs

- [Risk] A future game may be added with a wallet address but no equipment definitions, creating ambiguous inventory behavior. → Mitigation: require an explicit catalog capability/record before enabling item classification or trading; test no-address and no-items states independently.
- [Risk] Existing tests assume the public catalog JSON has exactly three top-level keys. → Mitigation: update tests to validate the new registered-game shape while retaining the existing Stealth & Steel address and secret-field protections.
- [Risk] The exact apostrophe-containing ID could be normalized accidentally in URLs or metadata. → Mitigation: use exact-string assertions at configuration, selection, and empty-state boundaries.
