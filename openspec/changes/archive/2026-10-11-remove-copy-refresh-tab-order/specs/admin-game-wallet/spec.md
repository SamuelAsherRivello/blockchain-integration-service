# Spec Delta

## ADDED Requirements

### Requirement: Game Wallet title refresh is skipped by sequential tab navigation
The Game Wallet refresh utility SHALL remain available and correctly labeled while being excluded from the browser's sequential tab order.

#### Scenario: Keyboard traversal in Game Wallet
- **WHEN** a player tabs through the configured Game Wallet view
- **THEN** focus does not stop on the circular refresh icon beside the title
- **AND** wallet values and the existing logout and Back actions remain reachable according to their existing contracts
