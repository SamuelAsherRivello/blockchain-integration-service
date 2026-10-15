# Spec Delta

## ADDED Requirements

### Requirement: Catalog minting is independently recoverable per item
The Admin catalog workflow SHALL bind every catalog item to a stable operation identity, report per-item progress, and verify each item from fresh ownership evidence before publishing catalog success.

#### Scenario: Shoes I is unavailable
- **WHEN** Shoes I cannot be minted before submission
- **THEN** the workflow reports the exact item and safe reason, does not claim a complete catalog, and permits a later retry of Shoes I without changing already completed item identities

#### Scenario: One item becomes unknown
- **WHEN** a catalog mint may have crossed submission
- **THEN** only that item remains pending or unknown, its original operation is recoverable, and no replacement item is issued automatically

### Requirement: Authoritative metadata gates item publication
Marketplace publication SHALL require exactly one fresh classified holding per catalog identity with valid game, item type, family, tier, price, icon, and structured gameplay metadata.

#### Scenario: Legacy item lacks gameplay deltas
- **WHEN** a holding lacks required authoritative structured deltas
- **THEN** it is reported as migration-required or non-publishable and no gameplay effect is inferred from name, description, family, or tier
