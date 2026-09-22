# Spec Delta

## ADDED Requirements

### Requirement: LTO attempt caches are bounded by operation identity
LTO creation, claim, reject, refund, and reconciliation SHALL use in-memory single-flight caches only while the corresponding attempt is unsettled. Once the promise settles, the transient cache entry SHALL be removed. Durable attempt markers SHALL still prevent late same-session creation after a skipped or unavailable Start, and durable contract records SHALL still protect submitted or uncertain work. A fresh session with a distinct session ID SHALL re-evaluate current readiness, active network, game wallet, player wallet, exclusivity, and funds.

#### Scenario: Same session skipped before readiness
- **WHEN** Start is clicked before required player or game wallet readiness and no funding is submitted
- **THEN** that session is durably marked as skipped or attempted so it cannot later start from a stale async path
- **AND** the in-memory unavailable result does not block a later Start with a new session ID

#### Scenario: Concurrent fresh starts
- **WHEN** two cooperating contexts request different sessions for the same exclusivity key
- **THEN** unresolved durable records and locks allow at most one funding slot
- **AND** completed unavailable single-flight promises from an earlier session do not cause both fresh sessions to be declined

#### Scenario: Legacy wallet network defaults to active store
- **WHEN** the selected player or game signer was saved before network fields were persisted but is loaded from the active network-scoped store
- **THEN** LTO readiness and funding compare it using the active network
- **AND** an explicitly different stored network remains unavailable and cannot fund or claim

#### Scenario: Claim transient guard releases
- **WHEN** Claim is clicked while no current active contract exists or while an accepted claim settles
- **THEN** the transient acting guard is cleared after the attempt settles
- **AND** a later eligible claim for the current concrete contract is evaluated from current contract state
