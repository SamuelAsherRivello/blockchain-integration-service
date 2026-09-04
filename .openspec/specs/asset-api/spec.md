# asset-api Specification

## Purpose
Provide generic UI-independent asset minting and ownership queries for hosts, with exact quantities, safe retries, and no game-specific rules.

## Requirements

### Requirement: Mint through a UI-independent public API
BIS SHALL accept an operation ID, name, ticker, amount as an exact decimal string, decimals, and an optional icon URL. It SHALL issue the corresponding positive base-unit supply to the active wallet using that wallet's funding, with no control asset or reissuance authority. It SHALL preserve accepted text, reject invalid quantities without rounding, and return a JSON-safe asset identifier and quantity on confirmed success. No asset/account UI SHALL open or change as a side effect.

#### Scenario: Mint an asset
- **WHEN** an active funded account submits valid asset details and issuance succeeds
- **THEN** the result identifies the operation, account, minted asset, and exact base-unit quantity
- **AND** a subsequent fresh ownership query contains that asset

#### Scenario: Invalid amount
- **WHEN** the amount is zero, negative, uses exponent notation, exceeds supported supply, or has excess decimal places
- **THEN** BIS returns invalid-input without submitting or rounding

#### Scenario: Account or funding unavailable
- **WHEN** no active account exists or spendable funds are insufficient
- **THEN** BIS returns account-required or insufficient-funds respectively without fabricated success or automatic funding

### Requirement: Mint-operation retry protection
BIS SHALL bind each operation ID to its complete request and account. Repeating that operation SHALL NOT issue another asset. Reusing an ID with different inputs SHALL be rejected. Names and tickers SHALL NOT define uniqueness: separate intentional operations may mint distinct assets with identical metadata when independently funded. An unresolved mint SHALL reserve all its inputs until reconciled; independently funded new mints SHALL be permitted only when the adapter can enforce disjoint inputs, including fee inputs. An older pending record without a complete input set SHALL prevent new spending until that set or a terminal outcome is verified; a missing asset alone SHALL NOT authorize resubmission. Missing coordination or durable storage SHALL prevent submission.

#### Scenario: Repeat completed operation
- **WHEN** the caller retries a successfully completed operation with the same inputs
- **THEN** BIS returns already-minted for the original asset without another issuance

#### Scenario: Independent mint with the same name
- **WHEN** a previous operation completed or has fully reserved inputs and the caller explicitly starts an independently funded new operation with identical metadata
- **THEN** it is a separate issuance and is not treated as already owned based on its name

#### Scenario: Concurrent or interrupted mint
- **WHEN** callers race or a prior operation may have submitted without a confirmed response
- **THEN** at most one same-origin submission runs and retries reconcile the original operation
- **AND** an unresolved result returns outcome-unknown for that operation without replay; it does not block a separately identified mint with enforced disjoint inputs

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

### Requirement: Account isolation and safe public output
Asset operations SHALL expose no recovery material, signing keys, raw SDK exceptions, or vendor-specific public types. Results SHALL identify the originating account and operation where known. Account changes/disposal SHALL prevent late pre-submission work from submitting and prevent results being attributed to another account. Submitted operations SHALL NOT be represented as cancelled merely because a client closes. Metadata SHALL be treated as untrusted text; listing SHALL not fetch icon URLs.

#### Scenario: Account change or timeout
- **WHEN** the account changes, the client is disposed, or the operation deadline expires before submission
- **THEN** late work cannot submit under the obsolete session
- **AND** a previously submitted operation remains subject to reconciliation

#### Scenario: Public console output
- **WHEN** a host serializes an asset result
- **THEN** it receives only JSON-safe public data and safe error messages
