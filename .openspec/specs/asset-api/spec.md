# asset-api Specification

## Purpose
Provide generic UI-independent asset minting and ownership queries for hosts, with exact quantities, safe retries, and no game-specific rules.

**Story status:** C1. Mint Asset ✓ — complete, confirmed by the user on 2026-09-09. Historical verification records retain their original coverage and limitations.

## Requirements

### Requirement: Mint through a UI-independent public API
BIS SHALL accept an operation ID, name, ticker, amount as an exact decimal string, decimals, an optional icon URL, an explicit source wallet, and an explicit destination wallet. It SHALL issue the corresponding positive base-unit supply using the source wallet's funding and signer, with no control asset or reissuance authority. If source and destination differ, it SHALL deliver the issued quantity from source to destination through the production asset-transfer boundary and SHALL report success only after both issuance and delivery are confirmed or safely reconciled. It SHALL preserve accepted text, reject invalid quantities without rounding, and return JSON-safe source, destination, asset identifier, transaction and exact base-unit quantity data on confirmed success. No asset/account UI SHALL open or change as a side effect.

#### Scenario: Mint and deliver an asset
- **WHEN** an active funded source wallet submits valid asset details with a distinct active destination wallet and issuance succeeds
- **THEN** the result identifies the source, destination, operation, minted asset, issuance outcome, delivery outcome, and exact base-unit quantity
- **AND** a subsequent fresh ownership query shows the quantity at the destination

#### Scenario: Mint an asset
- **WHEN** an active funded source wallet submits valid asset details and issuance succeeds
- **THEN** the result identifies the operation, source account, destination, minted asset, and exact base-unit quantity
- **AND** a subsequent fresh ownership query contains that asset at the destination

#### Scenario: Mint to the source wallet
- **WHEN** source and destination identify the same active funded wallet
- **THEN** the source funds issuance and retains the asset without a delivery transaction

#### Scenario: Invalid amount
- **WHEN** the amount is zero, negative, uses exponent notation, exceeds supported supply, or has excess decimal places
- **THEN** BIS returns invalid-input without submitting issuance or delivery

#### Scenario: Source or destination unavailable
- **WHEN** the source wallet is absent or spendable funds are insufficient, or a distinct destination wallet is absent or unusable
- **THEN** BIS returns the corresponding account-required, insufficient-funds, or destination-unavailable error without fabricated success or automatic funding

#### Scenario: Account or funding unavailable
- **WHEN** no source wallet exists, the source has insufficient spendable funds, or the selected destination is unavailable
- **THEN** BIS returns account-required, insufficient-funds, or destination-unavailable respectively without fabricated success or automatic funding

#### Scenario: Mint alongside an externally created holding
- **WHEN** the destination wallet owns an asset minted outside BIS and the source explicitly requests a new mint with the same metadata using eligible funding
- **THEN** successful issuance returns a new asset ID distinct from the external holding
- **AND** a fresh destination ownership query contains both holdings with their exact quantities and metadata
- **AND** matching names or tickers do not satisfy or suppress the new operation

### Requirement: Mint-operation retry protection
BIS SHALL bind each operation ID to its complete request, source account, destination account, and issuance/delivery phase. Repeating that operation SHALL NOT issue or deliver another asset. Reusing an ID with different inputs SHALL be rejected. Names and tickers SHALL NOT define uniqueness: separate intentional operations may mint distinct assets with identical metadata when independently funded. An unresolved issuance or delivery SHALL reserve and reconcile the relevant inputs until terminal evidence is available; independently funded new mints SHALL be permitted only when the adapter can enforce disjoint inputs, including fee inputs. An older pending record without complete source, destination, phase, or input evidence SHALL prevent new spending until that evidence or a terminal outcome is verified. Missing coordination or durable storage SHALL prevent submission.

#### Scenario: Repeat completed source-to-destination operation
- **WHEN** the caller retries a successfully completed issuance and delivery with the same operation identity and inputs
- **THEN** BIS returns the original completed result without another issuance or delivery

#### Scenario: Repeat completed operation
- **WHEN** the caller retries a successfully completed operation with the same source, destination, and inputs
- **THEN** BIS returns the original completed result without another issuance or delivery

#### Scenario: Independent mint with the same name
- **WHEN** a previous operation completed or has fully reserved inputs and the caller explicitly starts an independently funded new operation with identical metadata
- **THEN** it is a separate issuance and is not treated as already owned based on its name

#### Scenario: Interrupted issuance or delivery
- **WHEN** callers race or either phase may have submitted without a confirmed response
- **THEN** at most one same-origin operation runs for that source/destination pair
- **AND** an unresolved result returns outcome-unknown for the original operation without replaying either completed phase
- **AND** a separately identified operation cannot reuse inputs reserved by the unresolved phase

#### Scenario: Concurrent or interrupted mint
- **WHEN** callers race or a prior issuance or delivery may have submitted without a confirmed response
- **THEN** at most one same-origin submission runs for the source/destination operation
- **AND** an unresolved result returns outcome-unknown without replaying a completed phase

