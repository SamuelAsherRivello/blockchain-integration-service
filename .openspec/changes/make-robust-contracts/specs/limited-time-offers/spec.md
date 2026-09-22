# Spec Delta

## MODIFIED Requirements

### Requirement: One unresolved offer per exclusivity key
BIS SHALL enforce an account, network, operator, game, and host-supplied exclusivity key before funding. Funding-pending and unknown operations SHALL occupy the slot. Prior cleanup SHALL resolve funds before slot release; deleting or hiding a record SHALL NOT release it. Contract records, input reservations, and cleanup markers SHALL be persisted in the active network scope, and a record from another network SHALL neither occupy nor release the active network's slot. Cleanup SHALL be contract-specific and idempotent.

#### Scenario: Previous refund unresolved
- **WHEN** the host ends the old treasure offer and its refund cannot be immediately verified at the next Start
- **THEN** the old slot remains occupied and that session creates no replacement, including after later cleanup completes

#### Scenario: Cross-network unresolved offer
- **WHEN** an unresolved Signet offer exists and a Mutinynet host starts the same exclusivity key
- **THEN** the Mutinynet attempt evaluates only Mutinynet records and may proceed when its own wallet and inputs are eligible
- **AND** the Signet offer remains recoverable and reserved in Signet scope

#### Scenario: Concurrent tabs
- **WHEN** independent browsers or origins attempt offers for the same key through the shared service
- **THEN** only one obtains the durable funding slot within the same account, network, operator, and game scope
- **AND** conflicting input reservations are rejected without cross-network contention

### Requirement: Durable recovery and wallet policy participation
BIS SHALL persist sanitized contract records and encrypted recovery material before submission, reserve inputs/outpoints, preserve existing asset holdings, and correlate terminal evidence to the specific contract and recipient. Recovery documents, encrypted storage namespaces, reservations, cleanup markers, and reset boundaries SHALL be scoped to the active account, network, operator, and game where applicable. Reload, timer suspension and wallet changes SHALL NOT imply completion or trigger duplicate operations. Contract records SHALL participate in existing logout pending-loss acknowledgement and Admin Reset policies; player cleanup SHALL NOT erase separate game-owned refund recovery, and cleanup for one network SHALL NOT erase unresolved recovery from another network.

#### Scenario: Browser closed at expiry
- **WHEN** the browser is closed when an unresolved offer's deadline passes
- **THEN** the running service performs eligible cleanup, and reopening the browser reads the original operation's verified state without creating a replacement
- **AND** if the service was also stopped, its restart resumes durable recovery without claiming cleanup occurred while it was stopped

#### Scenario: Player logout
- **WHEN** the player confirms logout under existing acknowledgement rules
- **THEN** player-side cleanup does not assert cancellation and the game-owned unresolved contract remains reserved and recoverable

#### Scenario: Wrong receipt evidence
- **WHEN** an unrelated balance increase or transaction is observed
- **THEN** it does not mark the offer claimed or refunded

#### Scenario: Network-isolated reset
- **WHEN** an administrator resets the active network while another network has unresolved contract recovery
- **THEN** only the active network's contract records, reservations, and recovery state are reset or retained according to existing reset policy
- **AND** the other network's unresolved recovery remains intact and recoverable
