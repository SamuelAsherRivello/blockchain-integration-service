# Spec Delta

## ADDED Requirements

### Requirement: Marketplace item-delivery toast content and payment independence

Marketplace item-transfer producers SHALL use the shared toast path with `Game Wallet sent you {item-name} item. (Pending)` or `You sent {item-name} item. (Pending)` as an info notification. Confirmed player-receipt and player-send notifications SHALL use the identical respective sentences ending in `(Confirmed)` as success notifications. Each notification SHALL provide the item's validated chain-provided credential-free HTTPS icon URL when available; unavailable or invalid artwork SHALL use the existing text-only fallback. These delivery notifications SHALL be additional to, and SHALL NOT suppress, delay, relabel, deduplicate with, or otherwise change generic incoming-payment receipt notifications, including receipts whose sats value is an Arkade asset-carrier amount.

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

## MODIFIED Requirements

### Requirement: Sentence-case built-in messages
Built-in toast messages SHALL capitalize the first word of each sentence and use lowercase for other ordinary words, including sats, except status endings in parentheses. Arkade and Bitcoin SHALL retain their capitalization. Acronyms and exact identifiers, URLs and interpolated user data SHALL retain their original case. Built-in messages SHALL NOT prepend Info:, Warning:, Error: or Success:. Caller-supplied text SHALL remain literal; capitalization SHALL be applied at application-owned message sources rather than by transforming all queued strings. Pending and confirmed variants SHALL have identical text before their final `(Pending)` or `(Confirmed)` suffix. Other built-in messages SHALL have no status suffix.

#### Scenario: Incoming receipt
- **WHEN** a known sender receipt is pending or verified
- **THEN** its text is `{user} sent you {amount} sats. (Pending)` or `{user} sent you {amount} sats. (Confirmed)` respectively, preserving the existing verification rules
- **AND** a verified receipt from the selected Game Wallet reads `Game Wallet sent you {amount} sats.` with the applicable suffix

#### Scenario: Own transfer and trophy
- **WHEN** a transfer or trophy message is emitted
- **THEN** wording uses `You transferred {amount} sats from Bitcoin to Arkade.`, its Arkade-to-Bitcoin reverse, or `You received the Level {level} trophy.` with the applicable confirmed or pending suffix

#### Scenario: Continue payment status wording
- **WHEN** a continue payment or limited-time-offer update is emitted
- **THEN** it uses `You paid {amount} sats to continue.` or its approved limited-time-offer sentence with the applicable pending or confirmed suffix
- **AND** unavailable and expired messages have no status suffix

#### Scenario: Literal caller content
- **WHEN** a host supplies mixed-case identifiers or a message containing a colon
- **THEN** the message is preserved exactly and no category prefix is inserted
