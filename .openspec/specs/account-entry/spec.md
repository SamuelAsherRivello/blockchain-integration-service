# account-entry Specification

## Purpose

Provide reusable account entry presentation and lifecycle behavior that game hosts and the demo can consume through the same production surface.

## Requirements

### Requirement: Host-mounted production presentation
The integration SHALL render into a supplied host container, initially empty, and SHALL offer an explicit request to display a production Account button. Production content SHALL be centered within that container. The entry button SHALL size to its content; dialogue action buttons SHALL share the same width and padding. Production UI SHALL not depend on demo code or styles.

#### Scenario: Display entry control
- **WHEN** a host mounts integration UI and requests Account button presentation
- **THEN** one centered production Account button appears in that container
- **AND** no simulated game settings or navigation is added

#### Scenario: Open directly from host UI
- **WHEN** a host mounts the production UI and calls the public context.openAccountDialog() method without requesting an Account button
- **THEN** the same Account dialogue opens without requiring the BIS entry button
- **AND** Back restores the previously empty production layer

### Requirement: No-profile account flow
Opening Account without an active profile SHALL replace entry presentation with the production Account dialogue. It SHALL show the title "Account", followed by "You are not logged in.", enabled lightning-prefixed Create Account, disabled lightning-prefixed Restore Account, and enabled Back without a lightning icon. Create Account SHALL use a stronger primary style; Restore Account and Back SHALL use secondary styling. The dialogue SHALL omit decorative heading icons and coming-soon explanations. Opening it SHALL perform no account creation or restoration; loading an existing local account SHALL precede routing. Back SHALL restore the preceding presentation without changing profile state.

#### Scenario: Open and close from the Account button
- **WHEN** the player clicks Account and then Back
- **THEN** the Account dialogue appears and subsequently returns to the Account button
- **AND** no account is created or restored

#### Scenario: Repeated open
- **WHEN** Account is requested while already open
- **THEN** no duplicate view or additional operation is created

### Requirement: Container-local interaction
Account presentation SHALL block interaction behind it only within the host region while leaving surrounding host controls usable. It SHALL NOT add Escape or backdrop dismissal in this slice.

#### Scenario: Admin remains usable
- **WHEN** the dialogue is open in the Runtime Preview UI
- **THEN** the Admin UI Reset Client remains reachable with pointer and keyboard

### Requirement: Observable lifecycle
The production surface SHALL expose non-secret state updates sufficient to observe account-view changes, with subscription cleanup and UI unmount/client disposal. Disposed instances SHALL NOT continue notifying former consumers.

#### Scenario: State and cleanup
- **WHEN** a subscribed host opens Account and later unsubscribes and disposes the client
- **THEN** it receives the opening state change and no subsequent notifications from that client

### Requirement: Honest profile routing boundary
A1 SHALL remain the entry-button demonstration. A2 SHALL own creation and its minimal active-account endpoint. Both entry paths SHALL recognize a real persisted active account and show Account, "You are now logged in.", enabled lightning-prefixed Log Out, and enabled Back; they SHALL hide Create Account and Restore Account. Log Out SHALL open A6's backup confirmation without immediately clearing the account. Back SHALL restore the preceding host presentation. A4 SHALL retain the full account menu; A6 SHALL own working logout. The demo SHALL NOT manufacture profiles or report unimplemented stories as complete.

#### Scenario: Saved account opens safely
- **WHEN** a player opens Account with a saved active profile
- **THEN** the minimal logged-in dialogue appears without an unimplemented-menu error or duplicate creation
- **AND** Log Out is enabled and opens the A6 confirmation

#### Scenario: Route validation does not imply wallet functionality
- **WHEN** profile routing is tested and documented
- **THEN** logged-out creation entry, the minimal active dialogue, and A6 logout are distinguished
- **AND** A3 restoration and the full A4 menu remain planned
