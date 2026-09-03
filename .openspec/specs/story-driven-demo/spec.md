# story-driven-demo Specification

## Purpose

Keep the demo a lean, truthful navigator of available integration demonstrations with explicit production boundaries and synchronized story documentation.

## Requirements

### Requirement: Demo identification and preview framing
The demo SHALL display "Blockchain Integration Service - Demo" in its header, a version prefixed with "v", and a GitHub icon linking to the repository. The panels SHALL be labeled "Admin" and "Runtime Preview" with matching heading typography. An empty preview SHALL show a centered demo-owned "Game Viewport" placeholder, hidden when production content is rendered.

#### Scenario: Empty preview identification
- **WHEN** the demo starts or Reset Client clears runtime content
- **THEN** the Game Viewport placeholder is visible and no production Account button is shown

### Requirement: Preview content scale
The demo SHALL offer 100%, 50%, and 25% content scale beside the 9:16 indicator, defaulting to 50%. Scaling SHALL keep the outer frame fixed, give the production mount region inversely proportional layout dimensions, and scale the DOM presentation to fit. It SHALL NOT require production styling changes or remount/reset the current account flow.

#### Scenario: Change scale with dialogue open
- **WHEN** a user changes the preview scale while the Account dialogue is open
- **THEN** the dialogue remains open and centered, its content scales, and its enabled controls remain interactive

### Requirement: Implemented demonstrations only
The Admin UI SHALL show only implemented demonstrations and categories containing at least one such demonstration. It SHALL start without a selected story, including after refresh. This slice SHALL expose Account / Account Button, Account / Create Account, and Account / Log Out after A6 is implemented, and omit Pay-to-play and Achievements.

The Admin heading SHALL be followed by User Stories and a Documentation link to bundled user-story Markdown, then Account and the implemented story actions. It SHALL NOT show Interactivity. The documentation link SHALL work in development and the built demo.

#### Scenario: Initial demo
- **WHEN** the implemented demo loads
- **THEN** Account Button, Create Account, and Log Out are available under Account and Runtime Preview content is empty
- **AND** no filler cards, introduction, WIP badges, or empty categories appear

### Requirement: Production controls and state
Selecting Account Button SHALL render the real production entry button. Selecting Create Account SHALL open the production Account dialogue without automatically creating an identity. Runtime Preview SHALL use only production APIs and components, including the same persistence behavior as a game host. Admin SHALL observe public production state and SHALL NOT introspect for unimplemented APIs or receive recovery material. Story actions SHALL be disabled while an account flow is open.

#### Scenario: Open through real UI
- **WHEN** the user selects Account Button and clicks the rendered button
- **THEN** the production dialogue appears and story actions are disabled while it is open
- **AND** closing the dialogue enables story actions again

#### Scenario: A2 after refresh
- **WHEN** a committed account exists, the admin page refreshes, and Create Account is selected
- **THEN** the initially empty viewport shows the production minimal logged-in dialogue for that account
- **AND** no replacement account is created

### Requirement: Reset clears selection and transient state
Reset Client SHALL clear transient state and integration-owned persisted account material, release old clients/UI/subscriptions, clear selection, and leave runtime content empty with a fresh logged-out client. It SHALL preserve unrelated origin/host data and SHALL NOT erase remote wallet assets or fabricate outcomes. Reset SHALL remain available when there is selected content, pending account work, or saved account state, even without a selected story. A failed reset SHALL report failure rather than claim a fresh start. Stale work in the current or another open instance SHALL NOT repopulate cleared account state.

#### Scenario: Clear selected story
- **WHEN** Reset Client succeeds while the Account dialogue is shown
- **THEN** the fresh client has no saved account, selected story, or Account button
- **AND** old subscriptions are released and the next account entry is logged out

#### Scenario: No selected story
- **WHEN** the demo has no selected story but a saved account exists
- **THEN** Reset Client is enabled and can clear it

#### Scenario: Already fresh
- **WHEN** there is no selection, pending operation, or persisted account state after hydration
- **THEN** Reset Client is disabled

### Requirement: Visually distinct package-owned styles
Demo-owned page/navigation/frame styling SHALL remain dark. Production integration content SHALL use an independently owned light visual design. Demo styling SHALL NOT override production component styling.

#### Scenario: Independent host
- **WHEN** the production UI is mounted in a plain host without demo CSS
- **THEN** its typography, colors, sizing, and behavior remain usable and visually consistent

### Requirement: User stories remain truthful
User-story documentation SHALL retain stable story and step IDs and distinguish complete, partial, and planned behavior. Every new runtime feature SHALL include an Admin demonstration and synchronized documentation before completion is reported. A1 SHALL document entry, A2 creation and the minimal active dialogue, A4 the full active-account menu, and A6 functional logout. Story numbering SHALL NOT mandate development order.

#### Scenario: A2 delivered
- **WHEN** A2 is reported complete
- **THEN** documentation maps its creation, recovery, persistence, returning-account, and reset paths to verified behavior
- **AND** it retains A2.06, A2.09, and A2.10 references without claiming restoration, functional logout, or the full menu works

#### Scenario: First slice delivered
- **WHEN** the completed A1 slice is described alongside A2
- **THEN** documentation maps A1 to Account Button and explains its entry path
- **AND** it distinguishes A2 creation from still-planned restoration and the full active-profile menu

### Requirement: A6 production demonstration
Selecting Log Out SHALL open the production Account dialogue for the actual persisted state without creating or faking an account. An active account SHALL offer the production logout flow; a logged-out context SHALL show the existing chooser so the player can create an account first. Admin SHALL not receive recovery material or bypass confirmation. Story actions SHALL remain disabled while the production dialogue is open. Logout SHALL preserve the selected story and preview; Admin Reset Client SHALL retain its separate reset behavior.

#### Scenario: Demonstrate with a real account
- **WHEN** Log Out is selected with a persisted active account
- **THEN** the production Account dialogue offers A6 confirmation with the same behavior as an independent host

#### Scenario: No account to log out
- **WHEN** Log Out is selected without an active account
- **THEN** the chooser appears without a fabricated profile or automatic account creation

### Requirement: A6 delivery evidence
A6 completion SHALL require synchronized story documentation and evidence covering acknowledgement toggling, cancellation, error/Retry, successful clearing, reload, multiple-instance state, and ordinary host usability. Documentation SHALL retain existing step IDs, distinguish A6 from Admin Reset Client, and identify restoration, recovery-phrase access, payment handling, and game-specific connected-run rules as outside this slice.

#### Scenario: Report A6 complete
- **WHEN** A6 is reported complete
- **THEN** the production and Admin paths have corresponding verification evidence and accurate story documentation
- **AND** missing manual real-storage verification remains explicitly pending rather than being inferred from storage doubles
