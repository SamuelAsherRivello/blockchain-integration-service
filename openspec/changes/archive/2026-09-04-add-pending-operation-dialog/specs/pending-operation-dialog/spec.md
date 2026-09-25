## Purpose

Keep runtime pages covered during asynchronous preparation and operations so users interact only with fully prepared content.

## ADDED Requirements

### Requirement: Shared pending operation presentation
Runtime page loads and user-triggered operations SHALL immediately render a shared Pending Operation Dialog above a dark translucent host-scoped backdrop. The label SHALL end in ing... and appear above the spinning bolt. Pending presentation SHALL have no interactive actions or dismissal. Background reconciliation and Admin-only operations SHALL NOT open this dialog. Reduced motion SHALL disable rotation, and keyboard users SHALL NOT reach covered runtime controls.

#### Scenario: Initial page preparation
- **WHEN** a runtime page begins loading
- **THEN** it and the covering layer render together, no unfinished frame is exposed, and no inline Loading... message is rendered

### Requirement: Complete readiness before reveal
The dialog SHALL remain through operation completion, required data refresh, final rendering and required image readiness or fallback. Account opening, creation, persistence, restoration, logout, Details, Transactions/detail, Receive, Recovery Phrase, Assets/detail, Send, Transfer, and visible Reset SHALL follow this contract. Background updates SHALL not block an already prepared page. Record statuses such as Pending remain valid content.

#### Scenario: Burn and refresh
- **WHEN** a confirmed burn succeeds
- **THEN** Burning... remains through holdings refresh and preparation, after which refreshed Assets appears without Asset burned. or another inline async message

#### Scenario: Overlapping and obsolete work
- **WHEN** multiple requests overlap or an old account/page request completes
- **THEN** one dialog represents current work and obsolete results cannot reveal, replace or reopen current content

### Requirement: Bounded read retry and terminal errors
Failed data loading SHALL retry once automatically without dismissing the dialog. Each attempt SHALL retain an existing deadline or use 30 seconds where missing; initial Transactions loading SHALL retain its current 75-second runtime budget. After the retry fails, the dialog SHALL show safe contextual error text and only OK. OK SHALL close the dialog and source page, returning to a prepared parent or covering its preparation. Submission SHALL NOT be automatically repeated. Unknown outcomes SHALL be identified as unconfirmed with OK, preserving recovery state.

#### Scenario: Exhausted read retry
- **WHEN** the initial data read and its single automatic retry fail or time out
- **THEN** the spinner becomes an error with OK and acknowledgement closes the failed page instead of exposing partial data

#### Scenario: Refresh fails after successful mutation
- **WHEN** a post-burn refresh fails
- **THEN** only the refresh is retried and burn submission remains exactly once

#### Scenario: Uncertain mutation
- **WHEN** existing mutation handling returns an unconfirmed outcome
- **THEN** the dialog says the outcome is not yet confirmed, OK closes its source page, and transaction recovery records remain intact
