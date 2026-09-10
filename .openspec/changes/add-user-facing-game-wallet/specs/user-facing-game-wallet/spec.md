## Purpose

Provide a user-facing BIS-only way to choose a local game wallet for contracts when a game is running without an external Admin surface.

## ADDED Requirements

### Requirement: F2 Game Wallet Login is available in every BIS runtime
Every user-facing BIS host SHALL show `Game Wallet Login` in Account Details > Balance immediately below `Get Recovery Phrase`, whether or not a player wallet is active. This entry SHALL be F2. Game Wallet (User-facing), SHALL be available in the Runtime Preview and consuming games, and SHALL not expose the game wallet's balance, public addresses, boarding controls, or game-specific administration.

#### Scenario: Standalone game without Admin
- **WHEN** a player opens BIS from a consuming game that has no external Admin surface
- **THEN** the player can reach F2 from Account Details > Balance and no separate Admin route is required to configure the game wallet

#### Scenario: Player wallet is absent
- **WHEN** no player wallet is active
- **THEN** F2 remains reachable while ordinary gameplay and the existing player-account flow remain available

### Requirement: F2 creates, restores, and selects only the game wallet
An unconfigured F2 flow SHALL present Create Game Wallet and Restore Game Wallet. Creation SHALL show the same private recovery-material disclosure and explicit Continue commitment used for player-wallet creation before selecting the newly created game wallet. Restoration SHALL use the existing private recovery entry and validation behavior, but SHALL select only the game wallet and SHALL NOT activate, replace, or inspect the player wallet. Invalid, abandoned, or failed setup SHALL leave the prior selected game wallet unchanged.

#### Scenario: Create and commit a game wallet
- **WHEN** the user creates a game wallet and selects Continue on its private recovery screen
- **THEN** the created wallet becomes the selected game wallet without changing the player wallet or opening a boarding flow

#### Scenario: Restore a game wallet
- **WHEN** the user restores a valid supported game-wallet recovery phrase
- **THEN** the restored identity becomes the selected game wallet without changing the player wallet

#### Scenario: Failed setup
- **WHEN** F2 recovery validation or setup fails before commitment
- **THEN** F2 reports the safe failure and preserves the previous game-wallet selection

### Requirement: F1 and F2 share one local selection
F1. Game Wallet (Admin-facing) and F2. Game Wallet (User-facing) SHALL read and write the same game-wallet selection for the same browser profile and origin. The selection SHALL survive reload and synchronize across live same-origin BIS contexts without publishing recovery material. A change to this selection SHALL not activate, replace, or log out the player wallet.

#### Scenario: Admin-to-preview synchronization
- **WHEN** an Admin context selects a game wallet through F1 and the Runtime Preview uses the same browser origin
- **THEN** F2 observes that selected game wallet without a second import

#### Scenario: Separate deployed-game origin
- **WHEN** a consuming game runs on a different browser origin from Admin
- **THEN** its user configures its own local game-wallet selection through F2 and no cross-origin synchronization is claimed

### Requirement: F2 logout returns immediately to setup choices
When a game wallet is selected, activating F2 SHALL first offer `Log Out Game Wallet`. Confirmed logout SHALL deselect only the game wallet, preserve the player wallet, and without a page refresh immediately offer Create Game Wallet and Restore Game Wallet. F2 logout SHALL not expose retained recovery material or delete unrelated player state.

#### Scenario: Logout then restore without refresh
- **WHEN** the user confirms Log Out Game Wallet
- **THEN** the current F2 page immediately presents Create Game Wallet and Restore Game Wallet while the player wallet remains unchanged

### Requirement: Game-wallet replacement starts a clean G2 presentation session
F2 selection, replacement, or logout during a game run SHALL take effect at the next fresh run. BIS and the host SHALL discard the previous G2 run's active presentation state and contract history from the player-facing session rather than combine it with the newly selected game wallet. A replacement SHALL not interrupt ordinary gameplay, resume stale actions, or allow an old G2 action to be submitted under the replacement wallet.

#### Scenario: Replace during an active run
- **WHEN** the user selects a different game wallet while a G2 run has an unresolved offer
- **THEN** the active run continues without switching wallet mid-operation and the next fresh run begins with no visible G2 history from the replaced wallet

