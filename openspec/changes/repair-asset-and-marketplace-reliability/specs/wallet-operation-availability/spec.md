# Spec Delta

## ADDED Requirements

### Requirement: Mint availability uses current reserved-input evidence
Mint availability SHALL use fresh active-network input evidence and durable reservations, and SHALL not treat total wallet balance alone as proof that issuance can submit.

#### Scenario: Pending operation consumes the only eligible input
- **WHEN** an unresolved operation reserves the wallet's only mintable input
- **THEN** mint availability is disabled with the reserved-input reason while recovery remains available

#### Scenario: Independent input becomes available
- **WHEN** a fresh read proves an unreserved input sufficient for issuance and fees
- **THEN** mint availability becomes ready without clearing or replacing the prior operation

### Requirement: Availability invalidates on wallet evidence changes
Asset readiness SHALL be invalidated by account, network, provider, reservation, operation, logout, reset, and fresh ownership changes.

#### Scenario: Prior unavailable result settles
- **WHEN** an unavailable mint attempt completes before submission
- **THEN** a later distinct operation re-evaluates current evidence instead of replaying the old unavailable state
