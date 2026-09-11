## MODIFIED Requirements

### Requirement: Continue commits the account
The player SHALL be able to save the phrase externally or proceed without saving. Continue SHALL NOT require a backup checkbox or phrase verification. Successful durable saving SHALL precede activation and an accountConnected event carrying only a safe profile identifier. Saving SHALL be idempotent for repeated Continue actions. Account creation SHALL NOT imply funding, payment success, or network availability. Before durable saving or activation, BIS SHALL verify that the candidate public profile ID is not the currently selected Game Wallet. If it is selected as the Game Wallet, BIS SHALL reject Continue with a clear non-secret role-conflict error, retain the candidate recovery screen, leave the Player Wallet and Game Wallet selections unchanged, and emit no accountConnected event.

#### Scenario: Complete A2.09 and A2.10
- **WHEN** the player selects Continue and saving succeeds
- **THEN** the account becomes active and the Account dialogue shows the logged-in message with shortened public Account ID and a line break after "as", as specified by account-entry
- **AND** it contains enabled lightning-prefixed Log Out opening the A6 backup confirmation and enabled Back, with Create Account and Restore Account hidden

#### Scenario: Candidate conflicts with Game Wallet
- **WHEN** a newly created Player Wallet's public profile ID matches the selected Game Wallet when the player selects Continue
- **THEN** BIS rejects the Player Wallet activation with a clear role-conflict error before saving or emitting accountConnected
- **AND** the candidate remains only in the private recovery flow and both previously selected roles remain unchanged

#### Scenario: Saving fails
- **WHEN** storage cannot commit the account
- **THEN** the Pending Operation Dialog reports the error with only OK without publishing activation
- **AND** OK closes the failed source page and reconciles any uncertain saved account before returning
