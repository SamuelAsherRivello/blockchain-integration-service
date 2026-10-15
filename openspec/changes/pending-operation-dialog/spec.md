# Spec Delta

## ADDED Requirements

### Requirement: Asset pending UI explains recovery state
Pending-operation presentation SHALL identify the asset operation, item when known, safe status, last verified evidence, and available recovery action without labeling unresolved work as failed, empty, or confirmed.

#### Scenario: Catalog mint pauses before submission
- **WHEN** an item preflight is unavailable and no submission evidence exists
- **THEN** the UI identifies the item and retryable reason without showing a submitted transaction recovery state

#### Scenario: Catalog mint is outcome-unknown
- **WHEN** the item may have been submitted
- **THEN** the UI preserves the original operation identity and offers reconciliation without a replacement mint action
