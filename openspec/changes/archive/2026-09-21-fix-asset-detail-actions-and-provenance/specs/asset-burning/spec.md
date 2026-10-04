# Spec Delta

## ADDED Requirements

### Requirement: Valid Asset Detail burn is not falsely blocked by presentation state
When Asset Detail has a fresh positive holding and the active account/network context is valid, the Burn control SHALL remain independently actionable even if the Explorer URL is unavailable or optional provenance is missing. Burn SHALL continue to use the existing explicit confirmation, exact holding revalidation, durable pre-submit intent, duplicate-submission protection, and unknown-outcome handling. A network, provider, account, or coordination failure SHALL be surfaced as a truthful safe error rather than silently disabling the action or claiming success.

#### Scenario: Missing explorer metadata does not block burn
- **WHEN** a valid owned asset has no constructible Explorer URL but its active account and holding can be verified
- **THEN** Burn remains available, confirmation submits the exact selected quantity once, and Explorer remains the only disabled action

#### Scenario: Provider mismatch is reported safely
- **WHEN** the selected holding is visible but the burn provider cannot be verified for the active account network
- **THEN** no burn is submitted, the player receives a safe actionable error, and no confirmed success is shown

#### Scenario: Burn response becomes unknown
- **WHEN** a burn may have crossed the submission boundary without a confirmed response
- **THEN** the operation remains recoverable and protected from duplicate submission while the detail UI does not infer completion from a changed holding
