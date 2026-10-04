## MODIFIED Requirements

### Requirement: Continue commits the account
The player SHALL be able to save the phrase externally or proceed without saving. Continue SHALL NOT require a backup checkbox or phrase verification. Successful durable saving SHALL precede activation and an accountConnected event carrying only a safe profile identifier. Saving SHALL be idempotent for repeated Continue actions. Account creation SHALL NOT imply funding, payment success, or network availability.

#### Scenario: Complete A2.09 and A2.10
- **WHEN** the player selects Continue and saving succeeds
- **THEN** the account becomes active and the Account dialogue shows the logged-in message with shortened public Account ID and a line break after "as", as specified by account-entry
- **AND** it contains enabled lightning-prefixed Log Out opening the A6 backup confirmation and enabled Back, with Create Account and Restore Account hidden

#### Scenario: Saving fails
- **WHEN** storage cannot commit the account
- **THEN** the integration reports the error and offers Retry or Back without publishing activation
- **AND** Retry uses the same transient identity

### Requirement: One-click recovery phrase copy
The recovery screen SHALL show Copy to Clipboard immediately above Continue. An explicit click SHALL copy the complete phrase as plain text, with single spaces between words and no numbering or extra formatting. Success SHALL be announced only after the clipboard write succeeds. Failure SHALL show a safe retry/manual-copy message and SHALL NOT block Continue or activate the account. The application SHALL NOT read the clipboard as part of this action. A3 restoration SHALL accept this whitespace-separated phrase format through its Paste from Clipboard action.

#### Scenario: Copy recovery phrase
- **WHEN** the player clicks Copy to Clipboard and the clipboard write succeeds
- **THEN** the clipboard contains all 12 words in order separated by single spaces
- **AND** the UI announces successful copying without exposing recovery material to public events or logs

#### Scenario: Clipboard unavailable or denied
- **WHEN** the clipboard write fails
- **THEN** the player can retry or copy manually and Continue remains available
