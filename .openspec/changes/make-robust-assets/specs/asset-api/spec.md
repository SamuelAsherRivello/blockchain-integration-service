# Spec Delta

## ADDED Requirements

### Requirement: Transient asset operation guards release after observed completion
Asset issuance, delivery, and recovery controllers SHALL NOT keep an in-memory busy, unavailable, or single-flight result after the guarded attempt has completed. Same-operation duplicate protection SHALL continue to come from durable operation identity, source and destination binding, phase records, input reservations, and terminal evidence. A fresh operation with a distinct operation ID SHALL be allowed once current durable recovery proves that it cannot reuse unresolved inputs or duplicate an unresolved delivery.

#### Scenario: Unavailable preflight does not poison a later operation
- **WHEN** a mint or delivery attempt returns unavailable before submission and its promise settles
- **THEN** a later distinct operation re-evaluates the current source, destination, network, and funds instead of returning the earlier unavailable result from memory
- **AND** any durable same-operation marker still prevents replay of the original operation ID

#### Scenario: Unknown submitted operation remains protected
- **WHEN** an issuance or delivery may have crossed the submission boundary without confirmed evidence
- **THEN** durable recovery and reservations continue blocking duplicate or conflicting submissions
- **AND** clearing a transient busy flag does not release its reserved inputs or permit replay of the same phase

#### Scenario: Legacy active-network wallet record
- **WHEN** an older saved source or destination account record lacks an explicit network field but is loaded through the active network-scoped store
- **THEN** operation checks treat it as belonging to the active network for same-network comparison
- **AND** records that explicitly name another network remain unavailable for the active operation
