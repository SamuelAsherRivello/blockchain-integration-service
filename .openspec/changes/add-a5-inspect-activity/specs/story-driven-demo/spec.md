## MODIFIED Requirements

### Requirement: Implemented demonstrations only
The Admin UI SHALL show only implemented demonstrations and nonempty categories. It SHALL begin without a selected story, including after refresh. Existing implemented Account demonstrations SHALL remain available, including Account Button, Create Account, Restore Account, Account Balance, Inspect Activity, and Log Out. Assets / C1 Mint Asset and C4 List Assets SHALL remain available alongside them. Pay-to-play SHALL expose Request Continue only once its real operation is implemented; other unimplemented stories and game-specific Achievements SHALL be omitted. The Admin heading SHALL be followed by User Stories and a Documentation link to bundled user-story Markdown that works in development and production builds. It SHALL NOT show Interactivity.

#### Scenario: Initial demo
- **WHEN** the demo loads
- **THEN** Account Button, Create Account, Restore Account, Account Balance, Inspect Activity, and Log Out are available under Account alongside C1/C4 asset controls, with empty Runtime Preview
- **AND** no filler cards, introduction, WIP badges, or empty categories appear
- **AND** Request Continue appears under Pay-to-play only after its operation is implemented


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
The Account / Inspect Activity Admin demonstration SHALL open the real Account flow, where Transactions appears directly below Balance (the Account Details route) for an active account. Without an account it SHALL show the existing chooser without creating an account. Runtime Preview SHALL use production public APIs and UI. A5 documentation SHALL retain stable story and step IDs and describe all history supplied by Arkade, including incoming, outgoing, confirmed, and spent entries, without promising history unavailable from the SDK. The production Transactions dialog SHALL show the current three-line transaction rows in newest-first history order, a Copy all transactions action exporting one transaction per line, and per-transaction detail copying. Completion SHALL require real Signet wallet evidence of existing pending deposits, automatic updates, and confirmation mapping, plus isolated full-history ordering, spent-entry retention, Copy-all, and failure/lifecycle tests and independent-host parity. Fixtures SHALL NOT be represented as live transactions.

#### Scenario: Demonstrate Account Activity
- **WHEN** Inspect Activity is selected with an active account
- **THEN** the Account menu opens and Transactions opens the production Transactions dialog; story switching stays disabled while the flow is open

#### Scenario: Missing live evidence
- **WHEN** notification or confirmation behavior has not yet been observed through the real wallet SDK
- **THEN** that verification remains explicitly pending and provider-only reads do not establish complete delivery
