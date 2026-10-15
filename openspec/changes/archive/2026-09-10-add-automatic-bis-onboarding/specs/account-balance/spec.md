## MODIFIED Requirements

### Requirement: Explicit refresh and loading
The system SHALL request balances on entry to the Account Details dialog and through an explicitly labeled Refresh control. It SHALL clear existing amounts and immediately cover the rendered page with the Pending Operation Dialog while requesting and preparing data, without inline loading text. Failed reads SHALL retry once, with 30 seconds per attempt where no tighter existing deadline applies. Refresh SHALL be disabled while a request is pending. Foreground Balance presentation SHALL NOT start its own polling or continuous subscription, or duplicate work when the already-open dialog is requested again. The independent account-automatic-onboarding coordinator SHALL observe funding and settlement on activation; these checks SHALL NOT persist live balance snapshots or open a foreground loading overlay. Verified onboarding transitions SHALL refresh shared payment availability and request a fresh visible balance read without restarting onboarding. Each request SHALL terminate in success or an unavailable state within a bounded deadline.

#### Scenario: Open or refresh
- **WHEN** the Account Details dialog opens or the player selects enabled Refresh
- **THEN** a fresh bounded read starts, previous amounts are absent, and loading is visible
- **AND** Refresh remains disabled until the request finishes or the presentation is left

#### Scenario: Idle successful view
- **WHEN** a successful balance remains displayed without further interaction
- **THEN** the foreground view starts no periodic balance refresh; independent onboarding observation remains active as required by account-automatic-onboarding

### Requirement: Transfer entry from Account Details
Accounts Details SHALL retain access to Account Transfer for the active account. Its Balance page SHALL place the onboarding status entry, rather than a manual transfer entry, immediately above Get Recovery Phrase. Existing refresh and account navigation SHALL remain available. Transfer entry and return SHALL read fresh balances and SHALL NOT move funds.

#### Scenario: Open and return
- **WHEN** the player opens Account Transfer and then selects Back
- **THEN** Account Details returns with a fresh read and no transfer submitted

## ADDED Requirements

### Requirement: Onboarding status entry
Balance SHALL show exactly Onboarding: Start?, Onboarding: Pending, or Onboarding: Complete immediately above Get Recovery Phrase. Start? SHALL mean verified funding is needed; Pending SHALL cover initial assessment, detected funding, execution, recovery and blocked verification; Complete SHALL follow account-automatic-onboarding completion or verified already-ready assessment. Selecting this entry SHALL open the active account's onboarding details, and Back SHALL return to Balance. Neither navigation action SHALL itself start, repeat or cancel a transfer. Automatic execution SHALL remain independent of navigation.

#### Scenario: Unfunded account
- **WHEN** a fresh assessment verifies that onboarding needs funding
- **THEN** Balance shows Onboarding: Start? and its details provide the boarding address and faucet action

#### Scenario: Initial check unavailable
- **WHEN** funding or readiness cannot yet be verified
- **THEN** Balance shows Onboarding: Pending and details explain checking or unavailable verification without asserting a zero balance

#### Scenario: Complete before Bitcoin confirmation
- **WHEN** account-automatic-onboarding verifies usable final target funds while Bitcoin confirmation is outstanding
- **THEN** the entry shows Onboarding: Complete and details preserve the individual Unconfirmed transaction status
