## MODIFIED Requirements

### Requirement: Implemented demonstrations only
The Admin UI SHALL show only implemented demonstrations and categories containing at least one such demonstration. It SHALL start without a selected story, including after refresh. This slice SHALL expose Account / Account Button, Account / Create Account, Account / Restore Account, Account / Account Balance, Account / Inspect Activity, and Account / Log Out, and omit Pay-to-play and Achievements.

The Admin heading SHALL be followed by User Stories and a Documentation link to bundled user-story Markdown, then Account and the implemented story actions. It SHALL NOT show Interactivity. The documentation link SHALL work in development and the built demo.

#### Scenario: Initial demo
- **WHEN** the implemented demo loads
- **THEN** Account Button, Create Account, Restore Account, Account Balance, Inspect Activity, and Log Out are available under Account and Runtime Preview content is empty
- **AND** no filler cards, introduction, WIP badges, or empty categories appear


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
- **THEN** existing story/step IDs remain stable, A4 scope is the lean balance dialog, and A5 transaction history is a separate story, while C4 achievements/assets and receiving details remain outside A4
- **AND** missing funded-wallet or other live checks remain explicitly pending instead of being inferred from fixtures or zero-balance checks

## ADDED Requirements

### Requirement: A5 production demonstration and evidence
The Account / Inspect Activity Admin demonstration SHALL open the real Account flow, where Account Activity appears directly below Account Details for an active account. Without an account it SHALL show the existing chooser without creating an account. Runtime Preview SHALL use production public APIs and UI. A5 documentation SHALL retain stable story and step IDs and describe all history supplied by Arkade, including incoming, outgoing, confirmed, and spent entries, without promising history unavailable from the SDK. The production dialog SHALL show one Transactions text area, newest first with one transaction per line, and one Copy button for the entire list. Completion SHALL require real Signet wallet evidence of existing pending deposits, automatic updates, and confirmation mapping, plus isolated full-history ordering, spent-entry retention, Copy-all, and failure/lifecycle tests and independent-host parity. Fixtures SHALL NOT be represented as live transactions.

#### Scenario: Demonstrate Account Activity
- **WHEN** Inspect Activity is selected with an active account
- **THEN** the Account menu opens and Account Activity opens the production Account Activity dialog; story switching stays disabled while the flow is open

#### Scenario: Missing live evidence
- **WHEN** notification or confirmation behavior has not yet been observed through the real wallet SDK
- **THEN** that verification remains explicitly pending and provider-only reads do not establish complete delivery
