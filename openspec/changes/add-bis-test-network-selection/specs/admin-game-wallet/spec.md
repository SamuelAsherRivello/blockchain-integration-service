## MODIFIED Requirements

### Requirement: Import and retain an independent game wallet
Admin SHALL require an explicit selected Signet or Mutinynet context before importing a Game Wallet through one recovery-phrase text field. It SHALL retain the wallet in encrypted browser storage scoped to that same selected network and independently of the Player Wallet. Import SHALL NOT activate or replace the Player Wallet or expose secrets in public state, logs, or build artifacts. Invalid input, unavailable diagnostics, or a reported/operator network mismatch SHALL leave storage unchanged. Importing a different same-network Game Wallet SHALL retain previous same-network identities and select the imported wallet. Re-entering a saved identity SHALL select it without duplication. There SHALL be no wallet dropdown. Importing or selecting an identity that matches the active Player Wallet, or any wallet that does not use the current Player Wallet network, SHALL fail with a clear explanation before it changes Game Wallet storage or active state. The same revalidation SHALL occur when pending selection completes, Player Wallet state changes, or a network switch begins. Reload SHALL restore only the last-selected non-conflicting Game Wallet for the selected network and fetch its current balance; a role or network conflict SHALL not activate that Game Wallet or alter the Player Wallet.

#### Scenario: Same-network import and reload
- **WHEN** Admin imports a Mutinynet Game Wallet different from the logged-in Mutinynet player and reloads without changing the network
- **THEN** the Game Wallet remains available and the player retains its own Mutinynet identity

#### Scenario: Cross-network import attempt
- **WHEN** Signet is selected and an import diagnostic resolves as Mutinynet
- **THEN** BIS rejects the Game Wallet import and retains the prior accepted selections unchanged

#### Scenario: Import and reload
- **WHEN** Admin imports a valid identity different from the logged-in player and reloads on the same selected network
- **THEN** the Game Wallet remains available and the player retains its own identity

#### Scenario: Player Wallet conflicts with Game Wallet import
- **WHEN** Admin imports or selects a Game Wallet identity whose public profile ID matches the active Player Wallet
- **THEN** BIS immediately reports the role conflict and retains the prior Game Wallet selection and Player Wallet unchanged
- **AND** no recovery material enters public state, logs, or artifacts

#### Scenario: Invalid import
- **WHEN** import is invalid
- **THEN** the operation fails without changing the selection or either wallet's storage

#### Scenario: Switch and return
- **WHEN** the operator imports wallet B after wallet A, then re-enters wallet A's recovery phrase on the selected network
- **THEN** both remain retained and A becomes selected without duplication or stale balance results from B

### Requirement: Player lifecycle preserves the game wallet
Player logout SHALL log out the active Game Wallet for the selected network as part of confirmed account cleanup. Admin's existing player reset SHALL retain its pending-operation protections and SHALL not activate, migrate, or cross-network a Game Wallet. Game-wallet state changes in another tab SHALL NOT change the active player. Existing pending-player-operation protections SHALL remain effective.

#### Scenario: Player logs out
- **WHEN** the player logs out with a same-network Game Wallet present
- **THEN** the Game Wallet is no longer inspectable or selected and its live subscription is stopped

#### Scenario: Cross-tab network switch
- **WHEN** another tab switches the selected network
- **THEN** Admin removes the prior-network Game Wallet from active presentation rather than displaying it as a wallet for the new network

#### Scenario: Cross-tab import
- **WHEN** another tab imports a same-selected-network Game Wallet
- **THEN** Admin can observe that wallet without replacing or logging out the player
