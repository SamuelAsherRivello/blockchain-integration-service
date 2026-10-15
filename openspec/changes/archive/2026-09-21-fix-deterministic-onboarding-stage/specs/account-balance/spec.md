## MODIFIED Requirements

### Requirement: Onboarding status entry
Balance SHALL show exactly Onboarding: Start?, Onboarding: Pending, or Onboarding: Complete immediately above Get Recovery Phrase. Start? SHALL mean verified funding is needed with no positive Arkade balance; Pending SHALL cover initial assessment, detected funding, execution, recovery and blocked verification when the active account has no positive Arkade balance; Complete SHALL follow account-automatic-onboarding completion, verified already-ready assessment, or a fresh positive Arkade balance for the active account. Selecting this entry or Admin E3 SHALL open the active account's onboarding details using the same fresh active-account balance state currently displayed by Account Details, or start one bounded fresh read before presenting readiness. A successful balance from another account, an unavailable balance, and a prior-entry balance SHALL NOT be reused. Back SHALL return to Balance. Neither navigation action SHALL itself start, repeat or cancel a transfer. Automatic execution SHALL remain independent of navigation.

#### Scenario: Unfunded account
- **WHEN** a fresh assessment verifies that onboarding needs funding and the active account has no positive Arkade balance
- **THEN** Balance shows Onboarding: Start? and its details provide the boarding address and faucet action

#### Scenario: Initial check unavailable
- **WHEN** funding, readiness, and the fresh balance cannot yet be verified
- **THEN** Balance shows Onboarding: Pending and details explain checking or unavailable verification without asserting a zero balance

#### Scenario: Existing Arkade balance
- **WHEN** Account Details has a fresh positive Arkade balance and the player selects its Onboarding entry or Admin E3
- **THEN** the entry shows Onboarding: Complete and Onboarding renders stage 5 with all five stages Complete
- **AND** the navigation does not issue a transfer or persist the balance

#### Scenario: Complete before Bitcoin confirmation
- **WHEN** account-automatic-onboarding verifies usable final target funds while Bitcoin confirmation is outstanding
- **THEN** the entry shows Onboarding: Complete and details preserve the individual Unconfirmed transaction status
