## Purpose

Give standalone developer tools a compact, chronological runbook presentation that keeps the next safe action visible while allowing optional operational detail to be opened on demand.

## Requirements

### Requirement: Chronological developer runbook

Each standalone tool SHALL present its workflow from environment and current state at the top through the next action and final evidence below it. Onboarding SHALL retain the order Create account, Fund, Wait for incoming Bitcoin, Onboard, Track settlement, Confirm usable funds. Faucet SHALL retain the order Network, Faucet health, Request funding, Delivery/evidence.

#### Scenario: First viewport scan

- **WHEN** a developer opens either route with no active operation
- **THEN** the first viewport identifies the environment, current status, and the next available action without requiring a long scroll through historical detail

### Requirement: Optional operational detail

Secondary identifiers, transaction rows, timing calculations, diagnostic context, and explanatory implementation notes SHALL be available through keyboard-accessible native foldouts. Foldouts SHALL have descriptive summaries and SHALL NOT remove the underlying data or controls from the page.

#### Scenario: Inspect evidence

- **WHEN** a developer opens an evidence foldout
- **THEN** the existing public identifiers and evidence are shown without changing the operation state

### Requirement: Persistent state visibility

The active stage/status, owner, blocking reason, next action, and safety-relevant error SHALL remain visible when optional foldouts are closed. Styling SHALL distinguish pending, successful, and error states using the existing developer palette.

#### Scenario: Pending operation

- **WHEN** an operation is waiting for confirmation or recovery
- **THEN** the owning stage remains visible in the chronological flow with its pending state and next safe action, while detailed evidence may remain closed

### Requirement: Responsive and accessible controls

The surfaces SHALL preserve existing control IDs, labels, copy actions, links, and keyboard focus behavior. At narrow widths, content SHALL collapse to one column, actions SHALL remain usable without horizontal scrolling, and reduced-motion users SHALL not receive essential information only through animation.

#### Scenario: Narrow developer viewport

- **WHEN** the tool is viewed at a mobile-width viewport
- **THEN** the chronological order remains intact, foldout summaries remain operable, and the primary action is reachable without horizontal scrolling

### Requirement: Confirmed network switching

Both tools SHALL expose a top-level `Network` selector with `Signet` and `Mutinynet`. Changing the selection SHALL ask for confirmation using the message `This will reset all data on the page`; cancelling SHALL preserve the current selection and state, while confirming SHALL reset the page-scoped state and load the selected network configuration.

#### Scenario: Cancel network change

- **WHEN** a developer selects another network and cancels the confirmation
- **THEN** the current network and page data remain unchanged

#### Scenario: Confirm network change

- **WHEN** a developer confirms the network change
- **THEN** the current page data is reset and the selected Signet or Mutinynet operator configuration is used for subsequent reads and actions
