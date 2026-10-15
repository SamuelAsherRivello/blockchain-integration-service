## MODIFIED Requirements

### Requirement: Independent sending and recovery stories
D3a SHALL be implemented independently of D5 pending-transfer recovery while respecting reservations on conflicting inputs and duplicate-operation protection. It SHALL NOT cancel or clear another operation. Automated/browser verification SHALL not depend on the user's existing locked account. Missing live-payment evidence SHALL be explicitly identified.

#### Scenario: Existing pending transfer
- **WHEN** an account with a pending transfer opens Send
- **THEN** the transfer's inputs remain reserved and Send can use verified unreserved inputs; insufficient unreserved funds are explained without modifying the transfer

