## MODIFIED Requirements

### Requirement: Implemented demonstrations only
The Admin UI SHALL show only implemented demonstrations and nonempty categories. It SHALL begin without a selected story, including after refresh. Existing implemented Account demonstrations SHALL remain available, including Account Button, Create Account, Restore Account, Account Balance, Inspect Activity, and Log Out. Assets / C1 Mint Asset and C4 List Assets SHALL remain available alongside them. Pay-to-play SHALL expose Request Continue only once its real operation is implemented; other unimplemented stories and game-specific Achievements SHALL be omitted. The Admin heading SHALL be followed by User Stories and a Documentation link to bundled user-story Markdown that works in development and production builds. It SHALL NOT show Interactivity.

#### Scenario: Initial demo
- **WHEN** the demo loads
- **THEN** Account Button, Create Account, Restore Account, Account Balance, Inspect Activity, and Log Out are available under Account alongside C1/C4 asset controls, with empty Runtime Preview
- **AND** no filler cards, introduction, WIP badges, or empty categories appear
- **AND** Request Continue appears under Pay-to-play only after its operation is implemented

## ADDED Requirements

### Requirement: Admin continuation request and Console outcomes
Admin SHALL provide a Request Continue button with a visible 1,000-sat demo price, using the public continuation API and Console for pending, success, and error outcomes. It SHALL NOT add or replace Runtime Preview content, create game state, or open a second review overlay. Repeated clicks during an unresolved attempt SHALL NOT create additional payments. Console output SHALL identify the operation without exposing secrets. The demo SHALL NOT fabricate transaction success.

#### Scenario: Request through Admin
- **WHEN** the user clicks Request Continue with its displayed default price
- **THEN** Admin requests 1,000 sats through the public API and reports its actual status in Console without changing Runtime Preview

#### Scenario: Request fails
- **WHEN** the request encounters validation, account availability, insufficient funds, or confirmed operation failure
- **THEN** Console reports the corresponding error without implying continuation success
