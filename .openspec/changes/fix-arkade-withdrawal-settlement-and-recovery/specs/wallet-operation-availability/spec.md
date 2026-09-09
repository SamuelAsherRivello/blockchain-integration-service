## ADDED Requirements

### Requirement: Resolution refreshes spendability without logout
Verified completion or terminal cancellation SHALL durably release only the resolved operation's reservation and refresh the owning account's balances, assets, Activity and payment availability. Unresolved operations SHALL retain reservations across ordinary navigation and restart. Explicit logout after wallet-backup acknowledgement and, when the pending count exceeds zero, pending-loss acknowledgement SHALL clear player transaction and recovery records, including continuation and reservation journals, without requiring pending operations to resolve. Separate Admin game-wallet records SHALL remain intact. Administrative reset retains its existing guards. A total balance exceeding a requested payment SHALL NOT imply that reserved inputs are spendable.

#### Scenario: Payment after verified resolution
- **WHEN** a withdrawal or its cancellation is durably verified and the original account has enough fresh eligible sats
- **THEN** B1 can pay without logout or manually clearing browser state
- **AND** unrelated operation reservations remain protected

#### Scenario: Positive balance entirely reserved
- **WHEN** a pending withdrawal reserves all currently eligible inputs and B1 cannot fund 1,000 sats
- **THEN** B1 explains the pending reservation and points to that operation's status
- **AND** the app does not replace total balance with zero or submit a conflicting payment

#### Scenario: Explicit logout clears local records without cancelling transactions
- **WHEN** a player acknowledges their backup and requests logout while a withdrawal remains unresolved
- **THEN** logout succeeds after the backup and pending-loss checkboxes and removes player operation journals and reservations; submitted transactions are not cancelled

#### Scenario: Refresh unavailable
- **WHEN** terminal resolution is durable but the fresh balance service is unavailable
- **THEN** the verified outcome remains recorded and balances are reported unavailable rather than fabricated or reset to zero

#### Scenario: Terminal persistence fails
- **WHEN** terminal evidence cannot be saved durably
- **THEN** input reservations remain protected and the app does not advertise them as released
