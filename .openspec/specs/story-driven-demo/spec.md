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

### Requirement: Reset clears selection and transient state
Reset Client SHALL clear transient state and integration-owned persisted account material, release old clients/UI/subscriptions, clear selection, and leave runtime content empty with a fresh logged-out client. It SHALL preserve unrelated origin/host data and SHALL NOT erase remote wallet assets or fabricate outcomes. Reset SHALL remain available when there is selected content, pending account work, or saved account state, even without a selected story, except while a send or transfer remains submitting, pending or uncertain, a Lightning invoice remains payable, or receipt processing or reconciliation is unresolved. In that case Reset SHALL be blocked in both UI and public command execution until reconciliation proves safe completion or failure; it SHALL retain recovery state across instances and restart. A failed reset SHALL report failure rather than claim a fresh start. Stale work in the current or another open instance SHALL NOT repopulate cleared account state.

#### Scenario: Clear selected story
- **WHEN** Reset Client succeeds while the Account dialogue is shown and no send, transfer, payable invoice, or receipt processing/reconciliation is unresolved
- **THEN** the fresh client has no saved account, selected story, or Account button
- **AND** old subscriptions are released and the next account entry is logged out

#### Scenario: No selected story
- **WHEN** the demo has no selected story but a saved account exists and no send, transfer, payable invoice, or receipt processing/reconciliation is unresolved
- **THEN** Reset Client is enabled and can clear it

#### Scenario: Already fresh
- **WHEN** there is no selection, pending operation, or persisted account state after hydration
- **THEN** Reset Client is disabled

#### Scenario: Unresolved send survives reset attempt
- **WHEN** Reset Client is invoked while a send outcome is unresolved
- **THEN** the reset is refused without clearing account or recovery state

#### Scenario: Unfinished receiving operation
- **WHEN** any invoice is payable or a receipt needs processing or reconciliation
- **THEN** Reset Client is blocked, including without a selected story
- **AND** it preserves the account and recovery state and explains the block

### Requirement: Visually distinct package-owned styles
Demo-owned page/navigation/frame styling SHALL remain dark. Production integration content SHALL use an independently owned light visual design. Demo styling SHALL NOT override production component styling.

#### Scenario: Independent host
- **WHEN** the production UI is mounted in a plain host without demo CSS
- **THEN** its typography, colors, sizing, and behavior remain usable and visually consistent

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

### Requirement: Admin mint form
C1 Mint Asset SHALL open an Admin-owned form with Destination, Name, Ticker, Amount, Decimals, optional Icon URL, an Unverified asset summary, and read-only Control Asset: None. Destination SHALL offer Player wallet and Game wallet, defaulting to Game wallet for a new window. The selected wallet SHALL fund and receive its own issuance through its existing generic mint API. Name/ticker/amount SHALL be required. The form SHALL use editable defaults of an asset, ASSET, 1, and 0 respectively, with blank Icon URL. Existing/New control-asset choices SHALL NOT be offered. Only an explicit valid Mint action SHALL call the generic production mint API. Pending/results/errors SHALL appear in Admin Console with the destination and actual operation's public wallet identity. Pending submission SHALL disable edits and duplicate submission; bounded unknown outcomes SHALL preserve the request, destination, wallet identity and operation ID for reconciliation.

C1 SHALL remain accessible when either wallet is present and active for an explicit mint attempt or pending-mint recovery, without requiring the other wallet or a separate Admin balance precheck. The form SHALL explain when the selected wallet is absent or inactive, and SHALL display actual insufficient-funds or other failures returned by production minting and SHALL NOT silently switch wallets, fund a wallet, or transfer assets. Pending-state lookup SHALL complete successfully for the selected wallet before a new mint is allowed. Changing an idle destination SHALL preserve editable metadata, assign a fresh operation ID for a new request, and inspect that wallet's pending mint. A recovered pending request SHALL replace the editable draft and lock its metadata and destination. Closing and reopening SHALL retain access to each wallet's recovery records. Account replacement or logout SHALL invalidate the affected form session and prevent late results from being shown as belonging to a new wallet.

#### Scenario: Edit and mint
- **WHEN** the user opens C1, selects either destination, edits valid fields, and clicks Mint
- **THEN** that wallet's public API receives those values with no control asset and Admin Console shows pending followed by the returned result
- **AND** the form summary before success is not represented as wallet ownership

#### Scenario: Invalid or cancelled form
- **WHEN** inputs are invalid or the user dismisses the idle form
- **THEN** no mint is submitted and relevant validation or ordinary Admin controls remain available

