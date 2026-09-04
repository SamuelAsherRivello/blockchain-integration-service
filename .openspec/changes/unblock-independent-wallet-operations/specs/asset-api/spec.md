## MODIFIED Requirements

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

