## MODIFIED Requirements

### Requirement: Read-only account inspection
Account restoration, balance reads, address reads, funding-address lookup and status reconciliation SHALL use read-only identities and SHALL NOT enable SDK automatic settlement. Manual transfer signing SHALL occur only through an explicitly confirmed transfer path. The account-automatic-onboarding coordinator is the sole additional automatic signing path: it starts from account activation and follows its fixed plan, durable boundaries and safe continuation rules. Inspection methods themselves SHALL remain read-only and SHALL NOT enable generic SDK automatic settlement. The separate account-transfer-cancellation capability MAY add an explicitly confirmed, exact-operation cancellation proof only after its targeting and terminal-finality prerequisites pass; it SHALL NOT enable automatic cancellation, re-registration, replacement payments or signing during Check Status.

#### Scenario: Read funded account
- **WHEN** a player opens an account view or refreshes a balance containing confirmed boarding deposits
- **THEN** the view or refresh initiates no registration, signature submission or settlement; independently authorized automatic onboarding can continue under account-automatic-onboarding

## ADDED Requirements

### Requirement: Automatic onboarding is a separate execution contract
The manual review, fresh-confirmation, pending-transfer acknowledgement and explicit recovery-authorization requirements of this capability SHALL continue to govern manual transfers. Automatic onboarding SHALL instead follow account-automatic-onboarding for its fixed two-leg authorization, safe continuation of provably unsubmitted work and spendability-based parent completion. Its automatic return leg SHALL verify exact owned final receipts without requiring Bitcoin block confirmation to complete the parent; manual reverse-transfer completion SHALL retain its confirmed-receipt requirement. These exceptions SHALL NOT permit ambiguous replay, automatic cancellation, spending another operation's reserved inputs, automatic reboarding of returned Bitcoin, or reinterpretation of legacy manual records.

#### Scenario: Automatic return after restart
- **WHEN** a resumed automatic onboarding parent has a verified boarding receipt and a return leg proven never submitted
- **THEN** it continues that fixed return without manual Review or Confirm Transfer and without replaying the first leg

#### Scenario: Manual transfer after restart
- **WHEN** an interrupted operation belongs to the manual transfer journey
- **THEN** its existing explicit review and recovery rules remain in force and onboarding does not adopt or automatically retry it