#### Scenario: Player wallet without a game wallet
- **WHEN** only the player wallet is available and Admin opens C1
- **THEN** Admin can select Player wallet and mint through it
- **AND** Game wallet shows its unavailability without blocking Player wallet

#### Scenario: Game wallet without a player wallet
- **WHEN** only the game wallet is available and Admin opens C1
- **THEN** Admin can mint to Game wallet without logging in a player

#### Scenario: Selected wallet cannot mint
- **WHEN** the selected wallet is missing or its pending-state lookup fails
- **THEN** the form explains the condition and prevents new submission to that wallet
- **AND** no other wallet is charged or used as a fallback

#### Scenario: Production and Admin player mint parity
- **WHEN** the same active player wallet and valid asset request can mint through the production entry point
- **THEN** Admin Player wallet selection reaches that same entry point without an independent balance veto
- **AND** production collection policy, issuance, funds checks, reservation safeguards and reward behavior remain unchanged

#### Scenario: Stale Admin balance information
- **WHEN** old or unavailable Admin balance information disagrees with current production mint eligibility
- **THEN** that information does not disable an otherwise valid explicit Mint attempt
- **AND** production validates current funds and returns the authoritative result

#### Scenario: Insufficient production funds
- **WHEN** Admin explicitly mints and the production method determines eligible funds are insufficient
- **THEN** it submits no network issuance and Admin displays that returned failure
- **AND** no other wallet funds the request

#### Scenario: Change destination before submission
- **WHEN** Admin changes the destination of an idle draft with no unresolved operation
- **THEN** metadata is preserved and the selected wallet's recovery state is checked before submission is enabled
- **AND** a new request has a fresh operation ID unless an existing pending request is recovered

#### Scenario: Recover unresolved issuance
- **WHEN** a wallet has an unresolved mint and Admin selects that destination and chooses Resume pending mint
- **THEN** its original request is restored with its original operation ID and locked destination
- **AND** checking status reconciles that wallet's operation without starting issuance in either wallet

#### Scenario: Wallet changes while window is open
- **WHEN** the selected wallet identity changes or is removed during a draft or operation
- **THEN** that form session is invalidated and cannot submit or reconcile against the replacement wallet
- **AND** late results cannot be attributed to the replacement wallet

### Requirement: Admin example presets
The Admin mint form SHALL offer three quick-fill buttons labeled Achievement: Level 1, Achievement: Level 2, and Achievement: Level 3. Each SHALL populate the matching name, ticker LVL1/LVL2/LVL3 respectively, amount 1, decimals 0, the matching absolute HTTPS trophy icon URL under https://samuelasherrivello.github.io/blockchain-integration-service/assets/achievements/v1/level-{level}-trophy.png (with {level} replaced by 1, 2, or 3), and Control Asset None. Fields SHALL remain editable. Presets SHALL only modify the form and SHALL NOT submit, query, or establish ownership. They SHALL be disabled during submission or while an unresolved request must remain immutable. Example labels SHALL remain in the demo; BIS SHALL apply no achievement-specific meaning or rules.

#### Scenario: Use a preset
- **WHEN** the user selects Achievement: Level 2 in an idle form
- **THEN** the form contains that name, LVL2, amount 1, decimals 0, icon URL https://samuelasherrivello.github.io/blockchain-integration-service/assets/achievements/v1/level-2-trophy.png, and None
- **AND** nothing is submitted until the user separately clicks Mint

#### Scenario: Preset URLs work across origins
- **WHEN** any of the three presets is selected in the local demo or the published demo
- **THEN** its icon URL points to the matching public GitHub Pages PNG rather than a localhost or relative URL
- **AND** the initial form before preset selection still has a blank optional icon URL

### Requirement: Admin list and preview isolation
C4 List Assets SHALL call the generic production listing API and show its actual result in Admin Console, including an explicit empty array. Neither C1 nor C4 SHALL navigate, mount, clear, or change Runtime Preview. Existing account-flow restrictions SHALL be preserved. A mint form SHALL be outside the runtime container and use accessible labels, focus containment/restoration, idle dismissal, and responsive scrolling.

#### Scenario: Mint then list
- **WHEN** mint succeeds and the user then clicks List Assets for the same account
- **THEN** a fresh returned list contains that same asset ID and exact quantity
- **AND** Runtime Preview remains unchanged throughout

