## MODIFIED Requirements

### Requirement: Import and retain an independent game wallet
Admin SHALL explicitly import a game wallet through one recovery-phrase text field and retain it in encrypted browser storage independently of the player. Import SHALL NOT activate or replace the player wallet or expose secrets in public state, logs or build artifacts. Invalid input SHALL leave storage unchanged. Importing a different game wallet SHALL retain previous identities and select the imported wallet. Re-entering a saved identity SHALL select it without duplication. There SHALL be no wallet dropdown. Importing or selecting the active Player Wallet identity as the Game Wallet SHALL fail with a clear explanation before it changes game-wallet storage or active state. The same revalidation SHALL occur when a pending Game Wallet selection completes or a Player Wallet changes while Game Wallet work is in flight. Reload SHALL restore the last-selected non-conflicting Game Wallet and fetch its current balance; a detected role conflict SHALL not activate that Game Wallet or alter the Player Wallet.

#### Scenario: Import and reload
- **WHEN** Admin imports a valid identity different from the logged-in player and reloads
- **THEN** the game wallet remains available and the player retains its own identity

#### Scenario: Player Wallet conflicts with Game Wallet import
- **WHEN** Admin imports or selects a Game Wallet identity whose public profile ID matches the active Player Wallet
- **THEN** BIS immediately reports the role conflict and retains the prior Game Wallet selection and Player Wallet unchanged
- **AND** no recovery material enters public state, logs, or artifacts

#### Scenario: Invalid import
- **WHEN** import is invalid
- **THEN** the operation fails without changing the selection or either wallet's storage

#### Scenario: Switch and return
- **WHEN** the operator imports wallet B after wallet A, then re-enters wallet A's recovery phrase
- **THEN** both remain retained and A becomes selected without duplication or stale balance results from B
