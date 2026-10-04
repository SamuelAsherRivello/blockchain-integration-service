## MODIFIED Requirements

### Requirement: Bounded read retry and terminal errors
Failed data loading SHALL retry once automatically without dismissing the dialog. Each attempt SHALL retain an existing deadline or use 30 seconds where missing; initial Transactions loading SHALL retain its current 75-second runtime budget. After the retry fails, the shared terminal error prompt SHALL retain the Pending Operation Dialog's backdrop, placement, focus handling, and only-OK acknowledgement. It SHALL title the prompt exactly `Error`, display the safe contextual error text as its body copy, and omit the loading lightning bolt. OK SHALL close the dialog and source page, returning to a prepared parent or covering its preparation. Submission SHALL NOT be automatically repeated, except for the narrowly proven safe automatic-onboarding transitions defined in account-automatic-onboarding; ambiguous registration SHALL never be replayed. The onboarding details shell and its background observation follow the nonblocking onboarding presentation requirement rather than this foreground read-error closure contract. Unknown outcomes SHALL be identified as unconfirmed with OK, preserving recovery state.

#### Scenario: Exhausted read retry
- **WHEN** the initial data read and its single automatic retry fail or time out
- **THEN** the shared dialog replaces the loading prompt with the title `Error`, the safe error text as body copy, no lightning bolt, and an OK acknowledgement that closes the failed page instead of exposing partial data

#### Scenario: Refresh fails after successful mutation
- **WHEN** a post-burn refresh fails
- **THEN** only the refresh is retried and burn submission remains exactly once

#### Scenario: Uncertain mutation
- **WHEN** existing mutation handling returns an unconfirmed outcome
- **THEN** the dialog says the outcome is not yet confirmed, OK closes its source page, and transaction recovery records remain intact
