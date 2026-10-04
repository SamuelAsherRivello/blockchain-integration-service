## MODIFIED Requirements

### Requirement: No-profile account flow
Opening Account without an active profile SHALL replace entry presentation with the production Account dialogue. It SHALL show the title "Account", a conspicuous current test-network label, and "You are not logged in." If no network preference exists, the dialogue SHALL first offer Signet and Mutinynet; Create Account and Restore Account SHALL remain unavailable until one is selected. With a selected network, it SHALL show enabled lightning-prefixed Create Account, enabled lightning-prefixed Restore Account, and enabled Back without a lightning icon. Create Account SHALL use a stronger primary style; Restore Account and Back SHALL use secondary styling. The dialogue SHALL omit decorative heading icons and coming-soon explanations. Opening it SHALL perform no account creation or restoration; loading an existing local account SHALL precede routing. The presence of other saved player identities without an active identity SHALL not alter this logged-out presentation or expose their existence. Back SHALL restore the preceding presentation without changing profile state.

#### Scenario: First entry selects a network
- **WHEN** a player opens Account with no active profile and no saved network preference
- **THEN** Signet and Mutinynet are presented before Create Account or Restore Account can begin
- **AND** no wallet diagnostic runs before the selection

#### Scenario: Open and close from the Account button
- **WHEN** a player selects a network, clicks Account, and then Back
- **THEN** the Account dialogue appears and subsequently returns to the Account button
- **AND** no account is created or restored

#### Scenario: Repeated open
- **WHEN** Account is requested while already open
- **THEN** no duplicate view or additional operation is created

#### Scenario: Open with only inactive saved identities
- **WHEN** selected-network storage contains saved player identities but none is active and the player opens Account
- **THEN** the ordinary logged-out Create Account, Restore Account, and Back actions appear after network selection is available
- **AND** the dialog does not list, label, or offer a choice among saved identities

### Requirement: Shared form network and BIS version header
Every production BIS form displaying a network header SHALL display `Network: <selected test network>` centered horizontally relative to its form. It SHALL display `BIS: v<version>` immediately to the right on the same header line, vertically aligned with the network text, using the running @bis/integration package version. The version SHALL be very faded relative to the network label while remaining visible. The network label SHALL NOT shift to center the combined pair. Existing sticky header behavior SHALL remain intact.

#### Scenario: Open a production form
- **WHEN** a user opens any production form after selecting Mutinynet
- **THEN** Network: Mutinynet remains centered in the form
- **AND** the running BIS version appears immediately to its right in very faded text

#### Scenario: Narrow preview and scrolling
- **WHEN** a form appears in the supported narrow portrait preview or its body scrolls
- **THEN** the selected-network and version labels remain visible without overlap or horizontal overflow
- **AND** the strip retains its sticky behavior

#### Scenario: Package version changes
- **WHEN** a different integration package version is built and loaded
- **THEN** its header displays that package version automatically without editing a hardcoded UI version
- **AND** development source and built-library consumers follow the same version source
