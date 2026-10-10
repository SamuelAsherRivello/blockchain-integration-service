# bis-game-contract Specification

## Purpose

Defines the versioned, provider-neutral boundary through which BIS delivers confirmed wallet workflow outcomes to a game without taking ownership of game state, scenes, or provider implementation details.

## Requirements

### Requirement: BIS exposes a complete game host contract

The public BIS package SHALL export `IBis` and `IBisGame` as the main game-facing contracts, with readonly provider-neutral payload types. `IBisGame` SHALL include session read, continuation-target capture, confirmed continuation, confirmed reward and typed event notification methods. System interaction types SHALL start with `IBis` or `Bis`; BIS-promoted game interaction types SHALL start with `IBisGame` or `BisGame`.

#### Scenario: A game implements the public boundary
- **WHEN** a game adapter is checked against `IBisGame`
- **THEN** it SHALL implement all five named methods with the published input and return types
- **AND** it SHALL not require an Arkade type or BIS internal import

#### Scenario: A game consumes the BIS boundary
- **WHEN** a consumer uses the promoted game API
- **THEN** it SHALL use named `IBis` methods and `IBisGame` callbacks without obtaining internal contexts, wallets, UI objects or workflow controllers
- **AND** all supporting interaction types SHALL follow their system/game naming category

### Requirement: Host effects are session-scoped and idempotent

The game host SHALL identify effects by a stable `operationId` within the originating game session and SHALL return only `applied`, `already-applied`, or `not-applicable` receipts. BIS SHALL bind gameplay effects before asynchronous financial work and SHALL never substitute the session active at completion. Concurrent delivery SHALL not apply the same effect twice.

#### Scenario: A confirmed command is replayed
- **WHEN** a matching confirmed command is delivered twice in the active session
- **THEN** the first delivery SHALL apply its game effect
- **AND** the second delivery SHALL return `already-applied` without reapplying the effect

#### Scenario: A command targets an ended or replaced session
- **WHEN** a confirmed command does not match the active session
- **THEN** the host SHALL return `not-applicable`
- **AND** it SHALL not mutate the current game state

#### Scenario: A reward completes after a different run begins
- **WHEN** a reward operation completes after its originating run has ended
- **THEN** BIS SHALL retain its original session binding rather than capture the replacement run
- **AND** financial confirmation SHALL remain independent of an inapplicable game effect

#### Scenario: Duplicate deliveries overlap
- **WHEN** two deliveries with the same session and operation ID arrive before the first effect finishes
- **THEN** at most one game mutation SHALL occur
- **AND** a duplicate of an applied effect SHALL report `already-applied`

### Requirement: BIS provides a game-facing composition facade

The public BIS package SHALL export `BisService` implementing `IBis` as the lifecycle-owning game facade and SHALL route verified game continuation and reward results through its `IBisGame`. The facade SHALL also expose a provider-neutral force-reset operation for a consuming game's Clear All Settings flow; the operation SHALL not require Arkade-specific types, wallet secrets, or BIS-internal imports.

#### Scenario: A host receipt is inapplicable
- **WHEN** the host returns `not-applicable` or `already-applied`
- **THEN** BIS SHALL treat the confirmed financial operation as unchanged
- **AND** it SHALL not retry, reverse, recharge, mint, or otherwise alter the financial result

#### Scenario: A game invokes the public reset
- **WHEN** a consuming game calls the facade's force-reset operation
- **THEN** the call SHALL reset BIS-owned player-wallet, game-wallet, workflow, journal, UI, and session state according to the game-state-reset contract
- **AND** the call surface SHALL remain provider-neutral and free of recovery material

#### Scenario: The facade is disposed
- **WHEN** a game disposes its BIS facade
- **THEN** BIS SHALL detach its UI, workflow listeners and host delivery
- **AND** submitted financial operations SHALL remain truthful and recoverable under the existing disposal policy, without a remote cancellation claim

### Requirement: Named operations cover the game integration surface

`IBis` SHALL cover lifecycle/UI entry, safe state/capability reads, continuation, reward collection, equipment, contract queries/actions/session end, reset and disposal. Workflow commands SHALL exchange identifiers and readonly DTOs rather than controllers. Financial status, eligibility and game-effect receipts SHALL remain separate facts.

#### Scenario: A game runs a continuation or trophy workflow
- **WHEN** the game begins, inspects, pays or collects, checks, acknowledges or ends a workflow
- **THEN** each action SHALL use a named `IBis` method with the appropriate typed request, state or result
- **AND** awaiting a method SHALL not falsely imply financial confirmation or successful game delivery

#### Scenario: A game manages equipment and treasure
- **WHEN** the game refreshes/selects equipment or starts, queries, claims, rejects or ends a limited-time offer
- **THEN** it SHALL use `IBis` methods and safe projections
- **AND** wallet profile, application, gameplay-session and offer-session identities SHALL not be conflated

### Requirement: Safe state and notifications share one host channel

BIS SHALL provide a readonly safe snapshot and notify the game through `IBisGame.onBisEvent` about snapshot changes, Account dismissal, restart requests and operation/effect changes. Snapshots SHALL distinguish unavailable state from empty success. Notifications SHALL contain no wallet secrets, SDK objects or raw provider errors.

#### Scenario: Account closes or logout requests restart
- **WHEN** BIS closes Account or completes a logout that requires game restart
- **THEN** the typed notification SHALL identify the action without requiring observation of internal UI state
- **AND** restart notification SHALL include a stable identity for host deduplication

#### Scenario: Contract funding confirms while the game window is closed
- **WHEN** BIS observes a pending contract become confirmed
- **THEN** its safe contract projection and host notification SHALL update independently of game UI polling
- **AND** financial confirmation SHALL not alone assert that the current gameplay target is eligible

#### Scenario: Reset invalidates old work
- **WHEN** pre-reset work completes after the reset generation has changed
- **THEN** it SHALL not publish a stale snapshot, deliver a game effect, or reactivate cleared state

### Requirement: Contract consolidation preserves existing financial policies

The new game boundary SHALL preserve existing source/destination, prices, exact quantities, funding checks, reservations and recovery rules. Item support SHALL remain Player-Wallet-only. Workflow action availability SHALL reflect the actual operation's prerequisites, not an unrelated global gate. Non-game public APIs SHALL remain supported for their existing consumers.

#### Scenario: A trophy is collected under existing funding policy
- **WHEN** the existing collection operation is eligible through the new boundary
- **THEN** it SHALL use its existing wallet source/destination and exact trophy quantity
- **AND** the interface refactor SHALL not introduce another funding source or mint a duplicate reward

#### Scenario: Admin or Marketplace uses its public API
- **WHEN** those consumers build or run after contract consolidation
- **THEN** their supported public imports and behavior SHALL remain functional without game-private access

### Requirement: Current integration documentation describes the released contract

Affected current documentation SHALL describe implemented interface names, data ownership, workflow/effect boundaries and exported version truthfully. Both deep dives SHALL link to the actual repositories, source paths and companion pages. Historical records SHALL remain identifiable as historical rather than being silently rewritten.

#### Scenario: A developer follows a documented example
- **WHEN** a developer follows current game-integration guidance for the released package
- **THEN** its example SHALL use the exported contracts and valid source links
- **AND** it SHALL not promote removed game backdoors or claim unsupported runtime/financial verification
