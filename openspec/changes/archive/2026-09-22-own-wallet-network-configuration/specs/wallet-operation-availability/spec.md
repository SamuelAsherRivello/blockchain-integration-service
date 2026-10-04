# Spec Delta

## ADDED Requirements

### Requirement: Operation availability includes shared policy reasons
Wallet operation availability SHALL consume wallet-network-configuration and include its network/operator policy result in each operation's availability decision. Availability presentations SHALL distinguish policy unsupported, policy unavailable, network mismatch, insufficient unreserved funds, input reservation, SDK capability limitation, and stale review. A positive balance or successful policy read SHALL NOT override reservations, account mismatch, or operation-specific unsupported terms.

#### Scenario: Operation blocked by policy, not funds
- **WHEN** the active account has enough unreserved sats but the current operator policy is unsupported for the requested operation
- **THEN** the operation is unavailable with a policy-specific reason rather than an insufficient-funds reason

#### Scenario: Independent operation remains available
- **WHEN** a pending transfer reserves one input and another operation has enough verified unreserved funds under supported policy
- **THEN** the independent operation remains available and uses only unreserved inputs

#### Scenario: Policy read fails
- **WHEN** fresh operator policy cannot be verified
- **THEN** availability reports policy verification unavailable and does not submit, clear, or alter existing operations

