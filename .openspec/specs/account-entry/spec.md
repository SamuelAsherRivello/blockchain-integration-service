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
Opening Account without an active profile SHALL replace entry presentation with the production Account dialogue. It SHALL show the title "Account", followed by "You are not logged in.", enabled lightning-prefixed Create Account, enabled lightning-prefixed Restore Account, and enabled Back without a lightning icon. Create Account SHALL use a stronger primary style; Restore Account and Back SHALL use secondary styling. The dialogue SHALL omit decorative heading icons and coming-soon explanations. Opening it SHALL perform no account creation or restoration; loading an existing local account SHALL precede routing. Back SHALL restore the preceding presentation without changing profile state.

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
Only Accounts Details SHALL display the Account ID field and its Copy action. Copy SHALL copy the complete active public profile ID. Account and all other BIS windows SHALL NOT repeat the Account ID in their subtitles. The shortened ID SHALL use its first four and last four characters separated by an ellipsis. Existing logged-in and Network: Signet messaging SHALL remain available without repeating the ID.
A1 SHALL remain the entry-button demonstration. A2 SHALL own creation and A3 SHALL own restoration; both SHALL return to the actual active Account menu without manufacturing profiles. An active account SHALL hide Create Account and Restore Account and expose Accounts Details, the existing Send/Receive/Swap routes, Log Out and Back. Accounts Details SHALL open a submenu with Balance, Transactions immediately below Balance, Assets immediately below Transactions, and Back to Account. Opening Account or its submenu alone SHALL NOT request balances, history or assets. Balance SHALL use A4's live available/total balances and Refresh; A5 SHALL own Transactions and its detail/copy flow; account-assets SHALL own Assets and Asset Detail. Back from Balance, Transactions or Assets SHALL return to Accounts Details, while Back from Transaction Detail or Asset Detail SHALL return to its list. Existing recovery access, receiving, sending, transfer and logout behavior SHALL retain their separate capability boundaries. Log Out SHALL use A6's production confirmation and SHALL NOT immediately clear the account. Back from Account SHALL restore the preceding host presentation. The demo SHALL NOT report unverified stories as complete.

#### Scenario: Saved account opens safely
- **WHEN** a player opens Account with a saved active profile
- **THEN** the logged-in Account menu appears without an unimplemented-menu error or duplicate creation
- **AND** Log Out is enabled and opens the A6 confirmation

#### Scenario: Route validation does not imply wallet functionality
- **WHEN** profile routing is tested and documented
- **THEN** logged-out creation entry, the active Account menu, the Accounts Details submenu, A4 Balance, and A6 logout are distinguished
- **AND** A3 restores account access only before entering Account; balance loading belongs to A4; A5 owns all SDK-provided incoming and outgoing transaction history, Assets owns runtime asset inspection, and other unimplemented menu features remain deferred
#### Scenario: Open owned assets from Account
- **WHEN** a player with an active profile selects Assets immediately below Transactions in Accounts Details
- **THEN** the production Assets list opens and reads that account's current holdings
- **AND** Back from Asset Detail returns to Assets, while Back from Assets returns to Accounts Details

### Requirement: Shared form network and BIS version header
Every production BIS form displaying Network: Signet SHALL retain that network label centered horizontally relative to its form. It SHALL display `BIS: v<version>` immediately to the right on the same header line, vertically aligned with the network text, using the running @bis/integration package version. The version SHALL be very faded relative to the network label while remaining visible. The network label SHALL NOT shift to center the combined pair. Existing sticky header behavior SHALL remain intact.

#### Scenario: Open a production form
- **WHEN** a user opens any production form with the network header
- **THEN** Network: Signet remains centered in the form
- **AND** the running BIS version appears immediately to its right in very faded text
- **AND** the version has a lowercase v prefix and does not introduce an interactive control

#### Scenario: Package version changes
- **WHEN** a different integration package version is built and loaded
- **THEN** its header displays that package version automatically without editing a hardcoded UI version
- **AND** development source and built-library consumers follow the same version source

#### Scenario: Narrow preview and scrolling
- **WHEN** a form appears in the supported narrow portrait preview or its body scrolls
- **THEN** both labels remain visible without overlap or horizontal overflow
- **AND** the network stays centered and the strip retains its sticky behavior

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
