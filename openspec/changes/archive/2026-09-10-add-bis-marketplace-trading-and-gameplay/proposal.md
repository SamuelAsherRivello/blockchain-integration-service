## Why

The public Marketplace needed truthful wallet-session access, verified game-item metadata, multiple player profiles, and reusable equipment selection before a game consumer could use those items. The completed slice delivers that BIS and Marketplace foundation while preserving a safe atomic-trade gate.

## What Changes

- Add Marketplace-specific Player Wallet and Game Wallet login through production BIS surfaces, session-only game-wallet inventory overrides, and player-owned item browsing.
- Gate Buy and Sell on a demonstrated Arkade atomic asset-for-sats exchange; when the installed SDK cannot prove that capability, keep both actions disabled with a precise reason and no sequential submission path.
- Publish and validate chain metadata, approved prices, and immutable chain-provided artwork URLs for the nine Stealth & Steel equipment assets.
- Add H1 catalog issuance/reconciliation and H2 safe item-scoped burn recovery through the separate active Game Wallet.
- Support multiple encrypted player profiles and profile-scoped, ownership-verified equipment selection in BIS Account Assets.
- Package the public Arkade-free integration boundary for the authorized Stealth & Steel consumer without a private source alias or Arkade dependency.

## Capabilities

### New Capabilities

- `marketplace-trading`: Same-browser two-wallet trading availability, including the truthful unsupported atomic-exchange gate.
- `equipment-loadout`: Account-scoped selection of no item or one owned catalog item per equipment family.

### Modified Capabilities

- `account-assets`: Recognize and manage marketplace equipment while retaining generic asset behavior.
- `account-entry`: Add saved-profile chooser and active-profile switching.
- `account-creation`: Add newly created accounts to the saved profile collection.
- `account-restoration`: Add restored accounts to the saved profile collection.
- `account-logout`: Remove only the selected profile while retaining other profiles and scoped state.
- `admin-game-wallet`: Restrict H1/H2 to the active, separate Game Wallet.
- `asset-api`: Carry validated public marketplace metadata through generic asset APIs.
- `asset-burning`: Support H2 item-scoped uncertain-outcome recovery.
- `marketplace-catalog`: Publish approved prices and chain-provided artwork URLs.
- `story-driven-demo`: Add H Marketplace and X multiple-player-profile Admin stories.

## Impact

- Affects `BIS/packages/integration`, `BIS/packages/integration-demo`, and `BIS/packages/marketplace`.
- Uses Signet and `@arkade-os/sdk` 0.4.71 with no custom service, custody, player-to-player trading, fabricated outcomes, or sequential asset/sats fallback.
- Produces the public package boundary consumed by the separately planned Stealth & Steel equipment work.
