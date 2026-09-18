## MODIFIED Requirements

### Requirement: Exact guarded SDK burn
`burnAsset` SHALL validate exact positive integer quantities and IDs, use the active verified account and network context, and coordinate through the existing browser/account wallet mutation lock. Short-lived lock contention SHALL be handled by a bounded retry or an explicit busy result that does not discard a valid confirmed burn request. The operation SHALL reject unresolved spending conflicts and revalidate the active stored account. A fresh holding query SHALL match the confirmed quantity before the installed SDK AssetManager.burn is called. Other asset outputs SHALL be preserved. Submission SHALL require a durable per-operation intent before the network call, with automatic settlement disabled and a bounded deadline. Provider, indexer, persistence, unsupported-coordination, account-change, and SDK failures SHALL retain their safe error category and SHALL NOT be collapsed into an unqualified unavailable result when a more specific category is known.

#### Scenario: Holding changes before submission
- **WHEN** the current holding differs from the confirmed quantity, the account changes, or intent cannot be saved
- **THEN** no transaction is submitted and the caller receives safe error feedback

#### Scenario: Transient mutation contention
- **WHEN** an unrelated wallet operation briefly holds the account mutation lock before Burn reaches submission
- **THEN** Burn waits only within its bounded coordination policy, then executes if the lock becomes available, or returns an explicit busy/availability result without submitting conflicting inputs

#### Scenario: Active network routing
- **WHEN** the active account is configured for a supported selected network
- **THEN** all burn provider, wallet, holding, and submission operations use that same verified network and reject a mismatched provider before submission

#### Scenario: Fresh read or provider failure
- **WHEN** a fresh holding/provider/indexer read fails before the submission boundary
- **THEN** no burn is submitted and the result identifies unavailable verification or the specific safe failure category; a later explicit retry may prepare a fresh operation

#### Scenario: Durable intent cannot be written
- **WHEN** the exact burn intent cannot be persisted before the SDK submission boundary
- **THEN** no transaction is submitted and the result identifies the persistence failure without claiming that the asset was burned

## ADDED Requirements

### Requirement: Burn failure classification and recovery feedback
The BIS burn boundary SHALL return safe, actionable results for lock contention, unavailable verification, unresolved pending work, account changes, invalid requests, unsupported browser coordination, and possibly submitted outcomes. It SHALL preserve the existing durable record and exact-operation protections, SHALL NOT expose recovery phrases or provider internals, and SHALL NOT report a successful burn unless the SDK result and durable completion record are both valid.

#### Scenario: Known pre-submit failure
- **WHEN** Burn is blocked before a network submission by invalid input, pending conflict, unavailable read, unsupported coordination, or failed persistence
- **THEN** the result reports that safe category and the UI allows acknowledgement and a fresh explicit retry when safe

#### Scenario: Possibly submitted failure
- **WHEN** the provider or SDK fails after the burn submission boundary or its acknowledgement cannot be verified
- **THEN** the operation remains pending with exact asset/input reservations, the result says the outcome is unknown, and the UI does not invite a new submission for the same operation

#### Scenario: Verified completion
- **WHEN** the SDK returns a valid transaction ID and the completion record is durably saved for the active operation
- **THEN** Burn returns success, emits the confirmed result, and refreshes holdings without submitting again
