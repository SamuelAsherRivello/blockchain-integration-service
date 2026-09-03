## MODIFIED Requirements

### Requirement: Implemented demonstrations only
The Admin UI SHALL show only implemented demonstrations and categories containing at least one such demonstration. It SHALL start without a selected story, including after refresh. This slice SHALL expose Account / Account Button and Account / Create Account after A2 is implemented, and omit Pay-to-play and Achievements.

The Admin heading SHALL be followed by User Stories and a Documentation link to bundled user-story Markdown, then Account and the implemented story actions. It SHALL NOT show Interactivity. The documentation link SHALL work in development and the built demo.

#### Scenario: Initial demo
- **WHEN** the implemented demo loads
- **THEN** Account Button and Create Account are available under Account and Runtime Preview content is empty
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
