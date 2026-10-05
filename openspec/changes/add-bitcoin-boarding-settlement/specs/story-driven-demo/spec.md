## ADDED Requirements

### Requirement: D4 Account Transfer demonstration
Admin SHALL provide a D4 Account Transfer demonstration using the production public API and UI. It SHALL preserve the logged-out Account flow and SHALL identify unavailable transfer execution without simulating successful transactions. Documentation SHALL distinguish delivered presentation from pending live transfers and preserve unrelated story IDs.

#### Scenario: Active account demonstration
- **WHEN** Admin D4 is selected with an active account
- **THEN** Runtime Preview opens the production Account Transfer screen

#### Scenario: No account
- **WHEN** Admin D4 is selected without an account
- **THEN** the normal account entry opens without creating an account or moving funds
