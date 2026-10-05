# Spec Delta

## MODIFIED Requirements

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
