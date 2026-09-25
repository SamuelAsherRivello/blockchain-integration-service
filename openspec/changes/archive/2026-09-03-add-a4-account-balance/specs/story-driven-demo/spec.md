## MODIFIED Requirements

### Requirement: Implemented demonstrations only
The Admin UI SHALL show only implemented demonstrations and categories containing at least one such demonstration. It SHALL start without a selected story, including after refresh. This slice SHALL expose Account / Account Button, Account / Create Account, Account / Restore Account, Account / Account Balance, and Account / Log Out, and omit Pay-to-play and Achievements.

The Admin heading SHALL be followed by User Stories and a Documentation link to bundled user-story Markdown, then Account and the implemented story actions. It SHALL NOT show Interactivity. The documentation link SHALL work in development and the built demo.

#### Scenario: Initial demo
- **WHEN** the implemented demo loads
- **THEN** Account Button, Create Account, Restore Account, Account Balance, and Log Out are available under Account and Runtime Preview content is empty
- **AND** no filler cards, introduction, WIP badges, or empty categories appear


### Requirement: Production controls and state
Selecting Account Button SHALL render the real production entry button. Selecting Create Account SHALL open the production Account dialogue without automatically creating an identity. Runtime Preview SHALL use only production APIs and components, including the same persistence behavior as a game host. Admin SHALL observe public production state and SHALL NOT introspect for unimplemented APIs or receive recovery material. Story actions SHALL be disabled while an account flow is open.

#### Scenario: Open through real UI
- **WHEN** the user selects Account Button and clicks the rendered button
- **THEN** the production dialogue appears and story actions are disabled while it is open
- **AND** closing the dialogue enables story actions again

#### Scenario: A2 after refresh
- **WHEN** a committed account exists, the admin page refreshes, and Create Account is selected
- **THEN** the initially empty viewport shows the production logged-in Account menu for that account
- **AND** no replacement account is created


### Requirement: User stories remain truthful
User-story documentation SHALL retain stable story and step IDs and distinguish complete, partial, and planned behavior. Every new runtime feature SHALL include an Admin demonstration and synchronized documentation before completion is reported. A1 SHALL document entry, A2 creation and the minimal active dialogue, A3 restoration of account access, A4 the Account menu and Account Details balance dialog, and A6 functional logout. Story numbering SHALL NOT mandate development order.

#### Scenario: A2 delivered
- **WHEN** A2 is reported complete
- **THEN** documentation maps its creation, recovery, persistence, returning-account, and reset paths to verified behavior
- **AND** it retains A2.06, A2.09, and A2.10 references without attributing A3 restoration, A6 logout, or A4 balance work to A2

#### Scenario: First slice delivered
- **WHEN** the completed A1 slice is described alongside A2
- **THEN** documentation maps A1 to Account Button and explains its entry path
- **AND** it distinguishes A2 creation from A3 restoration and the independently delivered A4 balance dialog and deferred menu features


### Requirement: A3 production demonstration and evidence
Selecting Restore Account in Admin SHALL open the production Account dialogue for the actual persisted state, without auto-restoring or manufacturing an account. Logged-out players SHALL enter restoration through its enabled Restore Account action; active players SHALL see the existing logged-in dialogue. Admin SHALL consume only public non-secret state and events. Completion SHALL require matching production-host and demo behavior, synchronized A3 story documentation, and verification of same-identity restoration, persistent reopening, word/checksum validation, masking, clipboard handling, and failures. The A3 diagram SHALL retain existing step IDs while identifying wallet balance loading as A4 work and achievement loading and other menu features as deferred. Unperformed live verification SHALL remain explicitly pending.

#### Scenario: Demonstrate restoration
- **WHEN** Restore Account is selected with no active account
- **THEN** the production Account dialogue opens and the player can start its real restoration flow
- **AND** story navigation remains disabled while that flow is open

#### Scenario: Existing account
- **WHEN** Restore Account is selected with a persisted active account
- **THEN** the shared A4 logged-in Account dialogue appears without replacement or recovery entry

#### Scenario: Delivery evidence
- **WHEN** A3 is reported complete
- **THEN** evidence covers the real Signet account-access round trip and independent-host parity without exposing recovery material
- **AND** A3 evidence does not claim A4 balance verification, achievements, other menu features, or gameplay recovery

## ADDED Requirements

### Requirement: A4 production demonstration and evidence
Selecting Account Balance SHALL open the production Account dialog for the actual saved state. An active account SHALL show the A4 balance flow; without an account the existing chooser SHALL appear without automatic creation or fabricated data. The demo SHALL use the same public APIs and balance behavior as an independent host. Completion SHALL require synchronized documentation and evidence covering real Signet reads, refresh, failures after success, no balance persistence, navigation and account-change races, and independent-host parity. Deterministic fixtures SHALL be confined to isolated tests and SHALL NOT be presented as live demo balances.

#### Scenario: Demonstrate a real balance
- **WHEN** Account Balance is selected with an active account
- **THEN** the Account menu opens without a balance request; selecting Account Details requests its actual Signet balances, and story navigation remains disabled in both dialogs

#### Scenario: No account
- **WHEN** Account Balance is selected without an active account
- **THEN** the existing chooser appears without seeding an account or balances

#### Scenario: Report A4 complete
- **WHEN** A4 delivery is documented
- **THEN** existing story/step IDs remain stable, A4 scope is the lean balance dialog, and A5 history, C4 achievements/assets, and receiving details are explicitly deferred
- **AND** missing funded-wallet or other live checks remain explicitly pending instead of being inferred from fixtures or zero-balance checks