#### Scenario: Logged-out request
- **WHEN** an asset API is invoked without an account
- **THEN** Admin Console displays account-required and no account dialog opens automatically

#### Scenario: Another Level 1 asset after an external mint
- **WHEN** the same account already owns an externally minted Achievement: Level 1 and the user explicitly mints the Level 1 preset in BIS with eligible funding and a new operation ID
- **THEN** Console shows minted for a different asset ID with quantity "1", name Achievement: Level 1, ticker LVL1, decimals 0, and the matching hosted icon URL
- **AND** a fresh List Assets result includes both distinct holdings with quantity "1" each and preserves the external holding's metadata
- **AND** retrying the completed BIS operation returns already-minted for the BIS asset without issuing another asset

### Requirement: Always-visible Admin Console
The existing Console region SHALL remain visible from initial load and show labeled pending operations and public API responses or sanitized errors. It SHALL include originating account and operation IDs where known, render text safely, scroll, and replace its previous contents with each new output. Refresh and successful Reset Client SHALL clear its contents; stale completions from a previous client SHALL be ignored. Request-level pending followed by success or error SHALL represent completed request progress; a List Assets read SHALL NOT be treated as an unresolved transaction or create a spending reservation or mint-recovery record.

#### Scenario: Reset with late output
- **WHEN** a new client replaces an old client and the old request later completes
- **THEN** the new console does not display that stale result

#### Scenario: Successful list after request progress
- **WHEN** List Assets emits pending and then success for the same request and account
- **THEN** Console shows the actual successful assets result and the read is complete
- **AND** the earlier pending entry does not create a transaction blocker or require recovery


#### Scenario: Any new console output
- **WHEN** any action emits a loading, pending, status, result or error output
- **THEN** the console clears the prior output and displays only the newly supplied labeled content

### Requirement: Delivery evidence and documentation
C1/C4 documentation SHALL describe generic mint/list APIs and Admin-only presets. Preserve story/step IDs with superseded annotations where necessary. Live mint/list, restoration, retry safety, exact amounts, independent-host parity, and browser behavior SHALL have supporting evidence before completion is claimed. Evidence SHALL distinguish user-supplied external-wallet success, existing BIS listing, isolated tests, and newly verified BIS minting. Same-identity BIS issuance of a new asset followed by a fresh list containing both old and new holdings SHALL be required for this delivery; an external mint or a different-wallet test alone SHALL NOT satisfy it. Historical funding or pending-transfer observations SHALL NOT be described as newly verified blockers. Unperformed checks SHALL remain pending. B/C2/C3/C5 and D1 issuer scope SHALL remain deferred; broad pending-transfer recovery/cancellation remains separate.

#### Scenario: Report delivery
- **WHEN** this slice is reported complete
- **THEN** the revised behavior has supporting evidence and unrelated pending work is not reported complete

#### Scenario: External success with BIS mint still unverified
- **WHEN** the user supplies a successful external mint and matching BIS list but no successful BIS mint has been verified
- **THEN** documentation records the interoperability evidence and leaves BIS mint acceptance incomplete
- **AND** any current dependency on pending-operation policy is identified separately from that completed list request

### Requirement: D2a address receiving demonstration and evidence
Address receiving SHALL remain accessible through Account Dialog and the production Receive action, using the production public API and UI. A dedicated D2a Admin button SHALL NOT be shown. Without an active account it SHALL open the ordinary account chooser; account creation/restoration and subsequent Receive navigation SHALL remain explicit player actions. The demonstration SHALL NOT auto-create an account, fund it, or fabricate transaction outcomes. Existing demonstrations SHALL remain intact.

#### Scenario: Active account demonstration
- **WHEN** Receive is selected in the production Account flow with an active account
- **THEN** the production Receive page opens with address fields and unavailable Lightning controls

#### Scenario: Logged-out demonstration
- **WHEN** Account Dialog is selected without an account
- **THEN** the normal account chooser opens without automatic creation, restoration, or funding

### Requirement: Independent D2a delivery boundary
D2a documentation SHALL distinguish implemented address receiving from blocked D2b live invoices, preserving D2a/D2b and unrelated story IDs. Completion evidence SHALL cover address loading, copying and errors, Refresh failure/retry, navigation, keyboard access, and readable 9:16 layout in the demo and an independent host. It SHALL include automated tests, typecheck, and build results. Test doubles SHALL remain isolated from production outcomes. D2a completion SHALL NOT imply delivery of Lightning invoices, recovery, Activity extensions, account-clearing guards, D3 sending, or D4 transfers.

