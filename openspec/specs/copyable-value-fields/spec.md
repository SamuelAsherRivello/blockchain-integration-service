# copyable-value-fields Specification

## Purpose
Define a consistent BIS copy interaction so every copy action confirms success through its checked control while clipboard failures remain understandable and recoverable.

## Requirements

### Requirement: Every BIS copy action uses checked success feedback

Every BIS copy button SHALL show successful clipboard completion by changing to the checked state, and SHALL NOT render separate visible or screen-reader-only success text such as “Account ID copied.”, “Recovery details copied.”, or “Copied to clipboard.” This applies to value fields, text areas, item-list exports, transaction and asset reports, recovery phrase copying, pending-operation messages, custom recovery-detail actions, and standalone onboarding recovery/address copies.

#### Scenario: Shared value field copies successfully
- **WHEN** the player copies an Account ID, balance, address, or other shared value field and the clipboard write completes
- **THEN** that field’s copy control shows its checked state and no field-specific success-status element or text is present

#### Scenario: Report or recovery action copies successfully
- **WHEN** the player copies a transaction, asset, recovery phrase, recovery report, pending-operation message, or other BIS report and the clipboard write completes
- **THEN** its copy control shows the checked state and no success announcement or status text is rendered

#### Scenario: Standalone onboarding copy succeeds
- **WHEN** the player copies recovery details or a Bitcoin boarding address in the standalone onboarding surface and the clipboard write completes
- **THEN** that copy control shows the checked state and its success status element remains empty

### Requirement: Clipboard failure remains actionable

When a BIS copy action cannot write to the clipboard, the action SHALL NOT show the checked success state or success text and SHALL retain selectable content with guidance for manual copying where a report or value is available.

#### Scenario: Shared field or report copy is denied
- **WHEN** the clipboard rejects a BIS value or report copy
- **THEN** the UI shows failure guidance, keeps the source selectable when applicable, and does not claim that the value was copied

### Requirement: Copy state cannot leak across changed or unavailable content

BIS copy controls SHALL ignore stale completion from an unmounted view, changed report, changed account, or replaced operation, and SHALL disable copying when the source content is unavailable or a copy is already in progress.

#### Scenario: Copy completes after content changes
- **WHEN** a copy request completes after its report or source view has changed
- **THEN** the replaced copy control does not show checked success or success text for the obsolete content
