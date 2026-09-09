## ADDED Requirements

### Requirement: Composed withdrawal status and confirmation
Arkade-to-Bitcoin transfers requiring preparation SHALL follow withdrawal-input-preparation within the existing transfer flow. Preparation SHALL have an independently recorded transaction identifier and outcome linked to the original transfer. Preparation completion SHALL NOT be represented as Bitcoin withdrawal success. A fresh confirmation after restart SHALL authorize only an outstanding unsubmitted leg and SHALL NOT replay a registered withdrawal. Existing direct asset-bearing withdrawals SHALL retain asset-change output validation.

#### Scenario: Navigation during withdrawal preparation
- **WHEN** a player navigates away after confirming preparation and withdrawal
- **THEN** the same authorized worker and operation retain ownership, and returning shows the actual stage without starting either leg again

#### Scenario: Bitcoin completion after B1 spent prepared change
- **WHEN** B1 consumes the independently prepared asset-bearing change before the Bitcoin withdrawal confirms
- **THEN** withdrawal reconciliation verifies its dedicated input and exact Bitcoin receipt without requiring that already-spent preparation change remain an unspent withdrawal output
- **AND** asset preservation is verified through the preparation and subsequent payment evidence

### Requirement: Existing interrupted account recovery remains a delivery gate
This change SHALL preserve all previously registered transfer identities and reservations. Preparation SHALL NOT spend an input reserved by an older unresolved intent. The issue SHALL NOT be declared fully resolved until the reported existing operation has verified completion or supported authoritative terminal cancellation/failure, its affected reservation is durably released, and B1 succeeds on the same restored account without clearing history or adding funds to mask the hold. Unsupported operator recovery SHALL remain an explicit undelivered dependency, distinct from successful preparation of new withdrawals.

#### Scenario: Reported existing operation remains unresolved
- **WHEN** operation 4428bcbe-72db-43e9-a59d-f39150837dae has only a recorded validation error and an unspent input, without sufficient terminal evidence
- **THEN** it remains unresolved and protected; tests passing on new withdrawals do not count as recovery of that operation

#### Scenario: Existing operation verified resolved
- **WHEN** supported evidence verifies the old transfer's completion or terminal cancellation/failure
- **THEN** its original record gains the verified outcome, only its reservations are released, and shared account state refreshes before a separately requested B1 payment
- **AND** receipt evidence for that B1 payment is required to close the existing-account acceptance gate
