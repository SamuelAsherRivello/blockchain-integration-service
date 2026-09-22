# Spec Delta

## ADDED Requirements

### Requirement: Marketplace batch operations isolate per-item transient state
Marketplace H1 minting and H2 burning SHALL track transient busy, unavailable, pending, and unknown outcomes per catalog item and operation identity. A result for one item SHALL NOT permanently cache a batch-wide unavailable state after its attempt settles. Re-running H1 or H2 SHALL reconcile durable records for previously attempted items and continue evaluating every other eligible item, while preserving duplicate-submission protection for exact unresolved operations.

#### Scenario: H1 item preflight fails
- **WHEN** one catalog item cannot be minted before submission because current wallet readiness or spendability is unavailable
- **THEN** the batch records that item's safe result without treating all later items as permanently unavailable
- **AND** a later H1 run re-evaluates that item from current wallet state

#### Scenario: H2 item unknown does not stop unrelated items
- **WHEN** one item burn becomes pending or unknown and another eligible item has provably disjoint inputs
- **THEN** H2 continues to inspect and process the other item without retrying the unknown burn

#### Scenario: Batch retry uses durable identity
- **WHEN** H1 or H2 is invoked again after a previous batch partially completed
- **THEN** completed or unresolved exact operations are identified from durable records
- **AND** transient in-memory caches from the prior invocation do not suppress fresh checks for untouched items
