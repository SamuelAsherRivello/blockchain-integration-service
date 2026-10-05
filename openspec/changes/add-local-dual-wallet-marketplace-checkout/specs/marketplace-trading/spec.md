## MODIFIED Requirements

### Requirement: Optional local wallet sessions
The Marketplace SHALL retain public catalog access without login. It SHALL direct protected Buy, Sell, or My Items actions to the existing upper-right BIS Account button rather than presenting Marketplace-specific Player Wallet Login or Game Wallet Login controls. Account SHALL retain ownership of recovery entry, profile selection, import, active-session state, and logout. The Marketplace SHALL explain that the local POC requires a Player Wallet and a distinct Game Wallet in the same browser without starting or simulating a trade.

#### Scenario: Visitor requests a protected action
- **WHEN** a visitor chooses Buy or Sell before both wallet sessions are active
- **THEN** the Marketplace directs the visitor to the upper-right Account flow and identifies the missing Player Wallet or Game Wallet role
- **AND** the public item view remains available with no submitted trade

#### Scenario: Marketplace uses the existing Account flow
- **WHEN** an operator follows the Marketplace instructions for a protected action
- **THEN** the existing Account UI owns Player Wallet creation or restoration and its Developer → Game Wallet Login route owns distinct Game Wallet setup
- **AND** the Marketplace does not present a second recovery, profile, or logout implementation

#### Scenario: Marketplace opens BIS login
- **WHEN** a visitor follows the Marketplace instruction to use the upper-right Account button
- **THEN** the existing BIS Account UI opens and owns the applicable Player Wallet or Game Wallet login route
- **AND** the Marketplace does not present a second recovery, profile, or logout implementation

### Requirement: Trading is a local recoverable POC
Buy and Sell actions SHALL be enabled only for distinct, eligible Player Wallet and Game Wallet sessions held in the same Marketplace browser. Each direction SHALL use the durable local two-wallet checkout boundary and SHALL clearly identify that it is a non-atomic Signet proof of concept. The Marketplace SHALL not claim atomic settlement, remote self-service trading, a hosted seller, or a solver. If either wallet session, fresh asset ownership, price, or available funds cannot be verified, the relevant action SHALL remain unavailable with an accurate explanation while catalog browsing, wallet access, owned-item inspection, and equipment selection remain usable.

#### Scenario: Local POC prerequisites are unavailable
- **WHEN** the required local sessions, item ownership, or funds cannot be freshly verified
- **THEN** the relevant Buy or Sell action remains unavailable and identifies the unavailable prerequisite
- **AND** the independent catalog and equipment experiences remain usable

#### Scenario: Local POC prerequisites are verified
- **WHEN** the two distinct local sessions, the exact item, and its approved price are freshly verified
- **THEN** Marketplace enables the applicable Buy or Sell action for that item
- **AND** its submitted trade uses the recoverable local two-wallet path

### Requirement: Verified local player-to-game-wallet trading
Every purchase SHALL durably transfer the agreed sats from the active Player Wallet to the active Game Wallet before delivering the exact agreed catalog asset to the Player. Every sell-back SHALL durably deliver the exact agreed catalog asset from the Player to the active Game Wallet before transferring the agreed sats to the Player. The Marketplace SHALL verify the two wallets, sats amount, asset identity, asset quantity, and recipients before calling an outcome confirmed. Interrupted submissions SHALL remain pending or unknown until reconciled, and a completed first leg SHALL never be represented as a completed trade by itself.

#### Scenario: Purchase completes
- **WHEN** an eligible local purchase is confirmed
- **THEN** the active Player Wallet owns the purchased item and paid its approved sats price
- **AND** the active Game Wallet owns the received sats and no longer owns that item

#### Scenario: Trade outcome is uncertain
- **WHEN** acknowledgement is lost after a local trade leg might have occurred
- **THEN** the Marketplace presents the original operation as pending or unknown and offers reconciliation
- **AND** it does not issue a replacement asset, payment, listing, or credit