#### Scenario: D2a accepted while D2b blocked
- **WHEN** D2a meets its acceptance criteria and evidence is recorded
- **THEN** it can be reported complete independently of D2b
- **AND** D2b and unrelated pending verification remain explicitly incomplete

### Requirement: Invoice receiving demonstration and story synchronization
The demo SHALL expose the implemented receiving presentation through the production account flow, without automatically creating an account, an invoice, or a payment. Runtime Preview SHALL use the same public integration API and UI as an independent host. Its documentation SHALL describe D2 as receiving, retain D3 as the separate all-send-types feature, preserve existing story and step IDs, and distinguish the unavailable presentation from verified live invoice receiving. This extends the catalog only with actually implemented demonstrations and SHALL NOT remove unrelated existing demonstrations.

#### Scenario: Unavailable receiving demonstration
- **WHEN** the demo demonstrates Receive without a verified Signet invoice-receiving route
- **THEN** it shows the real address fields and the production Currently unavailable invoice section
- **AND** documentation does not mark live invoice generation or receipt as complete

#### Scenario: No active account
- **WHEN** the receiving demonstration is selected without an active account
- **THEN** the ordinary account chooser is shown without an automatically created profile or fabricated invoice

#### Scenario: Delivery evidence
- **WHEN** live invoice receiving is reported complete
- **THEN** evidence covers fee review, actual Signet generation and receipt, expiry/Renew, toggling, navigation reset, restart recovery, Activity reconciliation, failure handling, and production-host/demo parity
- **AND** isolated fixtures are not substituted for live payment evidence and unrelated A5 verification remains separately tracked

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

### Requirement: Separate non-Lightning and invoice sending stories
Documentation SHALL retain D3 as the sending parent and distinguish D3a address sending from D3b paying a Lightning invoice. D5 pending-transfer recovery SHALL remain a separate proposal/story and SHALL NOT block D3a implementation or isolated testing. D3b SHALL remain deferred and unstarted, without enabled runtime controls or implementation tasks in D3a. D3a completion SHALL require synchronized diagrams and live verification for Arkade-to-Arkade, plus isolated error, navigation, accessibility, duplicate-send, restart and lifecycle-guard tests. Missing live evidence SHALL remain pending.

#### Scenario: Report delivery status
- **WHEN** Send delivery is documented
- **THEN** D3a evidence identifies each verified route and missing checks explicitly
- **AND** D3b is not reported implemented or made a prerequisite for D3a

### Requirement: Published numbered trophy icons
The demo SHALL provide three 64 by 64 pixel PNG trophy icons with actual transparent backgrounds, matching the Stealth Grid pixel-art style. They SHALL use the same trophy artwork outside the numbered area, with only the corresponding digit 1, 2, or 3 on the cup and no other text. The three preset URLs SHALL serve the corresponding files publicly through GitHub Pages. Published v1 paths and file contents SHALL be retained across releases; revised artwork SHALL use a new version directory so existing mint metadata retains its original reference.

#### Scenario: Published trophy assets
- **WHEN** a client requests each preset icon URL after deployment
- **THEN** it receives the corresponding 64 by 64 transparent PNG, identical to the project asset

#### Scenario: Later artwork revision
- **WHEN** a later release introduces revised trophy artwork
- **THEN** the existing v1 URLs and image contents remain available and unchanged, and revised artwork uses new versioned URLs
- **AND** hosting continuity depends on retaining the repository and GitHub Pages deployment

### Requirement: Admin continuation request and Console outcomes
Admin SHALL provide a Request Continue button with a visible 1,000-sat demo price, using the public continuation API and Console for pending, success, and error outcomes. It SHALL NOT add or replace Runtime Preview content, create game state, or open a second review overlay. Repeated clicks during an unresolved attempt SHALL NOT create additional payments. Console output SHALL identify the operation without exposing secrets. The demo SHALL NOT fabricate transaction success.

#### Scenario: Request through Admin
- **WHEN** the user clicks Request Continue with its displayed default price
- **THEN** Admin requests 1,000 sats through the public API and reports its actual status in Console without changing Runtime Preview

#### Scenario: Request fails
- **WHEN** the request encounters validation, account availability, insufficient funds, or confirmed operation failure
- **THEN** Console reports the corresponding error without implying continuation success

