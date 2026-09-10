# pending-operation-dialog Specification

## Purpose

Keep runtime pages covered during asynchronous preparation and operations so users interact only with fully prepared content.

## Requirements

### Requirement: Shared pending operation presentation
Except for burn progress and its follow-up holdings refresh, runtime page loads and user-triggered operations SHALL immediately render a shared Pending Operation Dialog above a dark translucent host-scoped backdrop. The label SHALL end in ing... and appear above the spinning bolt. Pending presentation SHALL have no interactive actions or dismissal. Background reconciliation and Admin-only operations SHALL NOT open this dialog. Reduced motion SHALL disable rotation, and keyboard users SHALL NOT reach covered runtime controls.

#### Scenario: Initial page preparation
- **WHEN** a runtime page begins loading
- **THEN** it and the covering layer render together, no unfinished frame is exposed, and no inline Loading... message is rendered

### Requirement: Complete readiness before reveal
The dialog SHALL remain through operation completion, required data refresh, final rendering and required image readiness or fallback. Account opening, creation, persistence, restoration, logout, Details, Transactions/detail, Receive, Recovery Phrase, Assets/detail, Send, Transfer, and visible Reset SHALL follow this contract. Background updates SHALL not block an already prepared page. Record statuses such as Pending remain valid content. Burn submission and its follow-up holdings refresh SHALL use the asset-burning toast flow without opening a progress overlay; unrelated initial Assets loads retain this contract.

#### Scenario: Burn and refresh
- **WHEN** a confirmed burn succeeds
- **THEN** a confirmed toast is queued and holdings refresh without a covering progress dialog, after which refreshed Assets appears without an inline async message

#### Scenario: Overlapping and obsolete work
- **WHEN** multiple requests overlap or an old account/page request completes
- **THEN** one dialog represents current work and obsolete results cannot reveal, replace or reopen current content

### Requirement: Bounded read retry and terminal errors
Failed data loading SHALL retry once automatically without dismissing the dialog. Each attempt SHALL retain an existing deadline or use 30 seconds where missing; initial Transactions loading SHALL retain its current 75-second runtime budget. After the retry fails, the dialog SHALL show safe contextual error text and only OK. OK SHALL close the dialog and source page, returning to a prepared parent or covering its preparation. Submission SHALL NOT be automatically repeated, except for the narrowly proven safe automatic-onboarding transitions defined in account-automatic-onboarding; ambiguous registration SHALL never be replayed. The onboarding details shell and its background observation follow the nonblocking onboarding presentation requirement rather than this foreground read-error closure contract. Unknown outcomes SHALL be identified as unconfirmed with OK, preserving recovery state.

#### Scenario: Exhausted read retry
- **WHEN** the initial data read and its single automatic retry fail or time out
- **THEN** the spinner becomes an error with OK and acknowledgement closes the failed page instead of exposing partial data

#### Scenario: Refresh fails after successful mutation
- **WHEN** a post-burn refresh fails
- **THEN** only the refresh is retried and burn submission remains exactly once

#### Scenario: Uncertain mutation
- **WHEN** existing mutation handling returns an unconfirmed outcome
- **THEN** the dialog says the outcome is not yet confirmed, OK closes its source page, and transaction recovery records remain intact

### Requirement: Nonblocking onboarding presentation
Automatic onboarding assessment, funding waits, settlements and recovery SHALL NOT cover gameplay or the prepared onboarding details page with a Pending Operation Dialog. The details page SHALL render a prepared account-scoped status shell with Checking or available durable progress immediately and remain navigable while observations resolve. Recoverable background failures SHALL remain visible as status with automatic safe retries; blocked states SHALL explain their reason without closing the details page or claiming completion. Unrelated foreground page reads and manual operations SHALL retain their existing dialog behavior.

#### Scenario: Waiting for funding
- **WHEN** onboarding is observing an unfunded account
- **THEN** the player can play, navigate, copy the funding address and open the faucet without a settlement-length overlay

#### Scenario: Background observation fails
- **WHEN** an onboarding status request fails or its stream closes
- **THEN** details remain inspectable, report the affected verification and retry safely without a modal acknowledgement or financial replay
