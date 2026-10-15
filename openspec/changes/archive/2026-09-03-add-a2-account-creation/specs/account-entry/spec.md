## MODIFIED Requirements

### Requirement: No-profile account flow
Opening Account without an active profile SHALL replace entry presentation with the production Account dialogue. It SHALL show the title "Account", followed by "You are not logged in.", enabled lightning-prefixed Create Account, disabled lightning-prefixed Restore Account, and enabled Back without a lightning icon. Create Account SHALL use a stronger primary style; Restore Account and Back SHALL use secondary styling. The dialogue SHALL omit decorative heading icons and coming-soon explanations. Opening it SHALL perform no account creation or restoration; loading an existing local account SHALL precede routing. Back SHALL restore the preceding presentation without changing profile state.

#### Scenario: Open and close from the Account button
- **WHEN** the player clicks Account and then Back
- **THEN** the Account dialogue appears and subsequently returns to the Account button
- **AND** no account is created or restored

#### Scenario: Repeated open
- **WHEN** Account is requested while already open
- **THEN** no duplicate view or additional operation is created

### Requirement: Honest profile routing boundary
A1 SHALL remain the entry-button demonstration. A2 SHALL own creation and its minimal active-account endpoint. Both entry paths SHALL recognize a real persisted active account and show Account, "You are now logged in.", disabled lightning-prefixed Log Out, and enabled Back; they SHALL hide Create Account and Restore Account. Back SHALL restore the preceding host presentation. A4 SHALL retain the full account menu; A6 SHALL retain working logout. The demo SHALL NOT manufacture profiles or report those stories as complete.

#### Scenario: Saved account opens safely
- **WHEN** a player opens Account with a saved active profile
- **THEN** the minimal logged-in dialogue appears without an unimplemented-menu error or duplicate creation
- **AND** Log Out is visible, disabled, and performs no operation

#### Scenario: Route validation does not imply wallet functionality
- **WHEN** profile routing is tested and documented
- **THEN** logged-out creation entry and the minimal active dialogue are distinguished
- **AND** A4 and A6 remain planned