### Requirement: C6 completion reward demonstration
Admin SHALL expose C6 Reward Player With Trophy After Level Complete under C. Assets. Its Runtime Preview SHALL simulate a two-level completion sequence, exercise intermediate/final prompts and use the same generic public asset collection behavior as the game. Opening, Continue and Restart SHALL NOT mint. Only an explicit enabled Collect action SHALL call real wallet issuance; synthetic wallet outcomes SHALL be confined to isolated test fixtures.

#### Scenario: Preview progression
- **WHEN** the user opens C6 then chooses Continue To Next Level
- **THEN** Runtime Preview moves from Level Completed to Game Completed without a wallet mutation
- **AND** Restart Game closes the simulation

#### Scenario: Production wallet action
- **WHEN** an eligible user explicitly clicks Collect in C6
- **THEN** the active wallet's public APIs perform collection and the prompt stays open through the truthful result

### Requirement: Admin image toast sample
Admin SHALL provide D2 Show Toast With Icon beside D1, sending the same sample text with existing trophy artwork through the shared public toast API without awarding an asset.

#### Scenario: Preview a toast with artwork
- **WHEN** the user clicks Show Toast With Icon
- **THEN** a toast displays the existing trophy image to the left of `This is a test message from BIS.`
- **AND** it shares FIFO ordering and availability with D1, including while Account is open

### Requirement: D1 toast messaging demonstration

Admin SHALL expose story ID D1 with label Show Toast under a D. UI section. Activating it SHALL submit the exact message `This is a test message from BIS.` through the public production notification API and display it inside Runtime Preview using the shared BIS UI. D1 SHALL be usable whenever the demo session exists, including without an account and while Account is open. Repeated clicks SHALL enqueue separate messages. The action SHALL NOT open Account, initiate wallet work, or fabricate transaction results. Existing story IDs and actions SHALL remain available.

#### Scenario: Test toast without an account
- **WHEN** the user clicks D1 Show Toast in a ready logged-out demo
- **THEN** the exact test text slides into Runtime Preview, remains fully visible for 3 seconds, and slides out without changing account state

#### Scenario: Repeated test clicks
- **WHEN** the user clicks D1 three times before the first message disappears
- **THEN** three separate test notifications play in order without replacement or stacking

### Requirement: D1 documentation and acceptance evidence

The user-story document SHALL contain D1. Show Toast and a matching table-of-contents entry describing the confirmed behavior, shared runtime ownership, Admin test action, and flow. Until implemented and verified, its status SHALL explicitly identify it as proposed. Completion evidence SHALL cover the actual Admin button in a browser and a separate host fixture consuming the same public API, plus default and overridden duration, FIFO duplicates, narrow/scaled layout, accessibility, reduced motion, coexistence with account/error UI, and cleanup. Automated checks and unperformed manual checks SHALL be reported accurately.

#### Scenario: Planned versus delivered
- **WHEN** the D1 proposal is available but runtime work has not begun
- **THEN** documentation identifies D1 as proposed and does not claim the Admin button is already usable

#### Scenario: Browser acceptance
- **WHEN** D1 implementation is marked complete
- **THEN** recorded evidence demonstrates slide-in, full hold, slide-out, repeat clicks, and runtime containment from the real Admin action and independent host, alongside relevant automated test and build results

### Requirement: Numbered Admin tools

Admin SHALL group the existing tools under E. Admin Tools, labeling the funding action E1. Fund Signet Sats and the explorer action E2. Open On Mempool.space. Both SHALL retain their existing active-account requirement and shared busy disabling. E1 SHALL retain the existing funding-address lookup, clipboard attempt, and Signet faucet opening flow. E2 SHALL retain the existing funding-address lookup and Signet Mempool.space address-page flow. Reorganizing these controls SHALL NOT submit a payment or claim successful funding.

#### Scenario: Existing tool behavior with new labels
- **WHEN** the user activates E1 or E2 with an active account and neither tool busy
- **THEN** the corresponding existing faucet or explorer flow runs once, using its existing handler

#### Scenario: Tools unavailable
- **WHEN** there is no active account or a funding/explorer action is busy
- **THEN** both E1 and E2 remain disabled

### Requirement: UI and appendix story organization

The user-story Markdown SHALL place D1. Show Toast under D. UI and E1/E2 under E. Admin Tools, followed by X. Appendix. Former document stories D1-D6 SHALL become X1-X6, preserving their descriptions and implementation status, and lettered children SHALL retain their suffixes under the new prefix. Internal links, table references, and diagram step labels SHALL use the new document numbering. Historical change paths and existing runtime account-selection identifiers SHALL remain intact.

