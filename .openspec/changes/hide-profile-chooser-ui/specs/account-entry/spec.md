## MODIFIED Requirements

### Requirement: No-profile account flow
Opening Account without an active profile SHALL replace entry presentation with the production Account dialogue. It SHALL show the title "Account", followed by "You are not logged in.", enabled lightning-prefixed Create Account, enabled lightning-prefixed Restore Account, and enabled Back without a lightning icon. Create Account SHALL use a stronger primary style; Restore Account and Back SHALL use secondary styling. The dialogue SHALL omit decorative heading icons and coming-soon explanations. Opening it SHALL perform no account creation or restoration; loading an existing local account SHALL precede routing. The presence of other saved player identities without an active identity SHALL not alter this logged-out presentation or expose their existence. Back SHALL restore the preceding presentation without changing profile state.

#### Scenario: Open and close from the Account button
- **WHEN** the player clicks Account and then Back
- **THEN** the Account dialogue appears and subsequently returns to the Account button
- **AND** no account is created or restored

#### Scenario: Repeated open
- **WHEN** Account is requested while already open
- **THEN** no duplicate view or additional operation is created

#### Scenario: Open with only inactive saved identities
- **WHEN** origin-local storage contains saved player identities but none is active and the player opens Account
- **THEN** the ordinary logged-out Create Account, Restore Account, and Back actions appear
- **AND** the dialog does not list, label, or offer a choice among saved identities

## ADDED Requirements

### Requirement: Hidden saved-profile management presentation
The production Account UI SHALL NOT render a Profiles entry point, Saved Profiles title, profile list, active-profile marker, Add Profile control, or other user-facing profile-management wording. It SHALL not expose saved public identity IDs outside the existing Accounts Details Account ID field. This presentation change SHALL NOT remove or alter encrypted origin-local identity collection, profile-scoped state isolation, or public programmatic selection behavior.

#### Scenario: Active account menu
- **WHEN** a player opens Account with an active account
- **THEN** the normal active Account routes appear without a Profiles action or profile-management wording
- **AND** Accounts Details retains its separately specified Account ID display

#### Scenario: Multiple saved identities exist locally
- **WHEN** more than one player identity is retained in origin-local storage
- **THEN** no production Account dialog presents their IDs, count, active marker, or an add-or-switch control
- **AND** retained identities and their separately scoped state remain intact

## REMOVED Requirements

### Requirement: Saved player profile chooser
**Reason**: Saved identities remain supported internally, but the user does not want profile management exposed or named in the production UI.

**Migration**: Remove the chooser UI and its visible controls. Preserve saved identities, scoped state, and existing non-UI selection behavior without data migration.
