## MODIFIED Requirements

### Requirement: Continue commits the account
The player SHALL be able to save the phrase externally or proceed without saving. Continue SHALL NOT require a backup checkbox or phrase verification. Successful durable saving SHALL precede activation and an accountConnected event carrying only a safe profile identifier. Saving SHALL be idempotent for repeated Continue actions. Account creation SHALL NOT imply funding, payment success, or network availability.

#### Scenario: Complete A2.09 and A2.10
- **WHEN** the player selects Continue and saving succeeds
- **THEN** the account becomes active and the Account dialogue shows the logged-in message with shortened public Account ID and a line break after "as", as specified by account-entry
- **AND** it contains enabled lightning-prefixed Log Out opening the A6 backup confirmation and enabled Back, with Create Account and Restore Account hidden

#### Scenario: Saving fails
- **WHEN** storage cannot commit the account
- **THEN** the Pending Operation Dialog reports the error with only OK without publishing activation
- **AND** OK closes the failed source page and reconciles any uncertain saved account before returning

### Requirement: Failures and stale work do not activate accounts
Creation SHALL be covered by Creating... in the Pending Operation Dialog. Failures SHALL offer a sanitized explanation and only OK, which closes the failed source page and returns to the logged-out Account dialogue unless reconciliation finds a committed account. Abandoning a transient flow SHALL not activate it. Reset or disposal SHALL invalidate pending work so its late completion cannot notify old consumers or persist an abandoned account.

#### Scenario: Reset during creation
- **WHEN** Reset Client completes while creation was pending and the old request later succeeds
- **THEN** no account is saved or activated by that old request

#### Scenario: Creation failure
- **WHEN** account creation fails
- **THEN** OK closes the failed source page without claiming activation or blocking ordinary gameplay
