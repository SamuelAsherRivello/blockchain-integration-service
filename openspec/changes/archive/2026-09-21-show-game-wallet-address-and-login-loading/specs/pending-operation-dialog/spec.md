# Spec Delta

## MODIFIED Requirements

### Requirement: Complete readiness before reveal
The dialog SHALL remain through operation completion, required data refresh, final rendering and required image readiness or fallback. Account opening, creation, persistence, restoration, logout, Details, Transactions/detail, Receive, Recovery Phrase, Assets/detail, Send, Transfer, visible Reset, and Game Wallet Login create/restore/select operations SHALL follow this contract. Background updates SHALL not block an already prepared page. Record statuses such as Pending remain valid content. Burn submission and its follow-up holdings refresh SHALL use the asset-burning toast flow without opening a progress overlay; unrelated initial Assets loads retain this contract.

#### Scenario: Burn and refresh
- **WHEN** a confirmed burn succeeds
- **THEN** a confirmed toast is queued and holdings refresh without a covering progress dialog, after which refreshed Assets appears without an inline async message

#### Scenario: Game Wallet Login readiness
- **WHEN** the user creates, restores, or selects a Game Wallet from Game Wallet Login
- **THEN** the shared loading prompt covers the page until the operation and resulting public wallet state are ready
- **AND** the selected wallet's Arkade address is not revealed as completed content before readiness

#### Scenario: Overlapping and obsolete work
- **WHEN** multiple requests overlap or an old account/page request completes
- **THEN** one dialog represents current work and obsolete results cannot reveal, replace or reopen current content
