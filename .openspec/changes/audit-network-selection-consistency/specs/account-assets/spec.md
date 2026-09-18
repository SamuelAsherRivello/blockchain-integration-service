## ADDED Requirements

### Requirement: Asset operations retain selected-network context
Asset list, mint, burn, delivery, delivery reconciliation, and live ownership observation SHALL use the active account's verified test network. Asset recipient validation and user-visible error text SHALL identify the applicable selected test network without manufacturing a Signet-only restriction.

#### Scenario: Mutinynet asset delivery
- **WHEN** a Mutinynet wallet prepares an asset delivery or observes holdings
- **THEN** validation and provider reads use Mutinynet
- **AND** a Signet route, journal, or error label is not used as the active context
