## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Nonblocking onboarding presentation
Automatic onboarding assessment, funding waits, settlements and recovery SHALL NOT cover gameplay or the prepared onboarding details page with a Pending Operation Dialog. The details page SHALL render a prepared account-scoped status shell with Checking or available durable progress immediately and remain navigable while observations resolve. Recoverable background failures SHALL remain visible as status with automatic safe retries; blocked states SHALL explain their reason without closing the details page or claiming completion. Unrelated foreground page reads and manual operations SHALL retain their existing dialog behavior.

#### Scenario: Waiting for funding
- **WHEN** onboarding is observing an unfunded account
- **THEN** the player can play, navigate, copy the funding address and open the faucet without a settlement-length overlay

#### Scenario: Background observation fails
- **WHEN** an onboarding status request fails or its stream closes
- **THEN** details remain inspectable, report the affected verification and retry safely without a modal acknowledgement or financial replay
