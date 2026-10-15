# Spec Delta

## ADDED Requirements

### Requirement: Assets title refresh is skipped by sequential tab navigation
The Assets title refresh utility SHALL remain available and correctly labeled while being excluded from the browser's sequential tab order.

#### Scenario: Keyboard traversal in Assets
- **WHEN** a player tabs through the Assets list or Asset Detail view
- **THEN** focus does not stop on the circular refresh icon beside the title
- **AND** asset rows, selectable details, burn/explorer actions, and Back remain reachable according to their existing contracts
