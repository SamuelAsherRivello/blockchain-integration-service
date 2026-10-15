# Spec Delta

## MODIFIED Requirements

### Requirement: Confirmed local logout
Confirmed Player Wallet Log Out SHALL end access to only the selected active player profile without deleting its encrypted account material, saved-profile membership, or profile-scoped operation and recovery journals in the selected network store. Warning discovery, pending-operation changes, and separate Game Wallet state SHALL NOT prevent local session disconnection from starting or completing. Disconnection SHALL preserve every saved player profile, unrelated browser data, remote wallet assets, and separate Admin game-wallet identities. It SHALL NOT cancel submitted transactions or claim their completion. Confirmed disconnection SHALL invalidate live sessions for the formerly active profile, leave no player profile active, and request host-owned restart; ordinary gameplay SHALL remain available.

#### Scenario: Successful logout and reload
- **WHEN** the player presses Log Out with zero, one, two, or three applicable warnings, whether or not those warnings are acknowledged
- **THEN** no player profile is active, the host receives the restart request, and the selected profile remains saved in its original network scope
- **AND** reloading the same origin remains logged out and does not automatically reactivate the retained account

#### Scenario: Logout while other profiles are saved
- **WHEN** the logged-out identity is one of several saved player profiles
- **THEN** that profile and every other profile, including their wallet, equipment selections, and operation records, remain retained without becoming active
- **AND** the subsequent production UI does not show a profile list, selection action, or profile-management wording

#### Scenario: Offline logout
- **WHEN** the operator is unreachable and local session disconnection is attempted
- **THEN** logout can complete without a wallet transaction or operator request

#### Scenario: Unresolved send
- **WHEN** the active profile has a pending or uncertain send
- **THEN** the confirmation displays the pending-loss warning when it can determine that condition
- **AND** pressing Log Out ends only the active local session without cancelling the send or removing any saved profile

#### Scenario: Pending local operation requires acknowledgement
- **WHEN** the active profile has pending account work and the player opens Log Out
- **THEN** the production confirmation displays the existing pending-loss warning when the condition is known, but does not require its acknowledgement before disconnection
- **AND** saved identities that are not active do not weaken, satisfy, or appear in that acknowledgement

#### Scenario: Payable invoice or unresolved receipt
- **WHEN** supported receiving operations contribute unresolved recovery state to the active profile's pending-operation inventory
- **THEN** explicit Player logout displays the same current pending-loss warning when it can determine that condition and does not claim network cancellation
- **AND** Admin Reset remains guarded while receipt recovery is unresolved

#### Scenario: Pending inventory changes during confirmation
- **WHEN** the pending-operation set changes after the confirmation opens
- **THEN** logout proceeds without requiring a fresh acknowledgement or rejecting the disconnection because the prior warning snapshot is stale

#### Scenario: Separate Game Wallet is unavailable
- **WHEN** a separate Game Wallet exists or its reset/status operation fails
- **THEN** Player logout still completes its own session disconnection
- **AND** separate Game Wallet records are preserved unless their own explicit operation succeeds

### Requirement: Consistent host and instance state
The public production surface SHALL expose non-secret logout state and a disconnection notification after the active session is confirmed absent while its saved player profile remains retained. Each observing live context SHALL report that transition once, with no notifications after disposal. Logout SHALL prevent stale account work from reactivating the disconnected session without an explicit account action and SHALL reconcile other live contexts on the same origin. A confirmation for an obsolete profile SHALL NOT disconnect a subsequently activated different profile.

#### Scenario: Other context and stale work
- **WHEN** one context completes logout while another context holds the same active profile or older creation work
- **THEN** the other context reconciles to a logged-out state and stale work cannot reactivate the disconnected identity
- **AND** each affected context reports the active-to-absent transition at most once

#### Scenario: Obsolete confirmation
- **WHEN** the profile changes after the confirmation opened but before submission
- **THEN** the obsolete confirmation does not disconnect the replacement account and requires a fresh confirmation

#### Scenario: Disposed consumer
- **WHEN** a context is disposed before asynchronous logout completion
- **THEN** it does not publish later state or events to former subscribers
