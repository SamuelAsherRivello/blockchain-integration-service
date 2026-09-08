## ADDED Requirements

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
