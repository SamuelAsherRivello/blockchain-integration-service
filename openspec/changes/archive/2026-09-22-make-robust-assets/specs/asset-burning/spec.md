# Spec Delta

## ADDED Requirements

### Requirement: Burn controllers do not retain stale transient blocks
Burn submission and burn reconciliation SHALL clear transient in-memory busy or single-flight state when an attempt settles, whether it succeeds, fails before submission, or returns an unknown outcome. Durable burn records and reservations SHALL remain the only source of truth for duplicate-submission protection after a submitted or uncertain burn. A failed pre-submission check SHALL NOT disable a later burn attempt that revalidates the active account, network, holding, and input state.

#### Scenario: Pre-submission failure is retryable with fresh state
- **WHEN** Burn fails before submission because provider verification, account readiness, or holding validation is unavailable
- **THEN** a later user-confirmed Burn rechecks the fresh active account and selected holding instead of reusing the earlier in-memory failure

#### Scenario: Unknown burn still protects its asset
- **WHEN** Burn may have submitted and returns outcome-unknown
- **THEN** the exact asset and known inputs remain durably reserved and count toward pending-operation safeguards
- **AND** transient controller state does not globally block unrelated assets whose disjoint inputs can be proven

#### Scenario: Batch continues after settled transient state
- **WHEN** H2 observes one item with a completed, failed, or unknown burn attempt
- **THEN** H2 clears per-attempt transient state before considering the next item
- **AND** it uses durable records to decide whether that exact item is skipped, reconciled, or still protected
