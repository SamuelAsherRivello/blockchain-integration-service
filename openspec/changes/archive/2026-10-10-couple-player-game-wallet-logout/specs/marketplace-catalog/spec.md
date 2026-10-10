# Spec Delta

## MODIFIED Requirements

### Requirement: Public game-wallet inventory lookup

The Marketplace SHALL use a logged-in Game Wallet public address only while an active Player Wallet session and an explicitly selected Game Wallet session both exist. A guest, logged-out, or Player-only Marketplace SHALL NOT use the registered game-wallet public address as an inventory source, display it as an active session wallet, or start a Game Wallet inventory lookup. When a successful Game Wallet Login exposes a public address different from the registered address, the Marketplace SHALL use that logged-in address as the active inventory source for the current browser session, refresh availability from it, and clearly distinguish it from the registered default. It SHALL NOT alter the deployed static catalog or claim that the override changes the official published game wallet. When the Marketplace has a Player Wallet session, it SHALL maintain a separate Player Wallet inventory result for the Player Wallet ownership tab. Game Wallet and Player Wallet reads SHALL be coordinated independently, and a failure or pending state for one SHALL NOT prevent the other wallet's usable result from rendering. A fresh positive BIS Account Assets read for the active Player Wallet SHALL invalidate or supersede any older empty Marketplace Player Wallet result before the Player Wallet tab is rendered.

#### Scenario: Guest views the registered game wallet inventory

- **WHEN** a guest opens the Marketplace before any Player Wallet login
- **THEN** the Marketplace remains browseable using its public catalog data
- **AND** it does not display an active Game Wallet address or request Game Wallet inventory
- **AND** selecting Game Wallet ownership reports that a Player Wallet is required rather than showing the registered wallet's inventory

#### Scenario: Player-only login does not reactivate a retained Game Wallet

- **WHEN** a user logs out of the Player Wallet while a Game Wallet session is active, refreshes the Marketplace, and logs in only with the Player Wallet
- **THEN** the Marketplace reports the Player Wallet as active and the Game Wallet as not connected
- **AND** it does not use the prior Game Wallet identity, its address, or its prior inventory result until the user explicitly imports a new Game Wallet

#### Scenario: Player logout ends the game-facing wallet session

- **WHEN** the active Player Wallet is logged out while a Game Wallet identity or Game Wallet inventory result is present
- **THEN** the Marketplace removes the Game Wallet from its active game-facing wallet presentation
- **AND** it stops or invalidates Game Wallet inventory work and does not show the prior wallet's items as current
- **AND** retained Game Wallet identity storage is not treated as an active session until explicit Game Wallet login

#### Scenario: Game-wallet login uses a different address

- **WHEN** the user completes Game Wallet Login with an active Player Wallet and its public address differs from the registered address
- **THEN** the Marketplace refreshes inventory and trade context from the logged-in address for that browser session
- **AND** it retains the registered address as public catalog configuration and labels the session override accurately

#### Scenario: Ownership tabs use their corresponding wallets

- **WHEN** the user selects Game Wallet or Player Wallet ownership while a Player Wallet session is active
- **THEN** the Marketplace renders only the corresponding active wallet's owned items for that tab
- **AND** the selected tab does not wait for the unrelated wallet after its own inventory is ready or cached

#### Scenario: Logged-in Game Wallet inventory remains authoritative

- **WHEN** a logged-in Game Wallet public address differs from the registered address and the Player Wallet remains active
- **THEN** the Marketplace keeps the existing session override behavior
- **AND** it scopes the Game Wallet inventory cache to the logged-in wallet identity and active network

#### Scenario: BIS Assets confirms Player Wallet holdings

- **WHEN** the user opens Marketplace, opens Account, opens Assets, observes one or more positive Player Wallet holdings, closes BIS, and selects Player Wallet
- **THEN** Marketplace performs or uses a read associated with the same active Player Wallet and network
- **AND** the Player Wallet tab shows the verified marketplace items instead of an older empty result
- **AND** a Game Wallet read does not replace or clear those Player Wallet items
