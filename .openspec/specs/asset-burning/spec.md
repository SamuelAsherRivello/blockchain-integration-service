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

### Requirement: Valid Asset Detail burn is not falsely blocked by presentation state
When Asset Detail has a fresh positive holding and the active account/network context is valid, the Burn control SHALL remain independently actionable even if the Explorer URL is unavailable or optional provenance is missing. Burn SHALL continue to use the existing explicit confirmation, exact holding revalidation, durable pre-submit intent, duplicate-submission protection, and unknown-outcome handling. A network, provider, account, or coordination failure SHALL be surfaced as a truthful safe error rather than silently disabling the action or claiming success.

#### Scenario: Missing explorer metadata does not block burn
- **WHEN** a valid owned asset has no constructible Explorer URL but its active account and holding can be verified
- **THEN** Burn remains available, confirmation submits the exact selected quantity once, and Explorer remains the only disabled action

#### Scenario: Provider mismatch is reported safely
- **WHEN** the selected holding is visible but the burn provider cannot be verified for the active account network
- **THEN** no burn is submitted, the player receives a safe actionable error, and no confirmed success is shown

#### Scenario: Burn response becomes unknown
- **WHEN** a burn may have crossed the submission boundary without a confirmed response
- **THEN** the operation remains recoverable and protected from duplicate submission while the detail UI does not infer completion from a changed holding
