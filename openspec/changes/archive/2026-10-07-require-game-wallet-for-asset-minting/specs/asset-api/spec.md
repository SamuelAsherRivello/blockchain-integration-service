## ADDED Requirements

### Requirement: Read-only item support check
BIS SHALL expose a provider-neutral `hasItemSupport()` check for game hosts. It SHALL report true only when an active Player Wallet exists and the BIS item path is available in the current supported environment and network. It SHALL NOT require a selected Game Wallet, Game Wallet balance, or any Game Wallet operation. It SHALL be read-only and SHALL not mint, reserve, transfer, open UI, or mutate wallet state.

#### Scenario: Item support is available
- **WHEN** a Player Wallet is active and the BIS item path is available on the active supported network
- **THEN** `hasItemSupport()` returns true
- **AND** no Game Wallet is required or inspected for this result

#### Scenario: Item support is unavailable
- **WHEN** there is no active Player Wallet, the environment cannot safely coordinate item operations, or BIS item support is unavailable
- **THEN** `hasItemSupport()` returns false
- **AND** no Game Wallet setup is requested and no wallet mutation occurs

#### Scenario: Game Wallet changes do not affect item support
- **WHEN** the Game Wallet logs out, changes selection, changes network, or has insufficient currency while the Player Wallet and BIS item path remain available
- **THEN** `hasItemSupport()` remains true

## MODIFIED Requirements

### Requirement: Mint through a UI-independent public API
BIS SHALL accept an operation ID, name, ticker, amount as an exact decimal string, decimals, and an optional icon URL. Generic minting SHALL retain its existing caller-selected wallet semantics and SHALL NOT acquire a new global Game Wallet prerequisite. Admin-owned game items MAY be minted by the Admin/Game Wallet path, while player trophy ownership SHALL be established through the separate reward flow. BIS SHALL preserve accepted text, reject invalid quantities without rounding, and return a JSON-safe asset identifier and quantity on confirmed success. No asset/account UI SHALL open or change as a side effect.

#### Scenario: Mint an asset
- **WHEN** an active funded caller submits valid asset details and issuance succeeds
- **THEN** the result identifies the operation, account, minted asset, and exact base-unit quantity
- **AND** a subsequent fresh ownership query contains that asset

#### Scenario: Player item support does not require Game Wallet
- **WHEN** a game has an active Player Wallet but no selected Game Wallet
- **THEN** `hasItemSupport()` may return true when BIS item support is available
- **AND** item support does not create, submit, or reserve a mint

#### Scenario: Invalid amount
- **WHEN** valid wallet prerequisites exist but the amount is zero, negative, uses exponent notation, exceeds supported supply, or has excess decimal places
- **THEN** BIS returns invalid-input without submitting or rounding

#### Scenario: Account or funding unavailable
- **WHEN** the wallet selected for a generic mint is absent or its spendable funds are insufficient
- **THEN** BIS returns account-required or insufficient-funds respectively without fabricated success or automatic funding

#### Scenario: Mint alongside an externally created holding
- **WHEN** the active minting wallet owns an asset minted outside BIS and explicitly requests a new mint with the same metadata using eligible funding
- **THEN** successful issuance returns minted with a new asset ID distinct from the external holding
- **AND** a fresh list contains both holdings with their exact quantities and metadata
- **AND** matching names or tickers do not satisfy or suppress the new operation

### Requirement: Account isolation and safe public output
Asset operations SHALL expose no recovery material, signing keys, raw SDK exceptions, or vendor-specific public types. Results SHALL identify the originating wallet and operation where known. Wallet changes/disposal SHALL prevent late pre-submission work from submitting and prevent results being attributed to another wallet. Submitted operations SHALL NOT be represented as cancelled merely because a client closes. Metadata SHALL be treated as untrusted text; listing SHALL not fetch icon URLs.

#### Scenario: Account change or timeout
- **WHEN** the account changes, the client is disposed, or the operation deadline expires before submission
- **THEN** late work cannot submit under the obsolete session
- **AND** a previously submitted operation remains subject to reconciliation

#### Scenario: Public console output
- **WHEN** a host serializes an item or trophy result
- **THEN** it receives only JSON-safe public data and safe error messages
