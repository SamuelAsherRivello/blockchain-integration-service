## MODIFIED Requirements

### Requirement: Implemented demonstrations only
The Admin UI SHALL show only implemented demonstrations and nonempty categories. It SHALL begin without a selected story, including after refresh. Existing implemented Account demonstrations SHALL remain available, through Account Button and Account Dialog, with creation, restoration, balances, activity, logout, receiving, sending, and transfer accessible through the existing production flow. Dedicated shortcuts for these nested functions SHALL NOT appear in A. Account. Assets / C1 Mint Asset and C4 List Assets SHALL remain available alongside them. Pay-to-play SHALL expose Request Continue only once its real operation is implemented; other unimplemented stories and game-specific Achievements SHALL be omitted. The Admin heading SHALL be followed by User Stories and a Documentation link to bundled user-story Markdown that works in development and production builds. It SHALL NOT show Interactivity.

#### Scenario: Initial demo
- **WHEN** the demo loads
- **THEN** only A1 Account Button and A4 Account Dialog are available as buttons under Account alongside C1/C4 asset controls, with empty Runtime Preview
- **AND** no filler cards, introduction, WIP badges, or empty categories appear
- **AND** Request Continue appears under Pay-to-play only after its operation is implemented

### Requirement: Production controls and state
Selecting Account Button SHALL render the real production entry button. Selecting Account Dialog SHALL open the production Account dialogue without automatically creating an identity. Runtime Preview SHALL use only production APIs and components, including the same persistence behavior as a game host. Admin SHALL observe public production state and SHALL NOT introspect for unimplemented APIs or receive recovery material. Story actions SHALL be disabled while an account flow is open.

#### Scenario: Open through real UI
- **WHEN** the user selects Account Button and clicks the rendered button
- **THEN** the production dialogue appears and story actions are disabled while it is open
- **AND** closing the dialogue enables story actions again

#### Scenario: A2 after refresh
- **WHEN** a committed account exists, the admin page refreshes, and Account Dialog is selected
- **THEN** the initially empty viewport shows the production logged-in Account menu for that account
- **AND** no replacement account is created

### Requirement: A4 production demonstration and evidence
Selecting Account Dialog SHALL open the production Account dialog for the actual saved state. An active account SHALL show the A4 balance flow; without an account the existing chooser SHALL appear without automatic creation or fabricated data. The demo SHALL use the same public APIs and balance behavior as an independent host. Completion SHALL require synchronized documentation and evidence covering real Signet reads, refresh, failures after success, no balance persistence, navigation and account-change races, and independent-host parity. Deterministic fixtures SHALL be confined to isolated tests and SHALL NOT be presented as live demo balances.

#### Scenario: Demonstrate a real balance
- **WHEN** Account Dialog is selected with an active account
- **THEN** the Account menu opens without a balance request; selecting Account Details requests its actual Signet balances, and story navigation remains disabled in both dialogs

#### Scenario: No account
- **WHEN** Account Dialog is selected without an active account
- **THEN** the existing chooser appears without seeding an account or balances

#### Scenario: Report A4 complete
- **WHEN** A4 delivery is documented
- **THEN** existing story/step IDs remain stable, A4 scope is the lean balance dialog, and A5 transaction history is a separate story, while C4 achievements/assets and receiving details remain outside A4
- **AND** missing funded-wallet or other live checks remain explicitly pending instead of being inferred from fixtures or zero-balance checks

### Requirement: A5 production demonstration and evidence
The Account / Account Dialog Admin entry SHALL open the real Account flow, where Accounts Details contains Transactions directly below Balance for an active account. Without an account it SHALL show the existing chooser without creating an account. Runtime Preview SHALL use production public APIs and UI. A5 documentation SHALL retain stable story and step IDs and describe all history supplied by Arkade, including incoming, outgoing, confirmed, and spent entries, without promising history unavailable from the SDK. The production Transactions dialog SHALL show the current three-line transaction rows in newest-first history order, a Copy all transactions action exporting one transaction per line, and per-transaction detail copying. Completion SHALL require real Signet wallet evidence of existing pending deposits, automatic updates, and confirmation mapping, plus isolated full-history ordering, spent-entry retention, Copy-all, and failure/lifecycle tests and independent-host parity. Fixtures SHALL NOT be represented as live transactions.

