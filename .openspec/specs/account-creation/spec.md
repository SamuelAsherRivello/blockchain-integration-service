# account-creation Specification

## Purpose

Create and remember genuine test accounts through the production integration while keeping recovery material private and account state truthful.

## Requirements

### Requirement: Explicit real test account creation
A logged-out player SHALL explicitly start creation. The integration SHALL create a genuine Signet account through the configured Arkade integration, show the lightning loader during asynchronous operations, and display recovery material immediately on successful creation. It SHALL NOT create accounts merely on opening a dialogue, viewing a story, or refreshing. It SHALL reject non-Signet configuration and SHALL NOT substitute simulated success.

#### Scenario: Create and reveal recovery
- **WHEN** a logged-out player selects Create Account and creation succeeds
- **THEN** the recovery screen appears with a clear Signet test-only warning, including never entering or reusing a real-funds recovery phrase
- **AND** no active account or accountConnected event is published yet

#### Scenario: Repeated creation requests
- **WHEN** Create Account is requested again while creation is pending
- **THEN** no concurrent identity creation starts

### Requirement: Continue commits the account
The player SHALL be able to save the phrase externally or proceed without saving. Continue SHALL NOT require a backup checkbox or phrase verification. Successful durable saving SHALL precede activation and an accountConnected event carrying only a safe profile identifier. Saving SHALL be idempotent for repeated Continue actions. Account creation SHALL NOT imply funding, payment success, or network availability.

#### Scenario: Complete A2.09 and A2.10
- **WHEN** the player selects Continue and saving succeeds
- **THEN** the account becomes active and the Account dialogue shows "You are now logged in."
- **AND** it contains disabled lightning-prefixed Log Out and enabled Back, with Create Account and Restore Account hidden

#### Scenario: Saving fails
- **WHEN** storage cannot commit the account
- **THEN** the integration reports the error and offers Retry or Back without publishing activation
- **AND** Retry uses the same transient identity

### Requirement: Completed accounts survive reopening
A completed account SHALL remain available in the same browser profile and origin across refreshes and browser restarts while its stored data remains available. Opening the account flow SHALL recognize it without creating another account or requiring phrase entry. Ordinary disposal SHALL preserve committed identity. Unfinished creation SHALL NOT be restored after reopening. No unlock step SHALL be required in this test-only slice.

#### Scenario: Refresh after Continue
- **WHEN** an account was committed and the application is reopened
- **THEN** it loads the same profile and presents the minimal logged-in dialogue when account presentation is requested
- **AND** it does not claim a new account was created or that the wallet is online

#### Scenario: Refresh before Continue
- **WHEN** the player refreshes or closes the application before committing creation
- **THEN** the next entry starts the logged-out flow without resuming recovery or remembering that transient identity

#### Scenario: Invalid saved state
- **WHEN** saved account state cannot be read or recognized
- **THEN** an account error is shown without silently overwriting it or creating a replacement
- **AND** ordinary gameplay remains available

### Requirement: Recovery material stays private
Recovery material SHALL appear only in the private production recovery UI, scoped account storage, and the clipboard after an explicit Copy to Clipboard action. Public state, callbacks, event history, logs, analytics, URLs, and captured verification artifacts SHALL NOT contain it. Stored identity SHALL NOT be plaintext recovery material. The interface SHALL make no production security or guaranteed recovery claim.

#### Scenario: Inspect host-visible events
- **WHEN** creation progresses through recovery and activation
- **THEN** the host and Admin receive only non-secret state and events

### Requirement: Failures and stale work do not activate accounts
Creation failures SHALL offer a sanitized explanation, explicit Retry, and Back to the logged-out Account dialogue. Abandoning a transient flow SHALL not activate it. Reset or disposal SHALL invalidate pending work so its late completion cannot notify old consumers or persist an abandoned account.

#### Scenario: Reset during creation
- **WHEN** Reset Client completes while creation was pending and the old request later succeeds
- **THEN** no account is saved or activated by that old request

#### Scenario: Creation failure
- **WHEN** account creation fails
- **THEN** the player can retry explicitly or return without an active account or blocked gameplay

### Requirement: One-click recovery phrase copy
The recovery screen SHALL show Copy to Clipboard immediately above Continue. An explicit click SHALL copy the complete phrase as plain text, with single spaces between words and no numbering or extra formatting. Success SHALL be announced only after the clipboard write succeeds. Failure SHALL show a safe retry/manual-copy message and SHALL NOT block Continue or activate the account. The application SHALL NOT read the clipboard as part of this action. Future A3 restoration SHALL accept this whitespace-separated phrase format; a Paste from Clipboard action remains A3 work.

#### Scenario: Copy recovery phrase
- **WHEN** the player clicks Copy to Clipboard and the clipboard write succeeds
- **THEN** the clipboard contains all 12 words in order separated by single spaces
- **AND** the UI announces successful copying without exposing recovery material to public events or logs

#### Scenario: Clipboard unavailable or denied
- **WHEN** the clipboard write fails
- **THEN** the player can retry or copy manually and Continue remains available
