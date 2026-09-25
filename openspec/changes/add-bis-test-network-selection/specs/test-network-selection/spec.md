## Purpose

Keep every BIS browser-only diagnostic operation on one explicitly selected, verified test network, without ever treating cross-network wallet or operator data as compatible.

## ADDED Requirements

### Requirement: Explicit origin-wide test-network choice
BIS SHALL support exactly Signet and Mutinynet and SHALL not offer Mainnet. Before a Player Wallet or Game Wallet create, restore, import, address derivation, or diagnostic read begins, the production UI SHALL present an explicit Signet/Mutinynet selection when no selection exists. A stored selection may be shown as selected, but every displayed wallet and diagnostic surface SHALL name the current network and offer a safe way to change it before a new login attempt begins.

#### Scenario: First Player Wallet entry
- **WHEN** a browser origin without a saved network selection opens Player Wallet creation or restoration
- **THEN** BIS presents Signet and Mutinynet before any wallet diagnostic or recovery-derived provider connection
- **AND** it does not silently choose a network or create a wallet

#### Scenario: Game Wallet entry after selection
- **WHEN** a user opens Game Wallet creation, restore, or Admin import after choosing Mutinynet
- **THEN** the flow identifies Mutinynet before recovery submission and uses no Signet label or endpoint

### Requirement: Verified network-specific diagnostic routing
For every selected network, BIS SHALL use that network's configured public operator, provider, and indexer routes for operator health, wallet login, address derivation, balances, activity, assets, onboarding, and contracts. Before treating an operator as available, BIS SHALL verify that its reported network exactly equals the selected network. A mismatch, malformed response, or unavailable proof SHALL produce a sanitized unavailable or mismatch result and SHALL NOT supply addresses, balances, activity, readiness, minting, or contract results as healthy.

#### Scenario: Mismatched operator
- **WHEN** Mutinynet is selected and the configured operator identifies itself as Signet
- **THEN** BIS reports a network mismatch and prevents the attempted diagnostic or wallet activation
- **AND** it does not present the Signet result as Mutinynet data

#### Scenario: Network-specific read
- **WHEN** a selected network's verified operator is available and an active wallet requests balance or activity
- **THEN** the result is labeled with that selected network and originates only from its configured network routes

### Requirement: Player and Game Wallet network cohesion
An active Player Wallet and active Game Wallet for the same origin SHALL have the same selected network as well as different public identities. BIS SHALL reject a create, restore, import, selection, reload, or delayed completion that would activate either wallet on a different network. It SHALL retain the accepted wallet state, expose a non-secret explanation, and never bridge account records, funds, addresses, assets, onboarding evidence, or contracts between Signet and Mutinynet.

#### Scenario: Cross-network Game Wallet attempt
- **WHEN** a Signet Player Wallet is active and a Mutinynet Game Wallet completion reaches its activation boundary
- **THEN** BIS rejects the Game Wallet activation without changing the Player Wallet or exposing recovery material

### Requirement: Network switch is a logout boundary
Changing the selected network SHALL cancel in-flight work, stop live subscriptions, and log out both active wallets before the new selection is committed. BIS SHALL clear active encrypted session selections and in-memory account, address, balance, activity, asset, onboarding, and contract state, then require new Player Wallet and Game Wallet login on the selected network. It SHALL not cancel submitted remote operations or claim that remote funds were removed.

#### Scenario: Switch from Signet to Mutinynet
- **WHEN** an origin with active Signet Player and Game Wallets selects Mutinynet
- **THEN** both wallets become logged out, existing live data disappears, and no Signet operation can complete into the Mutinynet session
- **AND** fresh Mutinynet wallet login is required before diagnostics resume

### Requirement: Non-secret preference and isolated browser state
Browser local storage SHALL retain only the non-sensitive selected-network preference for this capability. Encrypted wallet records, selection markers, cryptographic associated data, broadcast coordination, operation journals, and caches SHALL be scoped by network or cleared before a network change becomes observable. Recovery phrases, private keys, and wallet secrets SHALL never be written to local storage, public state, logs, URLs, analytics, Admin history, or verification artifacts.

#### Scenario: Reload after switching networks
- **WHEN** a user reloads after a successful network switch
- **THEN** BIS restores only the selected network preference and shows both wallets logged out
- **AND** it cannot read, display, or use encrypted state from the prior network as current state
