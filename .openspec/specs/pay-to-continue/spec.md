# pay-to-continue Specification

## Purpose

Deliver B1. MVP Request Continue: a minimal game-facing operation with real Signet payment to a configured game wallet and attributable, recoverable outcomes. B2-B4 game integration and expanded UI are outside this capability's MVP scope.

## Requirements

### Requirement: Validate the continuation price before submission
The API SHALL accept numeric whole-sat amounts from 1,000 to 10,000 inclusive and SHALL throw an error for every other value before submission. It SHALL document that client-controlled pricing is not fail-safe or cheat-resistant. No account, insufficient spendable funds, or an incompatible unresolved operation SHALL prevent submission and produce an attributable error without automatically opening wallet UI or funding the account.

#### Scenario: Amount boundaries
- **WHEN** a caller supplies 1,000 or 10,000 sats with an available funded account
- **THEN** price validation passes

#### Scenario: Invalid amount
- **WHEN** a caller supplies a string, fractional amount, non-finite number, or number outside the inclusive range
- **THEN** the API throws before any payment is submitted

#### Scenario: Insufficient funds
- **WHEN** spendable funds do not cover the requested payment and verified required fees
- **THEN** the request reports insufficient funds and does not submit

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

### Requirement: Preserve assets while paying native sats
B1 SHALL accept SDK-eligible spendable inputs carrying assets and return every original asset quantity to the player's change output. It SHALL bind assets to the quote and verify the complete transaction extension before submission. Pending reconciliation SHALL verify the recipient contains only the requested sats and that player-owned change contains the expected sats and complete asset manifest. Ordinary Account Send selection is outside this repair.

#### Scenario: Player funds share an output with assets
- **WHEN** a valid 1,000-sat request uses an eligible 289,715-sat input carrying three assets
- **THEN** the verified transaction pays 1,000 sats to the recipient and returns 288,715 sats plus all three unchanged assets to the player
- **AND** missing, redirected or altered assets prevent submission
