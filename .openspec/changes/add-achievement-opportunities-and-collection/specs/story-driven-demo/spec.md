## MODIFIED Requirements

### Requirement: Implemented demonstrations only
The Admin UI SHALL show only implemented demonstrations and categories containing at least one such demonstration. It SHALL start without a selected story, including after refresh. This slice SHALL expose Account / Account Button, Account / Create Account, Account / Restore Account, Account / Account Balance, and Account / Log Out, plus Achievements / C1 Earn Achievements and C4 View Achievements. It SHALL omit Pay-to-play, other unimplemented achievement stories, and Possible refactors from executable demonstrations.

The Admin heading SHALL be followed by User Stories and a Documentation link to bundled user-story Markdown, then the implemented categories and story actions. It SHALL NOT show Interactivity. The documentation link SHALL work in development and the built demo.

#### Scenario: Initial demo
- **WHEN** the implemented demo loads
- **THEN** the existing Account demonstrations and the C1/C4 achievement controls are available and Runtime Preview content is empty
- **AND** no filler cards, introduction, WIP badges, or empty categories appear

## ADDED Requirements

### Requirement: Admin-only achievement API demonstrations
C1 SHALL be a non-clickable story container containing an Earn button. Earn SHALL call the same public production API available to a game with the exact string ``achievement-`level-one` ``. C4 SHALL have a View Achievements button calling the public listing API. Neither action SHALL open achievement UI, render content in Runtime Preview, or alter existing preview content. Existing account-flow navigation restrictions SHALL be preserved. These controls SHALL not fabricate accounts, asset ownership, or successful transaction results.

#### Scenario: Click C1 container
- **WHEN** the user clicks the C1 container outside its Earn button
- **THEN** no API request or preview navigation occurs

#### Scenario: Earn and view
- **WHEN** the user clicks Earn or View Achievements outside an open account flow
- **THEN** the corresponding production API is called and its result is shown in Admin Console
- **AND** Runtime Preview is unchanged

### Requirement: Always-visible Admin Console
Admin SHALL display a region titled Admin Console below the story controls from initial load onward. It SHALL show pending requests and the public results or sanitized errors returned by C1 and C4, including earned, already-owned, account-required, and the actual achievement list. Entries SHALL label the operation and originating account where known. The console SHALL render returned text safely, remain scrollable as entries accumulate, and avoid exposing secrets. Its history SHALL be transient and SHALL be cleared on refresh and Reset Client.

#### Scenario: Logged-out request
- **WHEN** Earn or View Achievements is clicked without an account
- **THEN** Admin Console shows account-required and no Account dialog opens

#### Scenario: Actual result list
- **WHEN** View Achievements succeeds
- **THEN** Admin Console shows the returned list, including an explicit empty array for an empty collection

### Requirement: Achievement delivery evidence and future story note
C1/C4 delivery SHALL include synchronized story diagrams and design discussion describing API-only earn/list behavior, real Signet issuance and restoration evidence, independent-host parity without UI mounting, repeat protection, and failure states. Existing story and step IDs SHALL remain stable; superseded C1 opportunity-only and C4 Account-dialog assumptions SHALL be identified. D. Possible refactors SHALL contain a brief D1 game-controlled wallet or issuer idea explicitly requiring further specification, without implementing it. Unperformed live checks SHALL remain pending.

#### Scenario: Report delivery
- **WHEN** C1/C4 completion is reported
- **THEN** funded issuance, listing after restoration, duplicate protection, and browser Admin behavior have supporting evidence
- **AND** unrelated pending A2/A4/A6 checks and deferred B/C2/C3/C5/D1 scope are not reported as completed
