## Purpose

Let account holders explicitly confirm burning an owned asset while preserving exact quantities and preventing duplicate or uncertain submissions.

## ADDED Requirements

### Requirement: Explicit reusable burn confirmation
Asset Detail SHALL place Burn above Back. Burn SHALL open a reusable modal titled Confirmation with body Are you sure? and buttons OK and Cancel. The modal SHALL contain focus within the runtime host, initially focus Cancel and treat Escape as cancellation. Only OK SHALL call burnAsset with the selected ID and entire displayed base-unit holding. Repeated clicks SHALL NOT duplicate submission. Burn, Back and Refresh SHALL be disabled while burning. Success SHALL refresh Assets; failure SHALL show safe feedback without inventing success.

#### Scenario: Cancel or confirm
- **WHEN** the player opens Burn and chooses Cancel or Escape
- **THEN** no wallet submission occurs and focus returns to the prior control
- **WHEN** the player chooses OK
- **THEN** exactly one burn attempt uses the selected ID and confirmed quantity

### Requirement: Exact guarded SDK burn
burnAsset SHALL validate exact positive integer quantities and IDs, use the existing browser/account wallet mutation lock, reject unresolved spending conflicts and revalidate the active stored account. A fresh holding query SHALL match the confirmed quantity before the installed SDK AssetManager.burn is called. Other asset outputs SHALL be preserved. Submission SHALL require a durable per-operation intent before the network call, with automatic settlement disabled and a bounded deadline.

#### Scenario: Holding changes before submission
- **WHEN** the current holding differs from the confirmed quantity, the account changes, or intent cannot be saved
- **THEN** no transaction is submitted and the caller receives safe error feedback

### Requirement: Durable uncertain outcome protection
An identical completed operation SHALL return its saved result without submitting again. Reusing an operation ID with different contents SHALL fail. A possibly submitted burn without confirmed completion SHALL remain pending and block another spend, including a new burn operation ID. Pending records SHALL count toward existing logout warnings. There SHALL be no automatic retry or inferred completion from a missing holding.

#### Scenario: Network response is lost
- **WHEN** the provider loses its response after the submission boundary
- **THEN** the operation remains pending, its outcome is reported as unknown and another spend cannot submit

#### Scenario: Known completed retry
- **WHEN** the same successful burn request is repeated
- **THEN** the saved transaction result is returned without another wallet submission
