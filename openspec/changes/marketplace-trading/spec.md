# Spec Delta

## ADDED Requirements

### Requirement: Marketplace actions require verified current item state
Buy, Sell, listing, and item-detail actions SHALL use a current classified holding, active wallet role, network, and operation state; invalid or stale inventory SHALL disable the affected action with a specific explanation.

#### Scenario: Metadata is invalid
- **WHEN** a visible holding fails authoritative marketplace classification
- **THEN** it is not offered for Buy, Sell, or equipment activation and the generic holding remains inspectable where supported

#### Scenario: Inventory is unavailable
- **WHEN** the selected wallet inventory cannot be freshly verified
- **THEN** Marketplace preserves pending or unavailable presentation and does not submit or simulate a trade

### Requirement: Checkout recovery remains item-scoped
An unresolved checkout or asset leg SHALL block only the exact item and operation identity involved, while disjoint inventory, browsing, and recovery actions remain usable.

#### Scenario: One item checkout is pending
- **WHEN** one item has an unresolved purchase or sell-back leg
- **THEN** that item's actions are disabled and other independently classified items remain browsable and actionable
