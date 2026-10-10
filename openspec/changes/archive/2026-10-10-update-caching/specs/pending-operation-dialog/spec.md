# Spec Delta

## MODIFIED Requirements

### Requirement: Shared pending operation presentation
Except for burn progress and its follow-up holdings refresh, runtime page loads and user-triggered operations SHALL immediately render a shared Pending Operation Dialog above a dark translucent host-scoped backdrop. Each data-backed runtime view SHALL declare whether automatic reads, modal coverage, and cached entry reuse are enabled. Marketplace initial preparation and foreground Buy or Sell operations SHALL use that same dialog and backdrop; they SHALL not provide a Marketplace-specific loading lookalike. A non-modal policy SHALL retain usable placeholders and controls beneath the read, while a modal policy SHALL use the shared dialog and backdrop only after the construction gate for initial entry reads. The label SHALL end in ing... and appear above the spinning bolt. Pending presentation SHALL have no interactive actions or dismissal. Background reconciliation and Admin-only operations SHALL NOT open this dialog. Reduced motion SHALL disable rotation, and keyboard users SHALL NOT reach covered runtime or Marketplace controls.

#### Scenario: Initial page preparation
- **WHEN** a runtime page begins loading
- **THEN** its required read begins immediately, the destination page is allowed to complete its first browser frame, and the covering layer then renders if the read remains active
- **AND** no unfinished frame is exposed underneath the covering layer

#### Scenario: Cached modal entry
- **WHEN** a modal-policy view has a complete cached result at the moment it is entered
- **THEN** the view uses the same brief construction-gated loading presentation as an uncached entry, then reveals the cached result without a provider read or arbitrary timer

#### Scenario: Explicit operation in an existing page
- **WHEN** a user-triggered operation begins from an already-visible page
- **THEN** the shared dialog and covering layer render immediately without waiting for a new view-construction gate

#### Scenario: Marketplace initial preparation
- **WHEN** Marketplace begins its initial preparation
- **THEN** Marketplace uses the shared dialog and backdrop according to its existing bootstrap contract
- **AND** it does not apply the account-view entry gate

