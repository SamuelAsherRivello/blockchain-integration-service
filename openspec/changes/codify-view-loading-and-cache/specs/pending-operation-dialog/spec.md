# Spec Delta

## MODIFIED Requirements

### Requirement: Shared pending operation presentation
Foreground view loading SHALL use an explicit per-view loading policy. A view with `isLoadingModal=true` SHALL immediately render a shared Pending Operation Dialog above a dark translucent host-scoped backdrop; a view with `isLoadingModal=false` SHALL remain interactive and present its own loading placeholders or disabled controls without that dialog. The label SHALL end in ing... when the dialog is used and appear above the spinning bolt. Pending presentation SHALL have no interactive actions or dismissal. Background reconciliation and Admin-only operations SHALL NOT open this dialog. Reduced motion SHALL disable rotation, and keyboard users SHALL NOT reach controls covered by the dialog.

#### Scenario: Initial page preparation
- **WHEN** a runtime page begins loading without a valid cache
- **THEN** a page with `isLoadingModal=true` and its covering layer render together with no unfinished frame or inline Loading... message, while a page with `isLoadingModal=false` remains usable with its loading placeholders and no Pending Operation Dialog covers it

### Requirement: Complete readiness before reveal
The Pending Operation Dialog SHALL remain through operation completion, required data refresh, final rendering and required image readiness or fallback only for views and operations whose loading policy requires modal coverage. Account opening, creation, persistence, restoration, logout, Recovery Phrase, Send, Transfer, visible Reset, and Game Wallet Login create/restore/select operations SHALL retain their existing modal safeguards. Account Details balance entry SHALL remain non-modal, while Transactions, Receive, Assets, Contracts, and other existing modal foreground reads SHALL retain their configured modal behavior. Background updates SHALL not block an already prepared page. Record statuses such as Pending remain valid content. Burn submission and its follow-up holdings refresh SHALL use the asset-burning toast flow without opening a progress overlay; unrelated initial Assets loads retain their configured policy.

#### Scenario: Burn and refresh
- **WHEN** a confirmed burn succeeds
- **THEN** a confirmed toast is queued and holdings refresh without a covering progress dialog, after which refreshed Assets appears without an inline async message

#### Scenario: Game Wallet Login readiness
- **WHEN** the user creates, restores, or selects a Game Wallet from Game Wallet Login
- **THEN** the shared loading prompt covers the page until the operation and resulting public wallet state are ready
- **AND** the selected wallet's Arkade address is not revealed as completed content before readiness

#### Scenario: Overlapping and obsolete work
- **WHEN** multiple requests overlap or an old account/page request completes
- **THEN** one dialog represents current modal work and obsolete results cannot reveal, replace, reopen, or cache incompatible current content
