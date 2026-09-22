# Spec Delta

## MODIFIED Requirements

### Requirement: One unresolved offer per exclusivity key
BIS SHALL enforce an account/network/operator/game-scoped host-supplied exclusivity key before funding. Funding-pending and unknown operations SHALL occupy the slot. Prior cleanup SHALL resolve funds before slot release; deleting/hiding a record SHALL NOT release it. Cleanup SHALL be contract-specific and idempotent. Concurrent eligible starts for the same player, game, network, operator and exclusivity key SHALL be deterministic: exactly one start MAY acquire the durable funding slot, while the others SHALL report unavailable or skipped without recording or submitting overlapping funding. A start that was skipped because readiness was absent SHALL NOT become eligible later for that same session after readiness changes.

#### Scenario: Previous refund unresolved
- **WHEN** the host ends the old treasure offer and its refund cannot be immediately verified at the next Start
- **THEN** the old slot remains occupied and that session creates no replacement, including after later cleanup completes

#### Scenario: Concurrent tabs
- **WHEN** independent browsers or origins attempt offers for the same key through the shared service
- **THEN** only one obtains the durable funding slot and conflicting input reservations are rejected

#### Scenario: Cooperating controllers start together
- **WHEN** cooperating controllers for the same player, game and exclusivity key request different sessions at the same time while no prior offer is unresolved
- **THEN** exactly one request obtains the funding slot
- **AND** the losing sessions remain skipped or unavailable without adopting the winning session's contract or submitting claims

#### Scenario: Readiness failure does not poison later sessions
- **WHEN** one session attempts to start while required player or game readiness is absent
- **THEN** that session remains skipped even if readiness appears later
- **AND** a later fresh session with readiness may compete normally for the exclusivity slot
