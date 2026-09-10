## Why

BIS can mint generic Signet assets but has no public, game-specific place to discover them before a player has an account. The first marketplace slice establishes a real, static catalog and the issuer workflow needed to publish it without introducing trading, custody, or gameplay changes.

## What Changes

- Add a fifth `BIS/packages` workspace: a standalone React/Vite **BIS Marketplace** application. Milestone one is a bare public page that runs locally through Vite and requires no wallet, account, or market data.
- Deliver milestone two: a public Stealth & Steel catalog with exactly nine real, minted Signet items in a stable 3 by 3 grid: Shoes I/II/III for movement speed, Dagger I/II/III for player damage, and Shield I/II/III for damage reduction. A visitor can open details without login; Buy and Sell are disabled and truthful.
- Add **H. Marketplace** to BIS Admin. With the existing F. Game Wallet logged in, H mints or reconciles the nine-item batch to that wallet and records verified public catalog metadata keyed to the Stealth & Steel game.
- Publish the registered game-wallet public address with the static catalog. The Marketplace uses it for anonymous, read-only current-inventory lookup; no recovery phrase, private key, or signing material is published.

## Capabilities

### New Capabilities

- `marketplace-catalog`: Public React/Vite Marketplace foundation, the nine mint-backed game items, public game-wallet inventory lookup, item details, and H. Marketplace issuance.

### Modified Capabilities

None.

## Impact

- Adds `BIS/packages/marketplace` to the root npm workspace and an H. Marketplace area to the existing integration demo Admin UI.
- Uses React, TypeScript, Vite, existing BIS asset minting, and Signet only; deployment can be static GitHub Pages after the generated public catalog is included in the bundle.
- Does not introduce player login, player-to-player trading, game-wallet signing in Marketplace, loadouts, Stealth & Steel code changes, a custom application server, or fabricated transaction results. Those are deferred to `add-bis-marketplace-trading-and-gameplay`.