#### Scenario: Appendix navigation
- **WHEN** a reader follows an X1-X6 table-of-contents link or a reference to a lettered appendix story
- **THEN** it resolves to exactly one corresponding appendix heading and D1 refers to Show Toast

### Requirement: F2 pay player demonstration
Admin SHALL display F3 `Send 100 Sats (Game->Player)` under F. Game Wallet after F2. Without an active logged-in Runtime Preview player account, F3 SHALL be visibly greyed out and disabled for pointer and keyboard activation. Availability SHALL react to account changes and also require an eligible F1 sender and no unresolved F3 payment. Activating F3 SHALL use the production payment API; receipt feedback SHALL appear in Runtime Preview through the shared toast UI.

#### Scenario: No preview player
- **WHEN** Runtime Preview has no active player account
- **THEN** F3 remains visible, greyed out and disabled and cannot initiate a payment

#### Scenario: Player logs in or out
- **WHEN** the player logs in with an eligible F1 sender or logs out again
- **THEN** F3 respectively becomes enabled or immediately returns to disabled

#### Scenario: Pay and receive
- **WHEN** the operator clicks enabled F3 and the player receives the verified payment
- **THEN** the preview shows the sender-specific receipt toast without opening a player Send dialog

### Requirement: F2 documentation and acceptance evidence
The user-story documentation SHALL include F2's exact label, payment direction, disabled state and receipt message. Evidence SHALL distinguish isolated tests from live Signet verification and SHALL NOT claim live completion from mocked outcomes.

#### Scenario: Delivery verification
- **WHEN** F2 is reported complete
- **THEN** evidence covers real-browser no-player disabling, account transitions, pending duplicate prevention and runtime toast rendering, plus actual two-wallet payment and receipt correlation
- **AND** unavailable live checks remain explicitly pending

### Requirement: Explain F2 unavailability
F2 SHALL append its current disabling reason in parentheses. Awaiting Balance SHALL be used for a balance still loading or below the required amount, rather than masking an unresolved operation. Other reasons SHALL distinguish Awaiting Player, Awaiting Game Wallet, Select A Different Wallet, Sending, Checking Wallet, Awaiting Confirmation, Wallet Operation Unresolved and Wallet Unavailable as applicable.

#### Scenario: Funds locked by unresolved operation
- **WHEN** the wallet has a positive raw balance but an unresolved operation prevents spending
- **THEN** F2 identifies the operation-related block and F1 shows 0 payment-usable sats

#### Scenario: Balance missing or insufficient
- **WHEN** an otherwise eligible wallet is loading its balance or has fewer than 1000 usable sats
- **THEN** F2 appends (Awaiting Balance)

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

### Requirement: Foldable Admin story sections
Each lettered Admin story section A-F SHALL fold independently and SHALL start expanded on a fresh page load. Its title line SHALL show a decorative > chevron to the left, pointing right when folded and down when expanded. Title font size, weight and color SHALL match the User Stories heading. Folding SHALL hide the section story summary and controls while preserving their state and existing behavior. The documentation section and Console SHALL remain outside this folding behavior.

#### Scenario: Pointer folding
- **WHEN** a user activates a story section title
- **THEN** that section toggles between expanded and folded while other sections retain their current fold state
- **AND** the chevron reflects the new state

#### Scenario: Keyboard folding
- **WHEN** the title has keyboard focus and Enter or Space is pressed
- **THEN** its section toggles with a visible keyboard focus indicator

#### Scenario: Preserve state
- **WHEN** a user folds a section, another Admin action causes a rerender, and the section is reopened
- **THEN** folding survives the rerender and the existing child selection and controls remain intact

#### Scenario: Narrow layout
- **WHEN** the Admin panel is narrow
- **THEN** the chevron and matching title remain readable and expanded content remains in normal document flow

### Requirement: Admin payment direction labels
B1 SHALL append `(Player->Game)` to its existing quoted payment label without changing its BIS-owned continuation price. F3 SHALL display `F3. Send 100 Sats (Game->Player)` and its payment SHALL deliver exactly 100 sats to the player, with fees charged separately. Existing availability suffixes and guards SHALL remain applicable. Previously recorded payments SHALL retain their original amounts for recovery.

#### Scenario: Inspect payment actions
- **WHEN** Admin renders B1 and F3
- **THEN** their labels show the respective payment directions
- **AND** B1 retains its existing amount while a new F3 payment requests 100 sats

