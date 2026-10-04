## Purpose

Provide test-only Admin controls for moving one verified equipment item from the Game Wallet to the Player Wallet and deliberately removing that exact Player-owned item afterward.

## ADDED Requirements

### Requirement: Fresh single-item Admin selection
The integration demo Admin Marketplace section SHALL present a selection of only freshly listed, chain-classified Stealth & Steel item holdings from the active Game Wallet. The selection SHALL identify the exact asset ID, full owned base-unit quantity, family, tier, price, and chain-provided icon URL, and SHALL select at most one holding at a time. Trophies, generic assets, malformed metadata, stale records, and items no longer owned by the active Game Wallet SHALL not be selectable. The control SHALL explain when a distinct active Player Wallet or Game Wallet is unavailable without starting a wallet operation.

#### Scenario: Admin selects a current catalog item
- **WHEN** both distinct wallets are active and a fresh Game Wallet read returns Shoes II plus a trophy
- **THEN** Admin can select the exact Shoes II holding and cannot select the trophy

#### Scenario: Selection is stale
- **WHEN** an item was selected and a fresh pre-submission read shows it is absent, changed, or no longer a classified item
- **THEN** Admin does not submit either test operation and requires a current selection

### Requirement: Explicit test-only delivery and cleanup controls
The Admin Marketplace section SHALL expose two separate controls labelled `Send Item to Player` and `Burn Item from Player` for the selected holding. Send Item to Player SHALL use the active Game Wallet as signer and the distinct active Player Wallet as recipient, deliver only the exact selected asset quantity, and carry no Marketplace price or sats payment. Burn Item from Player SHALL only be available after a fresh Player Wallet holding read proves that exact classified asset and quantity are owned by the Player Wallet; it SHALL require an explicit irreversible-operation confirmation before submission. The controls SHALL be test-only Admin composition and SHALL not appear on the standalone Marketplace or the game runtime.

#### Scenario: Admin delivers one selected item
- **WHEN** Admin explicitly chooses Send Item to Player for a freshly verified Dagger I holding
- **THEN** the Game Wallet signs delivery of that exact Dagger I holding to the current Player Wallet without quoting or transferring a Marketplace price
- **AND** non-selected Game Wallet assets are not delivered as part of that operation

#### Scenario: Admin cancels Player cleanup
- **WHEN** Admin opens Burn Item from Player and cancels the confirmation
- **THEN** no Player Wallet burn is submitted and the Player's holding remains unchanged

### Requirement: Truthful per-item operation state
Before each submission, the Admin workflow SHALL freshly revalidate the selected source or Player-owned holding, both active identities, their distinctness, and the intended recipient or burner. It SHALL persist the exact operation intent before the submission boundary and report only confirmed, pending/unknown, or safe error outcomes. A pending or unknown operation SHALL protect duplicate or conflicting work for that exact asset and direction, but SHALL not disable unrelated Admin interaction or independently safe operations for another item. The workflow SHALL offer reconciliation rather than automatically retrying an uncertain operation.

#### Scenario: Send acknowledgement is lost
- **WHEN** a selected Shield III delivery may have been submitted but no confirmed result is returned
- **THEN** Admin records and reports that exact delivery as pending or unknown without sending it again
- **AND** controls unrelated to that Shield III operation remain usable

#### Scenario: Wallet identity changes during preparation
- **WHEN** the Game Wallet or Player Wallet selection changes before an Admin delivery or Player burn reaches its submission boundary
- **THEN** the obsolete operation does not submit or become attributed to the replacement wallet

### Requirement: Atomic Marketplace boundary remains unchanged
These test controls SHALL not enable Marketplace Buy or Sell, create a listing, calculate a buy or sell price, or sequence a sats payment with an asset transfer. The standalone Marketplace SHALL continue to enable trading only through a proven atomic asset-for-sats exchange.

#### Scenario: Admin test delivery exists while atomic exchange is unavailable
- **WHEN** the Admin can deliver an item to the Player Wallet but atomic Marketplace exchange remains unavailable
- **THEN** Marketplace Buy and Sell remain disabled with their existing accurate explanation
