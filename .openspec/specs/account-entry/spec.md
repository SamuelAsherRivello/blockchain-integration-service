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
Opening Account without an active profile SHALL replace entry presentation with the production Account dialogue. It SHALL show the title "Account", followed by current-state body text "You are not logged in.", then disabled lightning-prefixed Create Account and Restore Account actions and an enabled Back action without a lightning icon. Create Account SHALL use a visibly stronger primary style while Restore Account and Back SHALL use secondary styling. The dialogue SHALL omit decorative heading icons and coming-soon explanations. It SHALL perform no wallet or network operation. Back SHALL restore the preceding presentation without changing profile state.

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
A1 SHALL consist of the complete no-profile Account button, Account dialogue, and Back flow. Active-profile opening SHALL belong to the separate A4 story. Internal routing SHALL distinguish those destinations without manufacturing live profiles or claiming an implemented A4 menu.

#### Scenario: Route validation does not imply wallet functionality
- **WHEN** isolated tests exercise both profile-routing inputs
- **THEN** they distinguish the destinations without exposing test profile injection in the demo
- **AND** completion reporting identifies A1 as complete and A4 as separately planned



