# Spec Delta

## MODIFIED Requirements

### Requirement: Backup confirmation
The active account's Log Out action SHALL open a confirmation titled "Account Log Out" with the lead text "Backup your recovery phrase before logging out." It SHALL show only applicable acknowledgement checkboxes for backup, unresolved operations, and separate Game Wallet state. Every checkbox SHALL start unchecked on each opening, but no checkbox state SHALL disable the final Log Out action. A.P.5 SHALL NOT display recovery material or offer recovery-phrase access.

#### Scenario: Explicit acknowledgement
- **WHEN** the confirmation opens with zero, one, two, or three applicable warning situations and the player leaves every checkbox unchecked
- **THEN** the final Log Out action remains available and starts logout when pressed
- **AND** checking or unchecking a warning changes only the acknowledgement state shown to the player

#### Scenario: Cancel and reopen
- **WHEN** the player presses Back before submitting logout and later opens it again
- **THEN** Back returns to the active Account dialogue without changing saved account material
- **AND** the reopened warning checkboxes are unchecked

### Requirement: Confirmed local logout
Confirmed logout SHALL clear only the selected active player profile's account material and that profile's operation and recovery journals. Warning discovery, pending-operation changes, and separate Game Wallet state SHALL NOT prevent the player cleanup from starting or completing. Cleanup SHALL preserve every other saved player profile, unrelated browser data, remote wallet assets, and separate Admin game-wallet identities. It SHALL NOT cancel submitted transactions or claim their completion. Confirmed cleanup SHALL invalidate live sessions for the removed profile, leave no player profile active, and request host-owned restart; ordinary gameplay SHALL remain available.

#### Scenario: Successful logout and reload
- **WHEN** the player presses Log Out with zero, one, two, or three applicable warnings, whether or not those warnings are acknowledged
- **THEN** the selected profile and its recovery journal are absent, no player profile is active, and the host receives the restart request
- **AND** reloading the same origin does not restore the removed account

#### Scenario: Logout while other profiles are saved
- **WHEN** the logged-out identity is one of several saved player profiles
- **THEN** the other profile and its wallet, equipment selections, and operation records remain retained without becoming active
- **AND** the subsequent production UI does not show a profile list, selection action, or profile-management wording

#### Scenario: Offline logout
- **WHEN** the operator is unreachable and local cleanup is attempted
- **THEN** logout can complete without a wallet transaction or operator request

#### Scenario: Unresolved send
- **WHEN** the active profile has a pending or uncertain send
- **THEN** the confirmation displays the pending-loss warning when it can determine that condition
- **AND** pressing Log Out removes only that profile's local recovery information without cancelling the send or removing other profiles

#### Scenario: Pending local operation requires acknowledgement
- **WHEN** the active profile has pending account work and the player opens Log Out
- **THEN** the production confirmation displays the existing pending-loss warning when the condition is known, but does not require its acknowledgement before cleanup
- **AND** saved identities that are not active do not weaken, satisfy, or appear in that acknowledgement

#### Scenario: Payable invoice or unresolved receipt
- **WHEN** supported receiving operations contribute unresolved recovery state to the active profile's pending-operation inventory
- **THEN** explicit Player logout displays the same current pending-loss warning when it can determine that condition and does not claim network cancellation
- **AND** Admin Reset remains guarded while receipt recovery is unresolved

#### Scenario: Pending inventory changes during confirmation
- **WHEN** the pending-operation set changes after the confirmation opens
- **THEN** logout proceeds without requiring a fresh acknowledgement or rejecting the cleanup because the prior warning snapshot is stale

#### Scenario: Separate Game Wallet is unavailable
- **WHEN** a separate Game Wallet exists or its reset/status operation fails
- **THEN** Player logout still completes its own cleanup
- **AND** separate Game Wallet records are preserved unless their own explicit operation succeeds

### Requirement: Truthful failure and retry
While logout is pending the Pending Operation Dialog SHALL show Logging out... and prevent duplicate submission and cancellation of that operation. If clearing fails or cannot be confirmed, it SHALL show the failure without exposing secrets and offer only OK in the Pending Operation Dialog. It SHALL NOT claim success or emit a successful-disconnection event before confirmed Player clearing. OK SHALL close the dialog and the failed logout page, reconcile the account state, and permit a fresh confirmation before another cleanup attempt.

#### Scenario: Clearing fails
- **WHEN** clearing rejects or completion cannot be verified
- **THEN** the player sees the error and OK in the operation dialog, with no success claim
- **AND** OK leaves the failed confirmation and a separately confirmed successful operation completes the normal logged-out destination

#### Scenario: Repeated submission
- **WHEN** the player submits again while logout is pending
- **THEN** only one logout operation runs and no duplicate completion is reported

#### Scenario: Warning discovery fails
- **WHEN** pending-operation or Game Wallet warning discovery cannot be refreshed
- **THEN** the final Log Out action remains available
- **AND** any resulting cleanup failure is reported as cleanup failure rather than as a missing acknowledgement

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
Admin Reset SHALL remain blocked while a transfer is unresolved, including after restart and across same-origin contexts. Explicit player Log Out SHALL remain available and SHALL display a pending-loss warning when unresolved work is known. Merely editing a transfer without submission SHALL NOT add a pending-loss warning.

#### Scenario: Form without submission
- **WHEN** the player has only entered an amount without submitting a transfer
- **THEN** normal account clearing remains available through its existing confirmation flow

#### Scenario: Unresolved submission
- **WHEN** a submitted transfer has not been reconciled
- **THEN** the confirmation displays the pending-loss warning when available, but the warning does not disable Log Out
- **AND** Admin Reset remains blocked until resolution
