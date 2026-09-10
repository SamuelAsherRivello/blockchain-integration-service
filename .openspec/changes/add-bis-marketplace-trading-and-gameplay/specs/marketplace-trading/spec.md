## Purpose

Provide an optional local two-wallet Marketplace demonstration of real player-to-game-wallet asset and sats transfers without a hosted service or player-to-player market.

## ADDED Requirements

### Requirement: Optional local wallet sessions
The Marketplace SHALL retain public catalog access without login. It SHALL provide Marketplace-specific Player Wallet Login and Game Wallet Login buttons for protected Buy, Sell, or My items actions. Each button SHALL open the existing BIS account UI for that role; BIS SHALL retain ownership of recovery entry, import, active-session state, and logout. A trade SHALL require both sessions in the same Marketplace browser and SHALL explain a missing session without starting or simulating a trade.

#### Scenario: Visitor requests a protected action
- **WHEN** a visitor chooses Buy or Sell before both wallet sessions are active
- **THEN** the Marketplace identifies the missing Player Wallet or Game Wallet session
- **AND** the public item view remains available with no submitted trade

#### Scenario: Marketplace opens BIS login
- **WHEN** a visitor selects Marketplace Player Wallet Login or Game Wallet Login
- **THEN** the applicable existing BIS account UI opens for the selected role
- **AND** the Marketplace does not present a second recovery or logout implementation

### Requirement: Registered and active game-wallet addresses
The Marketplace SHALL use the published registered game-wallet address for anonymous read-only inventory lookup. When Game Wallet Login yields a different public address, the Marketplace SHALL use it as the active inventory and counterparty address only for that browser session and SHALL label the override accurately.

#### Scenario: Logged-in game wallet differs from the registered wallet
- **WHEN** Game Wallet Login completes with a public address different from the catalog's registered address
- **THEN** the Marketplace refreshes its local trade context from the logged-in address
- **AND** it does not change the deployed catalog or claim that the registered address changed

### Requirement: Verified local player-to-game-wallet trading
Every purchase SHALL transfer the agreed sats from the active player wallet to the active game wallet and the agreed catalog asset to the player. Every sell-back SHALL transfer the agreed catalog asset from the player to the active game wallet and the agreed sats to the player. The Marketplace SHALL verify the two wallets, sats amount, asset identity, asset quantity, and recipients before calling an outcome confirmed; interrupted submissions remain pending or unknown until reconciled.

#### Scenario: Trade outcome is uncertain
- **WHEN** acknowledgement is lost after a trade submission might have occurred
- **THEN** the Marketplace presents the original operation as pending or unknown and offers reconciliation
- **AND** it does not issue a replacement asset, payment, listing, or credit

### Requirement: No player-to-player market
The Marketplace SHALL not create player listings, bids, recipient fields, player-to-player transfers, or claims of remote self-service trading. Sell means sell back to the active game wallet only.

#### Scenario: Player views an owned catalog item
- **WHEN** a player opens an owned catalog item in Marketplace
- **THEN** any enabled Sell action identifies the active game wallet as its counterparty
- **AND** no player listing or bid control is available
