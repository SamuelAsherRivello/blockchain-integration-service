## MODIFIED Requirements

### Requirement: No-profile account flow
Opening Account without an active profile SHALL replace entry presentation with the production Account dialogue. It SHALL show the title "Account", followed by "You are not logged in.", enabled lightning-prefixed Create Account, enabled lightning-prefixed Restore Account, and enabled Back without a lightning icon. Create Account SHALL use a stronger primary style; Restore Account and Back SHALL use secondary styling. The dialogue SHALL omit decorative heading icons and coming-soon explanations. Opening it SHALL perform no account creation or restoration; loading an existing local account SHALL precede routing. Back SHALL restore the preceding presentation without changing profile state.

#### Scenario: Open and close from the Account button
- **WHEN** the player clicks Account and then Back
- **THEN** the Account dialogue appears and subsequently returns to the Account button
- **AND** no account is created or restored

#### Scenario: Repeated open
- **WHEN** Account is requested while already open
- **THEN** no duplicate view or additional operation is created

### Requirement: Honest profile routing boundary
The logged-in message SHALL display "You are now logged in as" followed by a line break and "Account ID: ", the first four and last four characters of the active public profile ID separated by an ellipsis, and a period. The shortened ID SHALL use code styling.
A1 SHALL remain the entry-button demonstration. A2 SHALL own creation and its minimal active-account endpoint. A3 SHALL own restoration and share that endpoint. All account entry paths SHALL recognize a real persisted active account and show Account, "You are now logged in as Account ID: <first 4 characters>…<last 4 characters>.", enabled lightning-prefixed Log Out, and enabled Back; they SHALL hide Create Account and Restore Account. Log Out SHALL open A6's backup confirmation without immediately clearing the account. Back SHALL restore the preceding host presentation. A4 SHALL retain the full account menu; A6 SHALL own working logout. The demo SHALL NOT manufacture profiles or report unimplemented stories as complete.

#### Scenario: Saved account opens safely
- **WHEN** a player opens Account with a saved active profile
- **THEN** the minimal logged-in dialogue appears without an unimplemented-menu error or duplicate creation
- **AND** Log Out is enabled and opens the A6 confirmation

#### Scenario: Route validation does not imply wallet functionality
- **WHEN** profile routing is tested and documented
- **THEN** logged-out creation entry, the minimal active dialogue, and A6 logout are distinguished
- **AND** A3 restores account access only and the full A4 menu remains planned
