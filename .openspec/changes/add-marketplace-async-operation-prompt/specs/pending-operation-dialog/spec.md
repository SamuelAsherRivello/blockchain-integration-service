## MODIFIED Requirements

### Requirement: Shared pending operation presentation
Except for burn progress and its follow-up holdings refresh, runtime page loads and user-triggered operations SHALL immediately render a shared Pending Operation Dialog above a dark translucent host-scoped backdrop. Marketplace initial preparation and foreground user-triggered operations, including local Buy, Sell, and explicit checkout reconciliation, SHALL use that same dialog and backdrop; they SHALL not provide a Marketplace-specific loading lookalike. The label SHALL end in ing... and appear above the spinning bolt. Pending presentation SHALL have no interactive actions or dismissal. Background reconciliation and Admin-only operations SHALL NOT open this dialog. Reduced motion SHALL disable rotation, and keyboard users SHALL NOT reach covered runtime or Marketplace controls.

#### Scenario: Initial page preparation
- **WHEN** a runtime page begins loading
- **THEN** it and the covering layer render together, no unfinished frame is exposed, and no inline Loading... message is rendered

#### Scenario: Marketplace initial preparation
- **WHEN** Marketplace begins the catalog and required visible inventory preparation for its initial rendered state
- **THEN** the same centered Pending Operation Dialog and dark translucent backdrop cover Marketplace until that state is ready
- **AND** Marketplace does not expose an inline Loading... result in its place

#### Scenario: Marketplace foreground operation
- **WHEN** an eligible Marketplace Buy or Sell begins foreground asynchronous work
- **THEN** the same centered Pending Operation Dialog and dark translucent backdrop cover the Marketplace immediately
- **AND** the Marketplace does not render a separate spinner, backdrop, or interactive loading control
