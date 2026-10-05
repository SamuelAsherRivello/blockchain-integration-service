## ADDED Requirements

### Requirement: A3 production demonstration and evidence
Selecting Restore Account in Admin SHALL open the production Account dialogue for the actual persisted state, without auto-restoring or manufacturing an account. Logged-out players SHALL enter restoration through its enabled Restore Account action; active players SHALL see the existing logged-in dialogue. Admin SHALL consume only public non-secret state and events. Completion SHALL require matching production-host and demo behavior, synchronized A3 story documentation, and verification of same-identity restoration, persistent reopening, word/checksum validation, masking, clipboard handling, and failures. The A3 diagram SHALL retain existing step IDs while identifying wallet/achievement loading and the full menu as deferred. Unperformed live verification SHALL remain explicitly pending.

#### Scenario: Demonstrate restoration
- **WHEN** Restore Account is selected with no active account
- **THEN** the production Account dialogue opens and the player can start its real restoration flow
- **AND** story navigation remains disabled while that flow is open

#### Scenario: Existing account
- **WHEN** Restore Account is selected with a persisted active account
- **THEN** the minimal logged-in Account dialogue appears without replacement or recovery entry

#### Scenario: Delivery evidence
- **WHEN** A3 is reported complete
- **THEN** evidence covers the real Signet account-access round trip and independent-host parity without exposing recovery material
- **AND** balances, achievements, the full menu, and gameplay recovery are not claimed

## MODIFIED Requirements

### Requirement: Implemented demonstrations only
The Admin UI SHALL show only implemented demonstrations and categories containing at least one such demonstration. It SHALL start without a selected story, including after refresh. This slice SHALL expose Account / Account Button, Account / Create Account, Account / Restore Account, and Account / Log Out, and omit Pay-to-play and Achievements.

The Admin heading SHALL be followed by User Stories and a Documentation link to bundled user-story Markdown, then Account and the implemented story actions. It SHALL NOT show Interactivity. The documentation link SHALL work in development and the built demo.

#### Scenario: Initial demo
- **WHEN** the implemented demo loads
- **THEN** Account Button, Create Account, Restore Account, and Log Out are available under Account and Runtime Preview content is empty
- **AND** no filler cards, introduction, WIP badges, or empty categories appear

### Requirement: User stories remain truthful
User-story documentation SHALL retain stable story and step IDs and distinguish complete, partial, and planned behavior. Every new runtime feature SHALL include an Admin demonstration and synchronized documentation before completion is reported. A1 SHALL document entry, A2 creation and the minimal active dialogue, A3 restoration of account access, A4 the full active-account menu, and A6 functional logout. Story numbering SHALL NOT mandate development order.

#### Scenario: A2 delivered
- **WHEN** A2 is reported complete
- **THEN** documentation maps its creation, recovery, persistence, returning-account, and reset paths to verified behavior
- **AND** it retains A2.06, A2.09, and A2.10 references without attributing A3 restoration, A6 logout, or the full A4 menu to A2

#### Scenario: First slice delivered
- **WHEN** the completed A1 slice is described alongside A2
- **THEN** documentation maps A1 to Account Button and explains its entry path
- **AND** it distinguishes A2 creation from A3 restoration and the still-planned full active-profile menu
