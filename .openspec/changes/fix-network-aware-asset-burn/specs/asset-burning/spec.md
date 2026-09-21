# Spec Delta

## MODIFIED Requirements

### Requirement: Exact guarded SDK burn
burnAsset SHALL validate exact positive integer quantities and IDs, use the existing browser/account wallet mutation lock, and use the active account's verified network and operator for fresh ownership reads, input selection, and SDK submission. It SHALL reject unresolved spending conflicts and revalidate the active stored account. A fresh holding query SHALL match the confirmed quantity before the installed SDK AssetManager.burn is called. Other asset outputs SHALL be preserved. Submission SHALL require a durable per-operation intent before the network call, with automatic settlement disabled and a bounded deadline. A provider or operator network mismatch SHALL fail before submission with a safe actionable category and SHALL NOT be reported as an unqualified generic unavailable result.

#### Scenario: Mutinynet burn uses the listed asset's network
- **WHEN** the active account and Asset Detail are on Mutinynet and the fresh holding matches the confirmed quantity
- **THEN** every burn provider and SDK wallet operation uses the Mutinynet operator, the burn is submitted at most once, and a verified result refreshes the same-network holdings

#### Scenario: Network mismatch before submission
- **WHEN** the configured provider reports a network different from the active account
- **THEN** no transaction is submitted, the exact holding and input state remain protected, and the caller receives a safe network/provider failure category

#### Scenario: Holding changes before submission
- **WHEN** the current holding differs from the confirmed quantity, the account changes, or intent cannot be saved
- **THEN** no transaction is submitted and the caller receives safe error feedback

### Requirement: Durable uncertain outcome protection
An identical completed operation SHALL return its saved result without submitting again. Reusing an operation ID with different contents SHALL fail. A possibly submitted burn without confirmed completion SHALL remain pending and reserve the exact asset plus every known transaction input involved, scoped to the account and active network/operator. It SHALL block duplicate or conflicting submissions that could reuse those assets or inputs, but SHALL NOT make unrelated user interaction globally inert. H2 SHALL continue inspecting and processing other eligible items whenever their complete transaction inputs are proven disjoint on the same network. If safe disjointness cannot be proven, H2 SHALL leave that item unsubmitted for a later invocation rather than risk a conflicting spend. Pending records SHALL count toward existing logout warnings. There SHALL be no automatic retry or inferred completion from a missing holding.

#### Scenario: Network response is lost
- **WHEN** the provider loses its response after the submission boundary
- **THEN** the operation remains pending in the active network scope, its outcome is reported as unknown, and the exact asset cannot be submitted again while unresolved

#### Scenario: Known completed retry
- **WHEN** the same successful burn request is repeated in the same account and network scope
- **THEN** the saved transaction result is returned without another wallet submission

#### Scenario: Same operation identifier crosses networks
- **WHEN** a pending or completed operation identifier is presented under a different active network
- **THEN** the record is not treated as a successful burn for that network and no cross-network submission or reservation reuse occurs

#### Scenario: H2 reaches another item after an unknown burn
- **WHEN** H2 has recorded one unknown burn and can prove another eligible item's complete inputs are disjoint on the same network
- **THEN** H2 may submit the other item's distinct burn without retrying or replacing the unknown operation

#### Scenario: Later H2 invocation sees unresolved work
- **WHEN** H2 runs again while an earlier item burn is still unresolved
- **THEN** it reconciles and skips duplicate submission for that exact item
- **AND** it continues checking every other eligible item
