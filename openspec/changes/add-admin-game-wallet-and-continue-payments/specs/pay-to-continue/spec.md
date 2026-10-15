## MODIFIED Requirements

### Requirement: Confirm real sink payment before reporting continuation success
One explicit continuation request SHALL initiate at most one real Signet payment of the requested sats to the configured game-wallet recipient. New requests SHALL NOT generate a sink wallet or fall back to another recipient. Missing, invalid, wrong-network or self-payment configuration SHALL prevent submission with an attributable error. It SHALL NOT require a second confirmation overlay or consume call. Submission alone SHALL NOT produce success. Success SHALL identify the request, recipient and confirmed paid amount; fees SHALL be distinguishable from that amount. New results SHALL identify game-wallet payment, while historical sink results SHALL remain truthfully labeled and recoverable from their original evidence. Receiving SHALL require neither Admin to be open nor game-wallet signing credentials in the player host.

#### Scenario: Confirmed completion
- **WHEN** authoritative operation evidence confirms payment to the configured game recipient
- **THEN** the caller receives success associated with the request, recipient and amount

#### Scenario: Unsupported mechanism
- **WHEN** recipient configuration is missing or unsupported
- **THEN** no new payment is submitted and no generated-recipient fallback is used

#### Scenario: Admin is offline
- **WHEN** the player pays a valid configured game recipient while Admin is closed
- **THEN** payment can complete using only the player's signing identity

### Requirement: Preserve operation identity across uncertainty
Requests SHALL carry a stable operation identity bound to the account, amount, caller continuation context and captured recipient for new payments. Repeating an identity SHALL reconcile or return the original result without a second payment; changing its bound inputs SHALL fail. Submitted unknown outcomes SHALL remain pending and survive reload. Confirmed failure SHALL be distinguished from timeout or lost response. Closing UI SHALL NOT cancel the operation. Results SHALL remain attributable to their original context so a host can ignore obsolete runs, and SHALL NOT claim that gameplay resumed. Configuration changes SHALL NOT redirect existing operations. Legacy sink-payment journals SHALL remain recoverable using their stored send evidence without current recipient configuration.

#### Scenario: Duplicate request
- **WHEN** the same request is repeated during uncertainty or after success
- **THEN** the original operation is inspected or returned without another payment

#### Scenario: Lost response and reload
- **WHEN** submission may have occurred but its response is lost and the page reloads
- **THEN** the operation remains discoverable for reconciliation and no automatic replacement payment is submitted

#### Scenario: Run replaced
- **WHEN** the original operation succeeds after the host has started another run
- **THEN** its result retains the original context and does not authorize continuation of the replacement run

#### Scenario: Recipient changes between deployments
- **WHEN** a pending operation is recovered under a different build-configured recipient
- **THEN** recovery uses its original stored destination and does not submit a replacement payment

#### Scenario: Legacy sink journal
- **WHEN** an existing submitted sink-payment journal is loaded by the updated host
- **THEN** it reconciles its original send without creating a game-wallet payment
