# Spec Delta

## ADDED Requirements

### Requirement: Marketplace item-delivery toast content and payment independence

Marketplace item-transfer producers SHALL use the shared toast path with `Item transfer pending — {item name} is being transferred.` as an info notification. A confirmed player-receipt notification SHALL read `Item transfer confirmed — {item name} is now in your Player Wallet.` and a confirmed player-send notification SHALL read `Item transfer confirmed — {item name} was sent from your Player Wallet.`, each as a success notification. Each notification SHALL provide the item's validated chain-provided credential-free HTTPS icon URL when available; unavailable or invalid artwork SHALL use the existing text-only fallback. These delivery notifications SHALL be additional to, and SHALL NOT suppress, delay, relabel, deduplicate with, or otherwise change generic incoming-payment receipt notifications, including receipts whose sats value is an Arkade asset-carrier amount.

#### Scenario: Delivery toast includes verified artwork
- **WHEN** Marketplace emits a pending or confirmed delivery notification for an item with a validated chain-provided icon URL
- **THEN** the shared toast displays that item image using its existing optional-image behavior
- **AND** image preparation failure still displays the delivery text and semantic type

#### Scenario: Carrier receipt remains visible
- **WHEN** an item-delivery transaction also produces an incoming Arkade sats receipt for the recipient
- **THEN** the existing generic incoming-payment notification retains its existing behavior
- **AND** the Marketplace delivery notification is presented as a separate queued notification

#### Scenario: Untrusted artwork is unavailable
- **WHEN** the delivered item has no validated credential-free HTTPS icon URL
- **THEN** Marketplace emits the applicable delivery notification without an image
- **AND** it does not substitute an icon by item-name lookup
