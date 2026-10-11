# Spec Delta

## ADDED Requirements

### Requirement: Balance title refresh is skipped by sequential tab navigation
The Account Balance refresh utility SHALL remain available and correctly labeled while being excluded from the browser's sequential tab order.

#### Scenario: Keyboard traversal in Account Details
- **WHEN** a player tabs through Account Details containing balance values
- **THEN** focus does not stop on the circular refresh icon beside the title
- **AND** balance values, copyable fields, and navigation actions retain their existing keyboard behavior
