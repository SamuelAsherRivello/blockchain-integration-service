## Why

Marketplace currently queries game and player ownership, but its presentation path only recognizes equipment. It therefore omits a player's valid Stealth & Steel trophies, and a stale registered game-wallet address can make a successfully minted game inventory appear empty. Local Admin and Marketplace development also run on different origins (different ports), isolating browser-persisted BIS wallet sessions and making an Admin-selected game wallet unavailable to Marketplace.

This leaves the inventory view unable to truthfully answer the core question: which eligible assets are held by the active game wallet and which by the active player wallet on the selected network.

## What Changes

- Define a Marketplace-owned asset presentation model that renders verified Stealth & Steel equipment and verified trophies separately from equipment/loadout classification.
- Render equipment held by the active game wallet as game inventory and equipment plus trophies held by the active player wallet as player inventory. Trophies remain visible but never purchasable, sellable, or selectable as equipment.
- Make the public registered game-wallet inventory source explicit, fresh, and diagnosable; preserve a logged-in Game Wallet session as a clearly labelled same-session override without writing private material to the public catalog.
- Extend the Admin Marketplace diagnostics to expose only the active wallet's public address, selected network, and fresh catalog-inventory evidence needed to verify/update the public catalog anchor.
- Add one supported local preview command: a single Vite server serving Admin beneath `/admin/` and Marketplace beneath `/marketplace/` on one origin, so their browser-scoped wallet persistence is shared.
- Preserve independent GitHub Pages Admin and Marketplace delivery and immutable issued artwork URLs.

## Capabilities

### New Capabilities

- `marketplace-local-preview`: One-origin local Vite preview routes for Admin and Marketplace, including a documented run command and shared browser wallet-state behavior.

### Modified Capabilities

- `marketplace-catalog`: Truthful registered-game-wallet inventory lookup and public diagnostics for its network/address source.
- `marketplace-trading`: Marketplace inventory presentation that includes player trophies while retaining equipment-only trading safeguards.

## Impact

- Affected runtime UI: `BIS/packages/marketplace`, `BIS/packages/integration-demo`, and shared BIS asset classification/presentation boundaries as needed.
- Affected developer workflow: root/package scripts and Vite routing for a single local preview server.
- Affected tests: Marketplace ownership/filter rendering, trophy non-trading guards, active network/address selection, shared-origin persistence, and browser smoke coverage.
- No recovery phrase, signer, transaction payload, or other private wallet material will be added to the catalog, diagnostics, routes, or test artifacts.
