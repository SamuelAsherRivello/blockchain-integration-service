## ADDED Requirements

### Requirement: Admin Game Wallet observation follows the paired network
Admin Game Wallet balance, address, event-subscription, boarding, marketplace, and diagnostic operations SHALL use the same selected verified test network as the active paired Player Wallet. A changed, unavailable, or mismatched network SHALL stop the prior observer and disable or report the affected operation without altering either wallet identity.

#### Scenario: Game Wallet network switch
- **WHEN** an Admin Game Wallet observer is active and the selected test network changes
- **THEN** the old observer stops before any new-network state is presented
- **AND** it cannot publish a prior-network balance or event
