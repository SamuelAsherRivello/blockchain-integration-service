## ADDED Requirements

### Requirement: Checkout preparation retains its original wallet scope
Marketplace checkout SHALL capture the selected item, quantity, price, direction, player, game wallet, public recipients, network, and session generation before asynchronous preparation. Changed wallet scope SHALL prevent obsolete preparation from creating a new checkout or signing or submitting a leg. This requirement SHALL NOT relax existing settlement-protocol eligibility requirements.

#### Scenario: Game Wallet changes during balance preflight
- **WHEN** checkout starts with Game Wallet A and Game Wallet B becomes active before the balance read completes
- **THEN** no checkout from that gesture is created or advanced
- **AND** neither wallet signs or receives a newly submitted leg from the obsolete preparation

#### Scenario: Player or network changes during recipient discovery
- **WHEN** the player, network, or session generation changes while checkout discovers a public recipient
- **THEN** the obsolete gesture is rejected before journal creation or submission

#### Scenario: User changes the selected item during preparation
- **WHEN** checkout preparation has captured an item and the user opens another item
- **THEN** the existing preparation cannot substitute the new item's identity, quantity, or price
- **AND** overlapping gestures for the same pending item cannot create replacement operations

### Requirement: Checkout recovery cannot cross session boundaries
Submitted checkout legs SHALL retain their original durable identities after a session changes. Obsolete completions and pollers SHALL NOT publish into a replacement session or use replacement signers to submit another leg. Resumption SHALL verify the current wallets and network against the original record before any further mutation; uncertain legs SHALL never be automatically replaced.

#### Scenario: Wallet changes after the first leg is submitted
- **WHEN** the current checkout has a submitted leg and either wallet or the network changes
- **THEN** the original record remains attributable and recoverable under the existing logout rules
- **AND** no next leg is submitted using the replacement session

#### Scenario: Old poll completes after logout or remount
- **WHEN** a status poll started in an old session resolves after logout or a replacement session mounts
- **THEN** its result cannot repopulate the new session's checkout state or advance a new leg
- **AND** it does not recreate recovery records removed by explicit logout

#### Scenario: Original scope is deliberately resumed
- **WHEN** the original distinct wallets and network are active and recovery verifies a submitted leg for that exact checkout
- **THEN** recovery can advance only the original remaining work without duplicating a submitted leg