#### Scenario: Demonstrate Account Activity
- **WHEN** Account Dialog is selected with an active account
- **THEN** the Account menu opens and Transactions opens the production Transactions dialog; story switching stays disabled while the flow is open

#### Scenario: Missing live evidence
- **WHEN** notification or confirmation behavior has not yet been observed through the real wallet SDK
- **THEN** that verification remains explicitly pending and provider-only reads do not establish complete delivery

### Requirement: D2a address receiving demonstration and evidence
Address receiving SHALL remain accessible through Account Dialog and the production Receive action, using the production public API and UI. A dedicated D2a Admin button SHALL NOT be shown. Without an active account it SHALL open the ordinary account chooser; account creation/restoration and subsequent Receive navigation SHALL remain explicit player actions. The demonstration SHALL NOT auto-create an account, fund it, or fabricate transaction outcomes. Existing demonstrations SHALL remain intact.

#### Scenario: Active account demonstration
- **WHEN** Receive is selected in the production Account flow with an active account
- **THEN** the production Receive page opens with address fields and unavailable Lightning controls

#### Scenario: Logged-out demonstration
- **WHEN** Account Dialog is selected without an account
- **THEN** the normal account chooser opens without automatic creation, restoration, or funding

### Requirement: D4 Account Transfer demonstration
Account Transfer SHALL remain accessible through Account Dialog and existing production navigation using the production public API and UI, without a dedicated D4 Admin button. It SHALL preserve the logged-out Account flow and SHALL identify unavailable transfer execution without simulating successful transactions. Documentation SHALL distinguish delivered presentation from pending live transfers and preserve unrelated story IDs.

#### Scenario: Active account demonstration
- **WHEN** Account Transfer is selected through the production Account flow with an active account
- **THEN** Runtime Preview opens the production Account Transfer screen

#### Scenario: No account
- **WHEN** Account Dialog is selected without an account
- **THEN** the normal account entry opens without creating an account or moving funds

### Requirement: D3a production Send demonstration
Send SHALL remain accessible through Account Dialog and the production Account Send flow with the actual saved profile, without a dedicated Send Admin button. Logged-out selection SHALL show the existing chooser without automatically creating an account. The preview and independent host SHALL share UI, state, fee review, lifecycle protection and payment behavior. Fixtures SHALL remain isolated test evidence, never live demonstration transactions.

#### Scenario: Open Send
- **WHEN** Send is selected in the production Account flow with an active account
- **THEN** the production address-send form opens without preparing or submitting a payment automatically

#### Scenario: No profile
- **WHEN** Account Dialog is selected while logged out
- **THEN** the normal chooser appears without fabricated balances or automatic account creation
## ADDED Requirements

### Requirement: Compact Admin Account section
A. Account SHALL display its section heading, then `Stories: A1, A2, A3, A4, A5, A6`, then exactly two buttons in order: A1. Account Button and A4. Account Dialog. The story summary SHALL remain separate from the button list and list implemented A-series stories in numeric order without changing documented pending verification status. Other story sections SHALL add summaries below their headings: B lists B1, B2; C lists C1, C4, C6; D lists D1, D2; E lists E1, E2; F lists F1, F2, F3. Each SHALL use the Stories: prefix and comma-separated IDs. Existing controls, order, styling, and behavior SHALL otherwise remain unchanged. User Stories documentation and Console SHALL NOT receive story summaries.

#### Scenario: Account layout
- **WHEN** Admin renders at wide or narrow panel widths
- **THEN** the Account heading, story summary, and two buttons appear in order without overlap or horizontal overflow
- **AND** the summary wraps naturally when necessary
- **AND** no separate Create Account, Restore Account, Inspect Activity, Log Out, Receive Funds, Send Funds, or Account Transfer Admin buttons appear

#### Scenario: Existing guards and navigation
- **WHEN** an Account flow is open
- **THEN** both Account entry buttons retain the existing disabled behavior
- **AND** closing the flow restores their availability according to existing state guards

#### Scenario: Other sections are unchanged
- **WHEN** the simplified Account section is displayed
- **THEN** Pay-to-play, Assets, UI, Admin Tools, Game Wallet, Console, and Reset Client retain their current controls and behavior



