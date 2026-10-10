# Spec Delta

## MODIFIED Requirements

### Requirement: Player lifecycle preserves the game wallet

Player Wallet logout or an Admin Game Wallet reset SHALL deselect the active Game Wallet session and invalidate Game Wallet-owned pending, cached, subscription, and in-memory session state while preserving retained encrypted Game Wallet identities for a later explicit login. Player Wallet logout SHALL not be blocked by Game Wallet cleanup. Game Wallet logout alone SHALL not clear or change the Player Wallet. Game-wallet state changes in another tab SHALL NOT change the active player. Existing pending-player-operation protections SHALL remain effective.

#### Scenario: Player logs out

- **WHEN** the player logs out with a Game Wallet present
- **THEN** the Player Wallet and Game Wallet are both logged out as one local lifecycle transition
- **AND** the retained Game Wallet identity remains available for a later explicit login
- **AND** logging the Player Wallet in again does not reactivate the old Game Wallet

#### Scenario: Game Wallet logs out independently

- **WHEN** the user logs out only the Game Wallet while the Player Wallet is active
- **THEN** the active Game Wallet session and Game Wallet-owned local state are removed
- **AND** retained Game Wallet identities remain available for a later explicit login
- **AND** the Player Wallet remains active and its state is unchanged
- **AND** a later Game Wallet login requires a fresh explicit import

#### Scenario: Cross-tab import

- **WHEN** another tab imports the game wallet
- **THEN** Admin can observe that wallet without replacing or logging out the player
