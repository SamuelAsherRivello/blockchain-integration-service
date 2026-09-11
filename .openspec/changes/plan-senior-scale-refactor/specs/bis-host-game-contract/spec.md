## ADDED Requirements

### Requirement: BIS exposes a complete game host contract

The public BIS package SHALL export `BisHostGame` and its associated types: `BisHostGameSessionReference`, `BisHostGameContinuationTarget`, `BisHostGameConfirmedContinuation`, `BisHostGameConfirmedPlayerReward`, and `BisHostGameEffectReceipt`.

#### Scenario: A game implements the public boundary

- **WHEN** a game adapter is checked against `BisHostGame`
- **THEN** it SHALL implement all four named methods with the published input and return types
- **AND** it SHALL not require an Arkade type or BIS internal import.

### Requirement: Host effects are session-scoped and idempotent

The game host SHALL identify effects by a stable `operationId` within its active game session and SHALL return only `applied`, `already-applied`, or `not-applicable` receipts.

#### Scenario: A confirmed command is replayed

- **WHEN** a matching confirmed command is delivered twice in the active session
- **THEN** the first delivery SHALL apply its game effect
- **AND** the second delivery SHALL return `already-applied` without reapplying the effect.

#### Scenario: A command targets an ended or replaced session

- **WHEN** a confirmed command does not match the active session
- **THEN** the host SHALL return `not-applicable`
- **AND** it SHALL not mutate the current game state.

### Requirement: BIS provides a game-facing composition facade

The public BIS package SHALL export `BisGameServices` as the lifecycle-owning game facade and SHALL route verified game continuation and reward results through its `BisHostGame`.

#### Scenario: A host receipt is inapplicable

- **WHEN** the host returns `not-applicable` or `already-applied`
- **THEN** BIS SHALL treat the confirmed financial operation as unchanged
- **AND** it SHALL not retry, reverse, recharge, mint, or otherwise alter the financial result.
