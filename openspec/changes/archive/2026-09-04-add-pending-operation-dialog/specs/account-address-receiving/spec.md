## MODIFIED Requirements

### Requirement: Address receiving and refresh
An active account SHALL offer Receive with separate labeled Arkade and Bitcoin address fields and independent Copy controls. Addresses SHALL load on entry and manual Refresh. Loading or failed reads SHALL NOT leave stale addresses copyable. Reads SHALL use the Pending Operation Dialog, retry once automatically, and reveal only prepared fields. Final failure SHALL show a safe error and only OK, closing Receive on acknowledgement. Receive SHALL NOT initiate a payment, funding request, or account transfer.

#### Scenario: Entry and copy
- **WHEN** an active account opens Receive and address loading succeeds
- **THEN** both address fields display their actual values and each Copy action copies only its own value with truthful feedback

#### Scenario: Refresh failure and recovery
- **WHEN** manual Refresh starts and subsequently fails
- **THEN** old values are no longer offered for copying and the operation error with OK covers the source page after the retry fails
- **AND** reopening Receive starts a fresh covered read without changing the account

#### Scenario: Clipboard failure
- **WHEN** the clipboard rejects an address copy
- **THEN** the UI explains the failure without claiming success and keeps the address selectable for manual copying
