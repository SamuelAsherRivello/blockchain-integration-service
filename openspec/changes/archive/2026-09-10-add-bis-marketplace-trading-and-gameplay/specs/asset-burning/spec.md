## MODIFIED Requirements

### Requirement: Durable uncertain outcome protection
An identical completed operation SHALL return its saved result without submitting again. Reusing an operation ID with different contents SHALL fail. A possibly submitted burn without confirmed completion SHALL remain pending and reserve the exact asset plus every known transaction input involved. It SHALL block duplicate or conflicting submissions that could reuse those assets or inputs, but SHALL NOT make unrelated user interaction globally inert. H2 SHALL continue inspecting and processing other eligible items whenever their complete transaction inputs are proven disjoint. If safe disjointness cannot be proven, H2 SHALL leave that item unsubmitted for a later invocation rather than risk a conflicting spend. Pending records SHALL count toward existing logout warnings. There SHALL be no automatic retry or inferred completion from a missing holding.

#### Scenario: Network response is lost
- **WHEN** the provider loses its response after the submission boundary
- **THEN** the operation remains pending, its outcome is reported as unknown, and the exact asset cannot be submitted again while unresolved
- **AND** unrelated UI interaction and burns with proven disjoint inputs remain available

#### Scenario: H2 reaches another item after an unknown burn
- **WHEN** H2 has recorded one unknown burn and can prove another eligible item's complete inputs are disjoint
- **THEN** H2 may submit the other item's distinct burn without retrying or replacing the unknown operation

#### Scenario: Known completed retry
- **WHEN** the same successful burn request is repeated
- **THEN** the saved transaction result is returned without another wallet submission

#### Scenario: Later H2 invocation sees unresolved work
- **WHEN** H2 runs again while an earlier item burn is still unresolved
- **THEN** it reconciles and skips duplicate submission for that exact item
- **AND** it continues checking every other eligible item
