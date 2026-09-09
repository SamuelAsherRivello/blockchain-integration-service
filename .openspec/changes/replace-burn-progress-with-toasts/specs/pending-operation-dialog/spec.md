## MODIFIED Requirements

### Requirement: Shared pending operation presentation
Except for burn progress and its follow-up holdings refresh, runtime page loads and user-triggered operations SHALL immediately render a shared Pending Operation Dialog above a dark translucent host-scoped backdrop. The label SHALL end in ing... and appear above the spinning bolt. Pending presentation SHALL have no interactive actions or dismissal. Background reconciliation and Admin-only operations SHALL NOT open this dialog. Reduced motion SHALL disable rotation, and keyboard users SHALL NOT reach covered runtime controls.

#### Scenario: Initial page preparation
- **WHEN** a runtime page begins loading
- **THEN** it and the covering layer render together, no unfinished frame is exposed, and no inline Loading... message is rendered

### Requirement: Complete readiness before reveal
The dialog SHALL remain through operation completion, required data refresh, final rendering and required image readiness or fallback. Account opening, creation, persistence, restoration, logout, Details, Transactions/detail, Receive, Recovery Phrase, Assets/detail, Send, Transfer, and visible Reset SHALL follow this contract. Background updates SHALL not block an already prepared page. Record statuses such as Pending remain valid content. Burn submission and its follow-up holdings refresh SHALL use the asset-burning toast flow without opening a progress overlay; unrelated initial Assets loads retain this contract.

#### Scenario: Burn and refresh
- **WHEN** a confirmed burn succeeds
- **THEN** a confirmed toast is queued and holdings refresh without a covering progress dialog, after which refreshed Assets appears without an inline async message

#### Scenario: Overlapping and obsolete work
- **WHEN** multiple requests overlap or an old account/page request completes
- **THEN** one dialog represents current work and obsolete results cannot reveal, replace or reopen current content


