# Spec Delta

## ADDED Requirements

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
