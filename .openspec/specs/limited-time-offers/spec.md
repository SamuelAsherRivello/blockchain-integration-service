# limited-time-offers Specification

## Purpose

Provide real funded limited-time rewards with reusable client-side creation, claim, cancellation and recovery for host applications.

## Requirements

### Requirement: Verified funded contract capability
The public LTO factory SHALL enable creation by default, with each operation validating wallet readiness, supported Signet/operator terms, controlled inputs and zero normal-operation fees. A host MAY explicitly disable new creation with creationEnabled:false; this SHALL preserve existing-contract queries and recovery. Completion of a separate funded acceptance probe SHALL NOT be a runtime prerequisite. The initial treasure preset SHALL lock 1,000 sats supplied by the game and award 1,000 sats on claim without requiring an existing player balance; the reusable API SHALL carry an explicit amount rather than encode treasure semantics. Ordinary transfers or simulated success SHALL NOT substitute for a contract.

#### Scenario: Capability unavailable or fees changed
- **WHEN** required contract support or zero-fee terms cannot be verified
- **THEN** new creation is unavailable, existing records remain recoverable, and no silent fee deduction or new infrastructure is introduced

#### Scenario: Empty player wallet
- **WHEN** a connected usable player signer has zero sats and the game signer has sufficient verified eligible funds
- **THEN** the player balance alone does not prevent funding or a supported zero-fee claim

#### Scenario: Default factory and explicit rollback
- **WHEN** the host creates the public LTO controller without disabling creation
- **THEN** a ready session can attempt funding through the real adapter without a hardcoded acceptance switch
- **AND** explicitly disabling creation prevents new funding while preserving query, Claim/Reject/Refund and reconciliation for existing contracts

### Requirement: Wallet-scoped automatic funding
The host SHALL be able to initiate funding through a public API without opening Admin or requiring another acceptance click, using an already configured same-origin game signer. BIS SHALL validate current player/game identities, readiness, network and eligible unreserved funds. A public receiving address SHALL NOT count as game signing access. Session and operation identifiers SHALL make repeated host calls idempotent.

#### Scenario: Game signer absent
- **WHEN** only the game's public receiving address is configured
- **THEN** creation reports unavailable without embedding credentials, requesting an automatic secret transfer, or blocking gameplay

#### Scenario: Repeated Start callbacks
- **WHEN** multiple callbacks request the same session operation
- **THEN** at most one funding submission occurs and subsequent calls observe the existing operation

### Requirement: One unresolved offer per exclusivity key
BIS SHALL enforce an account/network/operator/game-scoped host-supplied exclusivity key before funding. Funding-pending and unknown operations SHALL occupy the slot. Prior cleanup SHALL resolve funds before slot release; deleting/hiding a record SHALL NOT release it. Cleanup SHALL be contract-specific and idempotent.

#### Scenario: Previous refund unresolved
- **WHEN** the host ends the old treasure offer and its refund cannot be immediately verified at the next Start
- **THEN** the old slot remains occupied and that session creates no replacement, including after later cleanup completes

#### Scenario: Concurrent tabs
- **WHEN** cooperating same-origin contexts attempt offers for the same key
- **THEN** only one obtains the durable funding slot and conflicting input reservations are rejected

### Requirement: Deadline-aware claim and refund
BIS SHALL revalidate claim eligibility against the immutable elapsed-time deadline at request and before submission. Reject/session end SHALL request supported cancellation returning sats to the game; while the client runs, expiry SHALL trigger eligible refund cleanup, and host start-menu checks SHALL invoke the same cleanup path. Expiry alone SHALL NOT imply a completed spend or disable a cryptographically valid claim branch. Once an operation might be submitted, BIS SHALL reconcile its actual outcome before competing spending.

#### Scenario: Claim after deadline
- **WHEN** the deadline has passed before claim submission eligibility is accepted
- **THEN** no new claim is submitted and the host receives a too-late outcome

#### Scenario: Slow accepted claim
- **WHEN** a claim may have been submitted before deadline but its result arrives later
- **THEN** BIS reports its verified success or failure, keeps uncertainty pending, and does not automatically initiate a conflicting refund

#### Scenario: Session ends during funding
- **WHEN** the host ends an attempt while funding is still pending
- **THEN** BIS persists the end request and reconciles the original funding, refunding if it succeeds without offering the reward again

### Requirement: Durable recovery and wallet policy participation
BIS SHALL persist sanitized contract records and encrypted recovery material before submission, reserve inputs/outpoints, preserve existing asset holdings, and correlate terminal evidence to the specific contract and recipient. Reload, timer suspension and wallet changes SHALL NOT imply completion or trigger duplicate operations. Contract records SHALL participate in existing logout pending-loss acknowledgement and Admin Reset policies; player cleanup SHALL NOT erase separate game-owned refund recovery.

#### Scenario: Browser closed at expiry
- **WHEN** the browser reopens after an unresolved offer's deadline
- **THEN** it restores and reconciles the original operation and requests eligible cleanup without claiming that a timer executed while closed

#### Scenario: Player logout
- **WHEN** the player confirms logout under existing acknowledgement rules
- **THEN** player-side cleanup does not assert cancellation and the game-owned unresolved contract remains reserved and recoverable

#### Scenario: Wrong receipt evidence
- **WHEN** an unrelated balance increase or transaction is observed
- **THEN** it does not mark the offer claimed or refunded

### Requirement: Unobtrusive operation feedback
BIS SHALL emit operation-specific pending and verified completion toasts for funding, claim and refund, deduplicated by operation and phase. Automatic host operations SHALL NOT open a Pending Operation Dialog or pause gameplay. Errors and unknown outcomes SHALL be truthful; success SHALL distinguish verified Arkade execution from Bitcoin L1 finality.

#### Scenario: Funding completes after session end
- **WHEN** late funding succeeds for an ended or expired offer
- **THEN** feedback describes return/recovery rather than advertising an available prize

#### Scenario: Repeated completion observation
- **WHEN** subscriptions and reconciliation observe the same terminal operation
- **THEN** only one completion toast is emitted for the active presentation session

#### Scenario: Preparation rejected
- **WHEN** an operation fails before submission
- **THEN** feedback identifies a supported sanitized failure reason without exposing raw provider messages or secret recovery material

### Requirement: Asset-preserving contract funding
Funding SHALL prefer asset-free unreserved inputs, but SHALL support eligible game inputs carrying assets when sufficient game-owned change can retain every asset. The contract reward output SHALL contain no assets. The exact asset quantities SHALL remain durable without loss of integer precision, and funding confirmation SHALL require matching spent-source and game-change evidence for every retained asset. Insufficient change or unverifiable asset data SHALL prevent submission; missing or mismatched receipt evidence SHALL retain uncertainty.

#### Scenario: All available sats share an asset carrier
- **WHEN** the game's eligible 53,000-sat output contains six assets and it creates a 1,000-sat offer
- **THEN** the contract receives 1,000 asset-free sats and game-owned change receives 52,000 sats and all six assets with their exact quantities

#### Scenario: Asset change cannot be verified
- **WHEN** receipt evidence omits, redirects or reduces an input asset in the game change
- **THEN** BIS does not confirm funding or release the unresolved operation's reservations
