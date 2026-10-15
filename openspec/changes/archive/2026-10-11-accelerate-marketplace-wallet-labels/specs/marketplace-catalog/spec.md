## ADDED Requirements

### Requirement: Independent wallet address labels
Marketplace SHALL display each wallet address independently of balances, inventory, and unrelated wallet reads. Pending selected identities SHALL display Loading, failed address reads SHALL display Unavailable, and absent local identities SHALL display Not connected unless the Game label displays configured public inventory. A known connected Game address SHALL NOT wait for catalog loading. Labels SHALL NOT establish transaction readiness.

#### Scenario: Slow ownership reads
- **WHEN** both selected wallet addresses are available but balance or asset reads remain pending
- **THEN** both addresses are displayed without waiting for those reads
- **AND** existing operation readiness checks remain required

#### Scenario: Address is pending or unavailable
- **WHEN** a selected wallet's address has not resolved or its read fails
- **THEN** its label distinguishes Loading or Unavailable from Not connected
- **AND** it does not borrow another role's address or an obsolete session address

#### Scenario: Identity or network changes
- **WHEN** a wallet is replaced, logged out, or moved to another network while address work is pending
- **THEN** obsolete results cannot populate either wallet label

### Requirement: Sub-second wallet label acceptance
Cold navigation and reload SHALL populate both selected wallet address labels within 1,000 ms in browser acceptance with local saved identities, operator configuration responding within 250 ms, and deliberately delayed balance/assets reads. Verification SHALL measure navigation-to-label times separately from live-provider latency. Unavailable remote configuration SHALL remain an explicit failure rather than fabricated data.

#### Scenario: Cold and repeated page load
- **WHEN** Marketplace is opened and reloaded with two selected test identities and the controlled configuration response budget
- **THEN** both actual corresponding addresses appear within 1,000 ms of each navigation
- **AND** balance and inventory may still be pending

#### Scenario: Slow or failed operator
- **WHEN** operator configuration exceeds the acceptance response budget or fails
- **THEN** the page retains truthful pending or unavailable labels
- **AND** verification reports actual latency or failure without claiming the one-second goal passed