### Requirement: List all owned assets
BIS SHALL return every positive owned asset holding as JSON-safe records with asset ID and exact base-unit quantity, plus available name, ticker, decimals, and icon URL. It SHALL NOT require BIS or game-specific metadata. Missing optional metadata SHALL not hide a holding. Failed required reads SHALL return an error, not an empty or partial success. Successful empty ownership SHALL return an empty array. Restoration SHALL discover ownership from the wallet without requiring a local asset catalog.

#### Scenario: Assets from different sources
- **WHEN** a wallet owns BIS-minted and other assets, including assets without optional metadata
- **THEN** a successful list includes all positive holdings with accurate identifiers and quantities

#### Scenario: Empty versus unavailable
- **WHEN** the successful fresh query finds no assets
- **THEN** BIS returns an empty array
- **AND** provider or metadata-read failures instead return an unavailable error

#### Scenario: Restored identity
- **WHEN** the same identity is restored with fresh wallet repositories
- **THEN** its assets are listed without a browser-local asset catalog

#### Scenario: External-wallet interoperability
- **WHEN** the same identity owns an asset minted in the Arkade Signet wallet without BIS-specific operation metadata
- **THEN** BIS lists its asset ID, exact quantity, and available name, ticker, decimals, and icon URL without requiring a local mint record
- **AND** the external holding is not evidence of successful completion of a different BIS mint request

### Requirement: Account isolation and safe public output
Asset operations SHALL expose no recovery material, signing keys, raw SDK exceptions, or vendor-specific public types. Results SHALL identify the originating account and operation where known. Account changes/disposal SHALL prevent late pre-submission work from submitting and prevent results being attributed to another account. Submitted operations SHALL NOT be represented as cancelled merely because a client closes. Metadata SHALL be treated as untrusted text; listing SHALL not fetch icon URLs.

#### Scenario: Account change or timeout
- **WHEN** the account changes, the client is disposed, or the operation deadline expires before submission
- **THEN** late work cannot submit under the obsolete session
- **AND** a previously submitted operation remains subject to reconciliation

#### Scenario: Public console output
- **WHEN** a host serializes an asset result
- **THEN** it receives only JSON-safe public data and safe error messages

### Requirement: Generic asset metadata round-trips through the public API
The generic asset mint and listing boundaries SHALL support JSON-safe chain asset metadata without assigning game meaning inside the generic API. For each marketplace item, the round-tripped metadata SHALL preserve its game ID, asset type, stable catalog ID, equipment family, tier, integer sat price, and absolute HTTPS icon URL. Listing SHALL expose available metadata as untrusted JSON-safe public data and SHALL continue returning generic assets whose optional marketplace fields are absent.

#### Scenario: Mint and list a marketplace item
- **WHEN** H1 mints a valid Stealth & Steel item through the generic asset boundary and a fresh list succeeds
- **THEN** the listed asset contains the same game, item type, catalog identity, family, tier, price, and icon URL stored on-chain
- **AND** recognition can occur without a browser-local catalog-to-asset-ID mapping

#### Scenario: List a generic or trophy asset
- **WHEN** a fresh ownership read returns an asset without complete marketplace item metadata
- **THEN** the generic API still returns that holding and its available metadata
- **AND** it does not manufacture item classification fields

### Requirement: Marketplace metadata is validated before mutation
Marketplace metadata submitted for minting SHALL use the Stealth & Steel game ID, item asset type, a known stable catalog ID, one of Shoes, Dagger, or Shield, one of tiers I, II, or III, the matching approved integer sat price, and an absolute HTTPS icon URL. Invalid combinations SHALL be rejected before a wallet mutation.

#### Scenario: Price does not match catalog identity
- **WHEN** a marketplace mint request supplies a catalog ID with a different price than its approved value
- **THEN** BIS rejects the request without submitting issuance

### Requirement: Asset listings may carry truthful provenance
The public asset listing MAY expose optional source provenance fields for a holding, including a source or mint transaction ID and a mint operation ID, when those values are available from existing durable BIS records or wallet history. Provenance fields SHALL be JSON-safe public strings, SHALL belong to the same account and network as the holding, and SHALL not be required for generic or externally created assets.

The listing SHALL not manufacture provenance, expose recovery material or raw SDK diagnostics, or treat a locally matching name/ticker as evidence of a source transaction.

#### Scenario: Known BIS mint provenance
- **WHEN** a listed holding matches a completed BIS mint record with a transaction ID
- **THEN** the asset record may include that transaction ID and operation ID
- **AND** the values remain attributable to the same account and active network

#### Scenario: Unknown provenance remains safe
- **WHEN** a listed holding has no matching local mint record and wallet history does not provide a source transaction
- **THEN** the asset remains in the successful list with its available generic metadata
- **AND** no placeholder, guessed transaction, recovery data, or raw SDK error is emitted as provenance
