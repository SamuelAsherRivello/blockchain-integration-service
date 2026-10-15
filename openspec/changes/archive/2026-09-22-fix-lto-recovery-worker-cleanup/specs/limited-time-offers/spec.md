# Spec Delta

## MODIFIED Requirements

### Requirement: Durable recovery and wallet policy participation
BIS SHALL persist sanitized contract records and encrypted recovery material before submission, reserve inputs/outpoints, preserve existing asset holdings, and correlate terminal evidence to the specific contract and recipient. Reload, timer suspension, wallet changes, and recovery-worker disposal SHALL NOT imply completion or trigger duplicate operations. Contract records SHALL participate in existing logout pending-loss acknowledgement and Admin Reset policies; player cleanup SHALL NOT erase separate game-owned refund recovery. When a recovery worker is disposed, it SHALL persist end-session markers for every unresolved contract owned by the disposed player/game pair, run a scoped reconciliation pass, and continue polling until those contracts reach terminal state or a replacement recovery worker takes ownership. Records belonging to another player, game wallet, network, or operator SHALL remain untouched.

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

#### Scenario: Disposed recovery worker
- **WHEN** a service instance is disposed while an unresolved LTO belongs to its active player/game wallet pair
- **THEN** the worker persists the end-session request and completes scoped refund/recovery reconciliation
- **AND** cleanup continues until the contract reaches a verified terminal state or is safely retained as unresolved for a future worker

#### Scenario: Unrelated recovery record
- **WHEN** the same durable store contains an unresolved contract for another operator, network, player, or game wallet
- **THEN** disposing the current worker does not mark, refund, or otherwise mutate that unrelated contract

#### Scenario: Idempotent disposal
- **WHEN** disposal, visibility recovery, and a replacement worker initiate overlapping reconciliation
- **THEN** they share or serialize the recovery pass without duplicate refund submissions or duplicate terminal notifications
