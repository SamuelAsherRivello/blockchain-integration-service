# asset-burning Specification

## Purpose

Let account holders explicitly confirm burning an owned asset while preserving exact quantities and preventing duplicate or uncertain submissions.

## Requirements

### Requirement: Explicit reusable burn confirmation
Asset Detail SHALL place Burn above Back. Burn SHALL open the reusable Confirmation modal with Are you sure?, OK and Cancel, focus containment, initial focus on Cancel, and Escape cancellation. Only OK SHALL submit the selected asset ID and entire displayed base-unit quantity once. After OK, burn progress SHALL use a pending toast and verified success SHALL use a confirmed toast, without a covering progress dialog during submission or its holdings refresh. Success SHALL reveal refreshed Assets without inline progress or completion messages. Failure or unknown outcome SHALL show safe feedback and only OK; acknowledgement closes the error dialog and its source page without clearing recovery records. A failed refresh SHALL retry once without repeating Burn. Duplicate burn actions SHALL remain disabled or guarded while the attempt is in flight; the runtime SHALL NOT become globally inert because of burn progress.

#### Scenario: Cancel or confirm
- **WHEN** the player cancels Confirmation or presses Escape
- **THEN** no wallet submission or burn toast occurs and focus returns to the prior control
- **WHEN** the player confirms with OK
- **THEN** exactly one burn request runs and a pending toast replaces the former Burning... overlay

#### Scenario: Successful burn and refresh
- **WHEN** the burn returns verified success
- **THEN** a confirmed toast is queued and holdings refresh without a burn or refresh progress overlay
- **AND** a refresh failure does not retract verified burn success or repeat submission

#### Scenario: Unconfirmed outcome
- **WHEN** a burn fails or returns an unknown outcome
- **THEN** no confirmed toast is emitted and existing safe acknowledgment and durable recovery protections remain effective

### Requirement: Exact guarded SDK burn
burnAsset SHALL validate exact positive integer quantities and IDs, use the existing browser/account wallet mutation lock, reject unresolved spending conflicts and revalidate the active stored account. A fresh holding query SHALL match the confirmed quantity before the installed SDK AssetManager.burn is called. Other asset outputs SHALL be preserved. Submission SHALL require a durable per-operation intent before the network call, with automatic settlement disabled and a bounded deadline.

#### Scenario: Holding changes before submission
- **WHEN** the current holding differs from the confirmed quantity, the account changes, or intent cannot be saved
- **THEN** no transaction is submitted and the caller receives safe error feedback

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
