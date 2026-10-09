# Spec Delta

## MODIFIED Requirements

### Requirement: Address receiving and refresh
An active account SHALL offer Receive with separate labeled Arkade and Bitcoin address fields and independent Copy controls. Addresses SHALL load on entry when automatic loading is enabled and no valid recent cache exists, and on manual Refresh. Loading or failed reads SHALL NOT leave stale addresses copyable. Reads SHALL use the Pending Operation Dialog when Receive's modal loading policy enables it, retry once automatically, and reveal only prepared fields; a valid complete same-account, same-network cache may be revealed without the dialog. Final failure SHALL show a safe error and only OK, closing Receive on acknowledgement. Receive SHALL NOT initiate a payment, funding request, or account transfer.

#### Scenario: Entry and copy
- **WHEN** an active account opens Receive without a valid cache and address loading succeeds
- **THEN** both address fields display their actual values and each Copy action copies only its own value with truthful feedback

#### Scenario: Return within freshness window
- **WHEN** the player reopens Receive within 15 seconds after a complete address read for the same account and network
- **THEN** the cached addresses appear without another read or loading dialog

#### Scenario: Refresh failure and recovery
- **WHEN** manual Refresh starts and subsequently fails
- **THEN** old values are no longer offered for copying and the operation error with OK covers the source page after the retry fails
- **AND** reopening Receive starts a fresh covered read without changing the account

#### Scenario: Clipboard failure
- **WHEN** the clipboard rejects an address copy
- **THEN** the UI explains the failure without claiming success and keeps the address selectable for manual copying

### Requirement: Receive navigation and accessibility
Back SHALL return to Account without clearing saved account material. Re-entering Receive SHALL show a valid recent same-account address result when available, otherwise start the default presentation and reload addresses. Closed, disposed, replaced-account, network-changed, or invalidated views SHALL NOT publish stale address results or cache them for later reuse. The page SHALL support keyboard navigation, labeled controls, readable 9:16 presentation without horizontal overflow, and access to Back when vertical scrolling is necessary.

#### Scenario: Back and re-entry
- **WHEN** the player leaves Receive and reopens it
- **THEN** the account is retained, a valid recent address result is reused when within 15 seconds or addresses reload when expired, and No Invoice/zero/empty-invoice defaults remain

#### Scenario: Late result
- **WHEN** an address request finishes after its view is closed or account replaced
- **THEN** it does not repopulate the obsolete view or cache stale account addresses

#### Scenario: Keyboard and portrait use
- **WHEN** the player navigates Receive by keyboard or in the 9:16 preview
- **THEN** enabled controls have visible focus and readable labels, disabled invoice controls cannot activate, and Back is reachable without horizontal scrolling
