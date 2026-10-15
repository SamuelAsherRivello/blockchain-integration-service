# Spec Delta

## ADDED Requirements

### Requirement: Transactions title refresh is skipped by sequential tab navigation
The Transactions title refresh utility SHALL remain available and correctly labeled while being excluded from the browser's sequential tab order.

#### Scenario: Keyboard traversal in Transactions
- **WHEN** a player tabs through the Transactions list or detail view
- **THEN** focus does not stop on the circular refresh icon beside the title
- **AND** transaction rows, report fields, workflow actions, and Back remain reachable according to their existing contracts
