## MODIFIED Requirements

### Requirement: Wallet-scoped automatic funding
The host SHALL be able to initiate funding through a public API without opening Admin or requiring another acceptance click, using the selected browser-local game wallet supplied through F1 or F2. Local, preview, and deployed games SHALL use the same direct Arkade workflow without a BIS application wallet service. BIS SHALL validate current player/game identities, readiness, network and eligible unreserved funds. A public receiving address SHALL NOT count as game signing access. Session and operation identifiers SHALL make repeated host calls idempotent.

#### Scenario: Game signer absent
- **WHEN** no selected game wallet has local signing access
- **THEN** creation reports unavailable without starting a service request, transferring recovery material, or blocking gameplay

#### Scenario: Repeated Start callbacks
- **WHEN** multiple callbacks request the same session operation
- **THEN** at most one funding submission occurs and subsequent calls observe the existing operation

#### Scenario: Serverless host
- **WHEN** a Runtime Preview or deployed game has no BIS wallet-service endpoint
- **THEN** a selected local game wallet can still fund a supported offer directly through Arkade

### Requirement: One unresolved offer per exclusivity key
BIS SHALL enforce an account/network/operator/game-scoped host-supplied exclusivity key before funding within the local selected-game-wallet session. Funding-pending and unknown operations SHALL occupy the slot. Prior cleanup SHALL resolve funds before slot release; deleting or hiding a record SHALL NOT release it. Cleanup SHALL be contract-specific and idempotent. Same-origin contexts SHALL reconcile a shared local slot before competing funding; separate browser origins do not claim cross-origin coordination.

#### Scenario: Previous refund unresolved
- **WHEN** the host ends the old treasure offer and its refund cannot be immediately verified at the next Start
- **THEN** the old slot remains occupied and that session creates no replacement, including after later cleanup completes

#### Scenario: Concurrent same-origin contexts
- **WHEN** two same-origin BIS contexts attempt offers for the same key and selected game wallet
- **THEN** only one obtains the local durable funding slot and conflicting input reservations are rejected

#### Scenario: Concurrent tabs
- **WHEN** independent same-origin browser tabs attempt offers for the same key through their shared local game-wallet selection
- **THEN** only one obtains the durable local funding slot and conflicting input reservations are rejected

### Requirement: Deadline-aware claim and refund
BIS SHALL revalidate claim eligibility against the immutable elapsed-time deadline at request and before submission. Reject and session end SHALL request supported cancellation returning sats to the game. Expiry cleanup SHALL run while the owning BIS context is alive and host start-menu checks SHALL invoke the same cleanup path; a closed browser SHALL not claim that server-side cleanup occurred. Expiry alone SHALL NOT imply a completed spend or disable a cryptographically valid claim branch. Once an operation might be submitted, BIS SHALL reconcile its actual outcome before competing spending.

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
BIS SHALL persist sanitized contract records and encrypted recovery material before submission, reserve inputs/outpoints, preserve existing asset holdings, and correlate terminal evidence to the specific contract and recipient. Reload and timer suspension SHALL NOT imply completion or trigger duplicate operations. Contract records SHALL participate in existing logout pending-loss acknowledgement and Admin Reset policies; player cleanup SHALL NOT erase separate game-owned refund recovery. Selecting, replacing, or logging out the game wallet SHALL invalidate the prior G2 presentation session rather than apply old records to the new selection.

#### Scenario: Browser closed at expiry
- **WHEN** the browser is closed when an unresolved offer's deadline passes
- **THEN** reopening restores the original local record for reconciliation without claiming that expiry cleanup ran while BIS was closed

#### Scenario: Player logout
- **WHEN** the player confirms logout under existing acknowledgement rules
- **THEN** player-side cleanup does not assert cancellation and the game-owned unresolved contract remains reserved and recoverable

#### Scenario: Wrong receipt evidence
- **WHEN** an unrelated balance increase or transaction is observed
- **THEN** it does not mark the offer claimed or refunded

## ADDED Requirements

### Requirement: Locally selected game wallet
F1 and F2 SHALL provide the locally selected game signing identity for LTO funding, claim, and refund. The LTO controller SHALL never require a BIS application server to restore, use, or switch that selected wallet. No public configuration or player-facing LTO response SHALL disclose recovery material. Switching the selected game wallet SHALL not cause a partially submitted operation to be replayed or an old offer to be actionable in the new G2 presentation session.

#### Scenario: F2-configured game
- **WHEN** a player configures a game wallet through F2 in a deployed game with no Admin
- **THEN** the next eligible run can use that wallet for direct LTO operations

#### Scenario: Replace game wallet after a run
- **WHEN** a different game wallet is selected after a G2 run has begun
- **THEN** no old offer is displayed or submitted under the replacement wallet and a later fresh run begins a new local session

## REMOVED Requirements

### Requirement: Admin-managed persistent game wallet
**Reason**: F1 and F2 now select the game wallet through the browser-local BIS controller, so the hosted wallet-service signer and its persistent server record are obsolete.
**Migration**: Configure the game wallet in the target browser origin through F1 or F2 before starting a new G2 run; remove wallet-service deployment configuration and use the local controller's selected-wallet state.
