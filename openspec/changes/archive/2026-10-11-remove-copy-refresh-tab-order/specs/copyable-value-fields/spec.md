# Spec Delta

## ADDED Requirements

### Requirement: Copy utilities are skipped by sequential tab navigation
Every BIS copy control SHALL remain pointer- and programmatically operable while being excluded from the browser's sequential tab order.

#### Scenario: Keyboard traversal reaches a copyable field
- **WHEN** a player tabs through a view containing copyable values
- **THEN** focus moves to the value or other intended form controls without stopping on the adjacent Copy control
- **AND** the Copy control retains its accessible name and clipboard success and failure behavior when activated by a supported non-sequential interaction
