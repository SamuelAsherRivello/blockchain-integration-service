# account-logout Specification

## Purpose

Allow players to deliberately end their local account session after acknowledging their backup, with reliable clearing and observable completion.

## Requirements

### Requirement: Backup confirmation
The active account's Log Out action SHALL open a confirmation titled "Account Log Out", asking "Did you back up your wallet?" and explaining that the saved account will be cleared from this browser, cannot be recovered locally by undoing logout, and requires the saved recovery phrase to restore. It SHALL contain "I have backed up my wallet", initially unchecked on every opening, a final Log Out action enabled only while checked, and Back. A6 SHALL NOT display recovery material or offer recovery-phrase access. The confirmation SHALL remain part of logout after A3 becomes available.

#### Scenario: Explicit acknowledgement
- **WHEN** the confirmation opens, the player checks the checkbox, then unchecks it
- **THEN** Log Out starts disabled, becomes enabled, then becomes disabled again
- **AND** no clearing or logout happens until the enabled final action is pressed

#### Scenario: Cancel and reopen
- **WHEN** the player presses Back before submitting logout and later opens it again
- **THEN** Back returns to the active Account dialogue without changing saved account material
- **AND** the reopened checkbox is unchecked

### Requirement: Confirmed local logout
Confirmed logout SHALL clear only integration-owned remembered account material and end the active local session. It SHALL preserve unrelated browser data and wallet assets and SHALL NOT depend on operator connectivity when no send, transfer, payable invoice, or receipt processing/reconciliation is unresolved. On confirmed success the Account dialogue SHALL remain open with Create Account / Restore Account visible; Restore SHALL be enabled and open A3 restoration. Back SHALL restore the preceding host presentation. Ordinary gameplay SHALL remain available. A payable invoice or unresolved receipt SHALL retain its receiving-operation clearing guard, including unknown receiving states. An unresolved send SHALL block account clearing, even when backup acknowledgement is checked, until reconciliation proves completion or safe failure. This guard SHALL apply across live contexts and after restart; offline uncertainty SHALL preserve recovery state rather than permit clearing.

#### Scenario: Successful logout and reload
- **WHEN** a player confirms logout with no unresolved send, transfer, payable invoice, or receipt processing/reconciliation and clearing succeeds
- **THEN** no active profile remains and the logged-out Account dialogue appears
- **AND** reloading the same origin does not restore the cleared account

#### Scenario: Offline logout
- **WHEN** the operator is unreachable but local storage is available and no send, transfer, payable invoice, or receipt processing/reconciliation is unresolved
- **THEN** confirmed logout can complete without a wallet transaction or operator request

#### Scenario: Unresolved send
- **WHEN** logout is requested while a send is submitting, pending or uncertain
- **THEN** clearing is blocked with a status explanation and account/recovery material remains intact
- **AND** navigation and ordinary gameplay remain available

#### Scenario: Payable invoice or unresolved receipt
- **WHEN** a payable invoice or unresolved receipt exists, including one hidden by navigation
- **THEN** Log Out cannot clear the account and explains why it is blocked
- **AND** Back and ordinary navigation remain available

### Requirement: Truthful failure and retry
While logout is pending the Pending Operation Dialog SHALL show Logging out... and prevent duplicate submission and cancellation of that operation. If clearing fails or cannot be confirmed, it SHALL show the failure without exposing secrets and offer only OK in the Pending Operation Dialog. It SHALL NOT claim success or emit a successful-disconnection event before confirmed clearing. OK SHALL close the dialog and the failed logout page, reconcile the account state, and require a fresh confirmation before another cleanup attempt. An unchecked acknowledgement SHALL prevent a further destructive submission.

#### Scenario: Clearing fails
- **WHEN** clearing rejects or completion cannot be verified
- **THEN** the player sees the error and OK in the operation dialog, with no success claim
- **AND** OK leaves the failed confirmation and a separately confirmed successful operation completes the normal logged-out destination

#### Scenario: Repeated submission
- **WHEN** the player submits again while logout is pending
- **THEN** only one logout operation runs and no duplicate completion is reported

### Requirement: Consistent host and instance state
The public production surface SHALL expose non-secret logout state and a disconnection notification after an active profile is confirmed absent. Each observing live context SHALL report that transition once, with no notifications after disposal. Logout SHALL prevent stale account work from restoring cleared material and SHALL reconcile other live contexts on the same origin. A confirmation for an obsolete profile SHALL NOT clear a subsequently activated different profile.

#### Scenario: Other context and stale work
- **WHEN** one context completes logout while another context holds the same active profile or older creation work
- **THEN** the other context reconciles its state and stale work cannot persist the cleared identity again
- **AND** each affected context reports the active-to-absent transition at most once

#### Scenario: Obsolete confirmation
- **WHEN** the profile changes after the confirmation opened but before submission
- **THEN** the obsolete confirmation does not clear the replacement account and requires a fresh confirmation

#### Scenario: Disposed consumer
- **WHEN** a context is disposed before asynchronous logout completion
- **THEN** it does not publish later state or events to former subscribers

### Requirement: Protect unresolved transfers
Once transaction execution is supported, Log Out and Reset SHALL be blocked while a transfer is unresolved, including after restart and across same-origin contexts. Merely editing a transfer without submission SHALL NOT block account clearing.

#### Scenario: Form without submission
- **WHEN** the player has only entered an amount without submitting a transfer
- **THEN** normal account clearing remains available through its existing confirmation flow

#### Scenario: Unresolved submission
- **WHEN** a submitted transfer has not been reconciled
- **THEN** account clearing is blocked with an explanation until resolution
