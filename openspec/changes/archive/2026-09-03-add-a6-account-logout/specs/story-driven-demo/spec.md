## MODIFIED Requirements

### Requirement: Implemented demonstrations only
The Admin UI SHALL show only implemented demonstrations and categories containing at least one such demonstration. It SHALL start without a selected story, including after refresh. This slice SHALL expose Account / Account Button, Account / Create Account, and Account / Log Out after A6 is implemented, and omit Pay-to-play and Achievements.

The Admin heading SHALL be followed by User Stories and a Documentation link to bundled user-story Markdown, then Account and the implemented story actions. It SHALL NOT show Interactivity. The documentation link SHALL work in development and the built demo.

#### Scenario: Initial demo
- **WHEN** the implemented demo loads
- **THEN** Account Button, Create Account, and Log Out are available under Account and Runtime Preview content is empty
- **AND** no filler cards, introduction, WIP badges, or empty categories appear

## ADDED Requirements

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
