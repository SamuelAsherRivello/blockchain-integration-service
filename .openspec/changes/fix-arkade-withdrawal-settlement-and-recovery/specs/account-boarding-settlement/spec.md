## ADDED Requirements

### Requirement: Attributable settlement failures
Each submitted withdrawal SHALL distinguish observed batch participation, signing progress, commitment availability and verified receipt. An interrupted operation SHALL retain its exact identity and the last safely observable attempted and acknowledged stage, plus a sanitized failure category when available. Missing legacy evidence SHALL be reported as unknown rather than reconstructed as fact. Progress observations SHALL NOT authorize success, replay or input release.

#### Scenario: Failure after participation confirmation
- **WHEN** participation is acknowledged but tree validation, signing initialization, provider submission or event delivery fails
- **THEN** the operation reports interruption and its observed failure boundary without claiming broadcast or completion
- **AND** no replacement withdrawal is automatically submitted

#### Scenario: Private failure payload
- **WHEN** an underlying failure contains a signed proof, nonce, recovery phrase or arbitrary provider payload
- **THEN** persisted and displayed diagnostics contain only allowed public fields and static failure labels

### Requirement: Withdrawal completion acceptance after payments and minting
Withdrawal repair SHALL require an actual confirmed Bitcoin receipt and exact owned asset change, not registration, a completed UI flow or a simulated settlement result. The original operation SHALL remain attributable across navigation and read-only reconciliation. A local post-broadcast failure SHALL NOT prevent later recognition of valid completion or authorize replay.

#### Scenario: Full player sequence
- **WHEN** a player logs in, logs out, restores a funded account, pays 1,000 sats to continue, mints to the player, pays 1,000 sats again, and explicitly confirms a 1,000-sat Arkade-to-Bitcoin withdrawal
- **THEN** successful withdrawal acceptance requires the matching confirmed Bitcoin receipt, exact Arkade change and preserved asset IDs and quantities
- **AND** the same account can pay 1,000 sats afterward from sufficient fresh eligible funds without logout

#### Scenario: Pending same-input payment
- **WHEN** the player attempts B1 before the sole input's withdrawal has resolved
- **THEN** that payment cannot reuse the reserved input or claim success
- **AND** its result explains the reservation rather than describing the positive total balance as zero

#### Scenario: Broadcast followed by local failure
- **WHEN** settlement has broadcast but local processing fails before the application records success
- **THEN** later verified receipt reconciliation resolves the original withdrawal without another submission

#### Scenario: Infrastructure checks only
- **WHEN** diagnostics, builds and isolated tests pass but no matching live confirmed receipt is available
- **THEN** withdrawal completion acceptance remains outstanding
