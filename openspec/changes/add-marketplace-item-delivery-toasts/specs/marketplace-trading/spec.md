# Spec Delta

## ADDED Requirements

### Requirement: Marketplace item-delivery status notifications

Marketplace SHALL emit one pending notification for an item-transfer leg involving the active Player Wallet only after its durable delivery record contains submitted transaction evidence, and one confirmed notification only after the existing reconciliation verifies the exact asset delivery and the checkout records that leg as confirmed. The notifications SHALL identify the transferred Marketplace item and SHALL be emitted by the active Player Wallet's BIS context whether that wallet is the sender or recipient. They SHALL apply to current purchase and sell-back legs and to any future Marketplace trade leg involving the Player Wallet, SHALL not treat checkout preparation or an unresolved result as delivery submission or confirmation, and SHALL not alter checkout recovery, inventory refresh, or payment processing.

#### Scenario: Player Wallet item transfer becomes pending
- **WHEN** a Marketplace item-transfer operation involving the Player Wallet has durable submitted transaction evidence but reconciliation has not yet verified the recipient's exact asset ownership
- **THEN** Marketplace emits one pending item-transfer notification for that checkout item
- **AND** the checkout remains pending and recoverable

#### Scenario: Delivery is verified
- **WHEN** a purchase, sell-back, or future supported trade asset-delivery operation involving the Player Wallet is reconciled with the exact recipient, asset identity, and quantity
- **THEN** Marketplace emits one confirmed item-transfer notification for that checkout item
- **AND** it records the corresponding delivery leg as confirmed without resubmitting the operation

#### Scenario: Game-only item movement
- **WHEN** a Marketplace item-delivery operation does not involve the active Player Wallet
- **THEN** Marketplace emits no player item-transfer notification for that operation

#### Scenario: Delivery preparation fails before submission
- **WHEN** item-delivery preparation fails before durable submitted transaction evidence exists
- **THEN** Marketplace emits neither an item-transfer pending nor confirmed notification
- **AND** it retains the existing truthful error or recovery presentation
