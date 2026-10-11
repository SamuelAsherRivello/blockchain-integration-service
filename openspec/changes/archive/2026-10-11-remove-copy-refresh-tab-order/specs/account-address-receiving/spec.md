# Spec Delta

## ADDED Requirements

### Requirement: Receive title refresh is skipped by sequential tab navigation
The Receive title refresh utility SHALL remain available and correctly labeled while being excluded from the browser's sequential tab order.

#### Scenario: Keyboard traversal in Receive
- **WHEN** a player tabs through the Receive view
- **THEN** focus does not stop on the circular refresh icon beside the title
- **AND** address fields, copyable values, and Back remain reachable according to their existing contracts
