# Spec Delta

## MODIFIED Requirements

### Requirement: Public game-wallet inventory lookup

The Marketplace SHALL use the registered game-wallet public address for anonymous, read-only lookup of the catalog assets it currently holds. A Marketplace Game Wallet Login SHALL NOT be required for that lookup. When a successful Game Wallet Login exposes a public address different from the registered address, the Marketplace SHALL use that logged-in address as the active inventory source for the current browser session, refresh availability from it, and clearly distinguish it from the registered default. It SHALL NOT alter the deployed static catalog or claim that the override changes the official published game wallet. When the Marketplace has a Player Wallet session, it SHALL maintain a separate Player Wallet inventory result for the Player Wallet ownership tab. Game Wallet and Player Wallet reads SHALL be coordinated independently, and a failure or pending state for one SHALL NOT prevent the other wallet's usable result from rendering. A fresh positive BIS Account Assets read for the active Player Wallet SHALL invalidate or supersede any older empty Marketplace Player Wallet result before the Player Wallet tab is rendered.

#### Scenario: Guest views the registered game wallet inventory

- **WHEN** a guest opens the Marketplace before any wallet login
- **THEN** the Marketplace uses the published game-wallet public address for its read-only catalog inventory lookup
- **AND** the guest can see truthful available, unavailable, or unreadable availability without providing a wallet credential

#### Scenario: Game-wallet login uses a different address

- **WHEN** the user completes Game Wallet Login and its public address differs from the registered public address
- **THEN** the Marketplace refreshes inventory and trade context from the logged-in address for that browser session
- **AND** it retains the registered address as public catalog configuration and labels the session override accurately

#### Scenario: Ownership tabs use their corresponding wallets

- **WHEN** the user selects Game Wallet or Player Wallet ownership
- **THEN** the Marketplace renders only the corresponding wallet's owned items for that tab
- **AND** the selected tab does not wait for the unrelated wallet after its own inventory is ready or cached

#### Scenario: Logged-in Game Wallet inventory remains authoritative

- **WHEN** a logged-in Game Wallet public address differs from the registered address
- **THEN** the Marketplace keeps the existing session override behavior
- **AND** it scopes the Game Wallet inventory cache to the logged-in wallet identity and active network

#### Scenario: BIS Assets confirms Player Wallet holdings

- **WHEN** the user opens Marketplace, opens Account, opens Assets, observes one or more positive Player Wallet holdings, closes BIS, and selects Player Wallet
- **THEN** Marketplace performs or uses a read associated with the same active Player Wallet and network
- **AND** the Player Wallet tab shows the verified marketplace items instead of an older empty result
- **AND** a Game Wallet read does not replace or clear those Player Wallet items
