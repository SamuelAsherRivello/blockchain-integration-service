## ADDED Requirements

### Requirement: Subtle separation above dialog Back actions
Every visible production dialog Back button SHALL have exactly one faint three-dot separator centered immediately above it with a small amount of clearance. The treatment SHALL be consistent across account entry, creation and recovery, restoration, account menus, balances, receiving, logout, send and swap forms and reviews, transaction lists and details, asset lists and details, and recovery report dialogs wherever Back is rendered. The separator SHALL remain less prominent than button borders and SHALL preserve compact layouts, button labels, dimensions, order, enabled states, focus behavior, and navigation destinations.

#### Scenario: Back follows other actions
- **WHEN** a dialog displays other actions followed by Back
- **THEN** three faint dots slightly separate Back from the preceding actions
- **AND** all actions retain their existing order and behavior

#### Scenario: Back is the only action or belongs to a nested view
- **WHEN** a dialog or nested detail view displays a Back button
- **THEN** that Back button receives the same single separator, even when it is the only action

#### Scenario: No Back action
- **WHEN** a dialog does not render Back
- **THEN** no Back separator or reserved separator spacing appears

#### Scenario: Disabled and keyboard navigation
- **WHEN** Back is disabled or the user navigates with the keyboard
- **THEN** its separator remains decorative and introduces no focus stop or click target
- **AND** existing Back availability and focus handling are preserved

#### Scenario: Compact host
- **WHEN** dialogs are displayed in the narrow 9:16 preview or a short host
- **THEN** the separator remains subtle and Back stays reachable without horizontal overflow
