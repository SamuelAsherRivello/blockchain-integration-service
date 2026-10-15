## ADDED Requirements

### Requirement: Exact asset delivery through the public boundary
The UI-independent asset API SHALL accept an operation ID, exact positive asset ID and base-unit quantity, and a distinct valid Signet Arkade recipient address to deliver one owned asset holding. It SHALL select and verify only sufficient current inputs, direct the requested asset quantity to that recipient, and preserve any non-selected assets as sender change. The API SHALL not attach a Marketplace price, infer a sale, or fabricate a zero-sats transaction where the Arkade protocol requires an asset carrier output; any required carrier value SHALL be treated and reported as protocol delivery mechanics rather than a trade payment. It SHALL return JSON-safe public operation, asset, recipient, and transaction evidence only.

#### Scenario: Deliver an exact item
- **WHEN** a caller delivers a freshly owned asset quantity of one to another valid Signet Arkade address
- **THEN** the recipient receives that exact asset quantity and the result does not describe a purchase, price, or sale
- **AND** another asset present in the selected inputs remains with the sender as verified change

#### Scenario: Invalid recipient or changed holding
- **WHEN** the recipient is the sender, has an invalid or mismatched Signet Arkade address, or a fresh holding read no longer matches the requested exact quantity
- **THEN** the API rejects before submission and does not alter either wallet

### Requirement: Durable exact-delivery recovery
Asset delivery SHALL durably bind an operation ID to its sender profile, recipient, exact asset ID, and exact quantity before submission. Repeating the same confirmed operation SHALL return its saved result without another submission; reusing its operation ID with different contents SHALL fail. A delivery that may have crossed the submission boundary without confirmed completion SHALL remain pending with its known inputs reserved, return an unknown outcome, and be reconciled from current source and recipient evidence without inferred success from a missing sender holding alone. Pending delivery SHALL block duplicate or conflicting use of its reserved asset/input set but SHALL not make unrelated UI or disjoint asset operations globally inert.

#### Scenario: Delivery outcome is uncertain
- **WHEN** the provider response is lost after the exact delivery was submitted
- **THEN** the operation remains recoverable and does not submit a replacement delivery
- **AND** a later reconciliation requires evidence consistent with the intended recipient and exact asset quantity before reporting confirmed success
