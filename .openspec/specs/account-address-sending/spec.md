# account-address-sending Specification

## Purpose
Allow account holders to explicitly send Signet funds to another Arkade address with exact reviewed amounts and durable protection against duplicate payments.

## Requirements

### Requirement: Direct send entry
Send SHALL support only Arkade-to-Arkade payments with manual recipient entry, explicit Paste, live spendable funds, whole-sats amount and Max. It SHALL omit Bitcoin source/destination choices, Lightning, QR and fiat controls. Unsupported, invalid, mainnet, self or foreign-operator recipients SHALL be rejected. Unknown funds SHALL be unavailable rather than zero.

#### Scenario: Usable entry
- **WHEN** a user enters a supported recipient and affordable positive whole-sats amount
- **THEN** Review Send is available without automatically sending or converting funds

#### Scenario: Clipboard race
- **WHEN** Paste fails or completes after newer edits
- **THEN** manual entry remains usable and newer input is preserved

### Requirement: Exact review and confirmation
Review SHALL show full recipient, source, payment type, Signet, exact recipient amount, aggregate fee and total deducted. Max SHALL respect fees and dust. Back SHALL preserve the draft. Only explicit confirmation of the current account's issued, unexpired, unchanged review SHALL authorize submission.

#### Scenario: Stale or forged review
- **WHEN** account, inputs, amount, recipient or fee changes, or the quote expires or is replayed
- **THEN** submission is rejected and a fresh review is required

### Requirement: Durable send lifecycle
A public transaction identity SHALL be durably recorded before submission. Pending sends SHALL survive navigation/restart and block conflicting spending/account clearing. Unknown outcomes SHALL not trigger automatic replay. Disposed views SHALL not receive stale updates. Success SHALL require verified finalization, not merely submission.

#### Scenario: Lost response
- **WHEN** submission may have succeeded but its response is lost
- **THEN** the same transaction is checked without creating another payment or claiming failure

#### Scenario: Storage failure
- **WHEN** preparation cannot be durably saved
- **THEN** no submission occurs

### Requirement: Independent sending and recovery stories
D3a SHALL be implemented independently of D5 pending-transfer recovery while respecting reservations on conflicting inputs and duplicate-operation protection. It SHALL NOT cancel or clear another operation. Automated/browser verification SHALL not depend on the user's existing locked account. Missing live-payment evidence SHALL be explicitly identified.

#### Scenario: Existing pending transfer
- **WHEN** an account with a pending transfer opens Send
- **THEN** the transfer's inputs remain reserved and Send can use verified unreserved inputs; insufficient unreserved funds are explained without modifying the transfer

### Requirement: Production presentation and real history
The existing light production UI SHALL remain readable and keyboard accessible in narrow portrait hosts and use the lightning loader for asynchronous work. Real outcomes SHALL expose the transaction identifier and allow fresh balance/Activity reads. No fixture result or invented transaction SHALL appear in the production demo.

#### Scenario: Independent host
- **WHEN** Send is mounted without demo CSS
- **THEN** entry, review, full address, errors and actions remain readable without horizontal overflow

### Requirement: Direct send uses shared wallet network policy
Direct Arkade Send SHALL obtain its active network/operator policy from wallet-network-configuration. The reviewed quote SHALL continue to bind the complete policy that affects the transaction, and confirmation SHALL reject a stale review if the current policy differs from the reviewed policy. Direct Send SHALL NOT block solely because the operator reports non-transfer on-chain fee fields that are not a separate direct-send charge, provided the complete policy is included in the quote comparison.

#### Scenario: Send review binds policy
- **WHEN** a user reviews an Arkade-to-Arkade send
- **THEN** the review is bound to the active account, recipient, amount, selected inputs, and current normalized operator policy

#### Scenario: Send policy changes after review
- **WHEN** the current operator policy differs from the policy used for Review Send
- **THEN** Confirm Send rejects the stale review without submitting and requires a fresh review

#### Scenario: Direct send does not inherit transfer-only block
- **WHEN** a policy value would make Account Transfer unsupported but Direct Send can still safely bind and validate its transaction terms
- **THEN** Direct Send remains reviewable and confirmable under its own policy rules
