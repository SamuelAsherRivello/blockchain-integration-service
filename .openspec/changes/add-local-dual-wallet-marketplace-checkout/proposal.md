## Why

The Signet proof of concept already lets an Admin mint the official Game Wallet's equipment and lets the standalone Marketplace read that wallet's public inventory. It cannot yet let one local operator log in as both distinct wallets, pay the listed sats, deliver the exact item, and then use it as player-owned equipment.

## What Changes

- Replace per-item static catalog publication with a small, public publisher configuration that identifies the official Game Wallet; the Marketplace derives available equipment dynamically from that wallet's fresh public Signet inventory and verified chain metadata.
- Add a single-browser, local dual-wallet checkout: an active Player Wallet pays the exact listed sats to the active Game Wallet, then that Game Wallet delivers the exact item to the Player Wallet.
- Make every checkout durable, item-scoped, and recoverable. It is a deliberately non-atomic Signet POC: after a confirmed payment, an interrupted asset delivery remains visibly pending and can be reconciled or retried; it must never be represented as a completed purchase until the Player owns the item.
- Enable Buy and Sell only for the locally logged-in, distinct Player and Game Wallet pair. No remote customer checkout, player-to-player market, server, solver, or automatic seller authority is introduced.
- Replace the sidebar's duplicate wallet-login controls with wallet status and a concise instruction area: Item Listing is enabled by default, and Enable Item Sales directs the operator to the existing upper-right Account flow for both roles.
- Surface the resulting player-owned equipment through the existing loadout boundary so the separately hosted game can activate it and apply its existing gameplay effects.

## Capabilities

### New Capabilities

- `local-marketplace-checkout`: Durable local two-wallet purchase and sell-back coordination for the Signet POC.

### Modified Capabilities

- `marketplace-catalog`: Make the official Game Wallet address the durable public configuration and derive listed availability from its live chain inventory.
- `marketplace-trading`: Replace the atomic-exchange-only gate with the explicitly local, recoverable dual-wallet POC boundary.
- `asset-api`: Expose exact verified asset delivery through the public Game Wallet and Player Wallet boundaries.

## Impact

- Affects `@bis/integration` asset-delivery and operation-recovery APIs, Game Wallet and Player Wallet controllers, and focused tests.
- Affects the standalone Marketplace catalog configuration, checkout state, Buy/Sell controls, and browser verification.
- Reuses the installed Arkade SDK and local browser persistence only; no custom service, solver, credential publication, release, or GitHub Pages deployment is included.
