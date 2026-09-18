## MODIFIED Requirements

### Requirement: Public game-wallet inventory lookup

The Marketplace SHALL use the registered game-wallet public address for anonymous, read-only lookup of the catalog assets it currently holds on the selected network. A Marketplace Game Wallet Login SHALL NOT be required for that lookup. When a successful Game Wallet Login exposes a public address different from the registered address, the Marketplace SHALL use that logged-in address as the active inventory source for the current browser session, refresh availability from it, and clearly distinguish it from the registered default. The Marketplace SHALL identify the network and whether the shown game inventory came from the registered address or active session override. It SHALL distinguish a successful empty inventory from an unreadable inventory and SHALL NOT alter the deployed static catalog or claim that the override changes the official published game wallet.

#### Scenario: Guest views the registered game wallet inventory

- **WHEN** a guest opens the Marketplace before any wallet login
- **THEN** the Marketplace uses the published game-wallet public address for its selected-network read-only catalog inventory lookup
- **AND** the guest can see truthful available, empty, unavailable, or unreadable availability without providing a wallet credential

#### Scenario: Game-wallet login uses a different address

- **WHEN** the user completes Game Wallet Login and its public address differs from the registered public address
- **THEN** the Marketplace refreshes inventory and trade context from the logged-in address for that browser session and identifies it as the active session override
- **AND** it retains the registered address as public catalog configuration and labels the session override accurately

### Requirement: Game-wallet catalog batch issuance

BIS Admin SHALL provide an H. Marketplace section that is available only when the existing F. Game Wallet has an active selected wallet. H SHALL offer one explicit action to mint the complete nine-item Stealth & Steel catalog to that game wallet through the existing BIS asset-mint boundary. Each catalog record SHALL use a stable item identity and operation identity so a repeated or interrupted batch reconciles the original item issuance rather than minting a duplicate. H SHALL publish only verified public game ID, catalog item identity, asset ID, display metadata, quantity records, active network, and active game-wallet public address needed to verify Marketplace rendering; it SHALL not publish wallet recovery material, signing material, or private transaction payloads.

#### Scenario: Game wallet mints the catalog batch

- **WHEN** an Admin has selected a funded F. Game Wallet and explicitly starts the Marketplace catalog batch
- **THEN** H creates or reconciles exactly one intended issuance for each of the nine named catalog items on that wallet
- **AND** the standalone Marketplace receives public records only for items whose original issuance has a verified result

#### Scenario: Game wallet is unavailable

- **WHEN** no F. Game Wallet is selected or the selected wallet cannot mint an item
- **THEN** H prevents that item from being represented as minted in the public catalog and gives truthful unavailable or recovery feedback
- **AND** the public Marketplace remains browseable without the missing item being fabricated

#### Scenario: Administrator verifies the public inventory source

- **WHEN** the selected Game Wallet has minted or already holds Marketplace catalog items
- **THEN** H exposes its selected network and public address with fresh item evidence suitable for comparing to the published catalog configuration
- **AND** it exposes no recovery phrase, signing material, or private transaction payload
