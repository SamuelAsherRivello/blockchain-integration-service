# account-balance Specification

## Purpose

Provide reusable, freshly requested Signet balance information in the Account Details dialog without persisting wallet balances or presenting stale values after failure.

## Requirements

### Requirement: Available and total balances
The Account Details dialog SHALL show Network: Signet and, after a successful live wallet-data request, Available balance prominently and Total balance secondarily, both labeled in sats. Available SHALL reflect funds available for generic spending; total SHALL reflect total wallet funds and SHALL NOT be described as entirely spendable. Both values SHALL belong to the verified active account and SHALL be valid nonnegative integer sats. Invalid, partial, or failed reads SHALL NOT be represented as zero or as successful balance data.

#### Scenario: Successful nonzero read
- **WHEN** the active account's live read returns available 1000 sats and total 1500 sats
- **THEN** the dialog displays Available balance: 1000 sats and Total balance: 1500 sats with available more prominent, its label ending in a colon and its bold amount on the following line

#### Scenario: Genuine zero balance
- **WHEN** a successful live read reports zero for both amounts
- **THEN** both amounts display 0 sats
- **AND** a failed or incomplete read never follows this success path

### Requirement: Explicit refresh and loading
The system SHALL request balances on entry to the Account Details dialog and through an explicitly labeled lightning-prefixed Refresh button. It SHALL clear existing amounts and show Loading balance... while requesting data. Refresh SHALL be disabled while a request is pending. It SHALL NOT poll, subscribe for continuous balance updates, or duplicate work when the already-open dialog is requested again. Each request SHALL terminate in success or an unavailable state within a bounded deadline.

#### Scenario: Open or refresh
- **WHEN** the Account Details dialog opens or the player selects enabled Refresh
- **THEN** a fresh bounded read starts, previous amounts are absent, and loading is visible
- **AND** Refresh remains disabled until the request finishes or the presentation is left

#### Scenario: Idle successful view
- **WHEN** a successful balance remains displayed without further interaction
- **THEN** no periodic or background balance refresh is started

### Requirement: No persisted or stale fallback
Balance amounts SHALL NOT be persisted to browser storage or reused across dialog entries. A failed request, including a refresh after success in the same dialog, SHALL hide both amounts and show Balance unavailable with Unable to retrieve current wallet data. Refresh SHALL allow another attempt. Previously saved identity SHALL remain usable independently of balance availability. No stale-value fallback or last-updated display SHALL be shown.

#### Scenario: Failure after success
- **WHEN** a successful read is followed by a refresh that fails because the browser is offline, a required service is unreachable, or the data is invalid
- **THEN** neither prior amount is visible and the unavailable message and enabled Refresh appear
- **AND** Account ID, Network: Signet, and Back remain available; Log Out is available after returning to the Account menu

#### Scenario: Reopen or reload
- **WHEN** the player reopens Account Details or reloads the application after a successful balance read
- **THEN** no saved balance is presented and entry performs a new live read

### Requirement: Account and presentation isolation
Balance work SHALL NOT alter account activation or prevent Back and the existing logout flow. Leaving Account Details, account changes, logout/reset, or client disposal SHALL invalidate pending reads and clear balance state. Late results SHALL NOT notify disposed consumers or populate another account/presentation. An unreadable or missing identity SHALL follow existing account-access behavior rather than showing an apparently valid active account with unavailable balances. Host-facing state SHALL expose only provider-neutral balance values and status, never recovery material.

#### Scenario: Leave during a request
- **WHEN** the player selects Back while a balance request is pending
- **THEN** navigation proceeds and the pending result cannot repopulate the previous balance view

#### Scenario: Account changes while requesting
- **WHEN** the account is replaced or cleared in this or another observing instance before a read completes
- **THEN** the old result is ignored and no balance is attributed to the replacement account

#### Scenario: Return from logout cancellation
- **WHEN** the player cancels logout and returns to the active Account dialog
- **THEN** the unchanged account menu appears without requesting balances; entering Account Details starts a fresh read
