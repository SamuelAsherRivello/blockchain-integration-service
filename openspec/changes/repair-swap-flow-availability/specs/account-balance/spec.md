# Spec Delta

## ADDED Requirements

### Requirement: Per-side available balance projection
Account Details SHALL load and expose validated available sats for both the Bitcoin and Arkade portions of the active account in the same complete balance read as their totals. A side's available value SHALL be distinguishable from its total and SHALL never be synthesized from an unavailable or partial read.

#### Scenario: Complete mixed balance
- **WHEN** a fresh read reports Bitcoin and Arkade totals plus their independently validated available amounts
- **THEN** Account Details shows each side's total and available values from that same account-scoped read

#### Scenario: Availability cannot be verified
- **WHEN** the provider cannot validate one side's available amount
- **THEN** the balance read is incomplete or unavailable and the UI does not display a guessed zero or stale available value

### Requirement: Balance availability remains presentation-only
Cached per-side availability SHALL support Account Details and Swap presentation but SHALL NOT authorize a transfer. Review and confirmation SHALL retain their required live eligibility and reservation checks.

#### Scenario: Cached balance precedes transfer review
- **WHEN** Swap opens using a complete cached balance projection
- **THEN** the cached values populate presentation and the transfer performs a fresh direction-specific eligibility check before review or submission
