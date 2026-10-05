## MODIFIED Requirements

### Requirement: Consistent operation availability
Max, quotes and submissions SHALL use fresh eligible unreserved inputs including fees, revalidated at confirmation. New partial Arkade-to-Bitcoin withdrawals SHALL prepare independent change under withdrawal-input-preparation when the selected funds exceed the required withdrawal funding, rather than reserve the excess through settlement. Mint input control SHALL be proven before independent minting is enabled. Burn SHALL use the same account/network-scoped reservation and mutation-coordination policy as other wallet mutations, but transient lock contention SHALL not be reported as generic unavailable until its bounded wait/retry policy is exhausted. The UI SHALL distinguish insufficient independent funds, unavailable verification, unsupported input selection, input conflict, and temporary wallet contention. SDK balance alone SHALL NOT override reservations. Verified preparation SHALL transition reservations atomically between its completed input spend and the dedicated withdrawal output reservation; surplus change SHALL NOT remain reserved by the parent transfer.

#### Scenario: Small request reserves large coin
- **WHEN** an existing unresolved 1000-sat transfer predates preparation and consumes the account's sole 289715-sat eligible input
- **THEN** no independent spendable funds are advertised and the UI explains that the whole input remains reserved pending verified recovery

#### Scenario: New small withdrawal preserves change
- **WHEN** a newly confirmed 1000-sat withdrawal starts from the sole 263715-sat eligible input at verified zero fees
- **THEN** withdrawal registration follows verified preparation and only 1000 sats remain reserved for that withdrawal; the 262715-sat change is independently spendable

#### Scenario: Independent funding arrives
- **WHEN** a fresh read verifies a newly received independent spendable coin
- **THEN** eligible operations become available without clearing the existing pending transfer

#### Scenario: Mint adapter cannot constrain inputs
- **WHEN** supported SDK issuance cannot exclude reserved inputs
- **THEN** independent minting remains unavailable with that reason while supported disjoint transfers, sends, and burns remain available

#### Scenario: Temporary wallet contention
- **WHEN** Burn starts while another same-account wallet mutation holds the shared lock and the competing operation is expected to finish within the bounded coordination window
- **THEN** Burn remains an explicit pending user action, waits or retries safely, and proceeds only after it obtains a fresh account and reservation check

#### Scenario: Persistent contention or unavailable verification
- **WHEN** the lock does not become available within the bounded policy or fresh input/holding verification cannot complete
- **THEN** Burn does not submit, reports the specific temporary/unavailable reason, and preserves all existing reservations and recovery records
