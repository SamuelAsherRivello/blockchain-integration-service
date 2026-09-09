## MODIFIED Requirements

### Requirement: Consistent operation availability
Max, quotes and submissions SHALL use fresh eligible unreserved inputs including fees, revalidated at confirmation. New partial Arkade-to-Bitcoin withdrawals SHALL prepare independent change under withdrawal-input-preparation when the selected funds exceed the required withdrawal funding, rather than reserve the excess through settlement. Mint input control SHALL be proven before independent minting is enabled. The UI SHALL distinguish insufficient independent funds, unavailable verification, unsupported input selection and input conflict. SDK balance alone SHALL NOT override reservations. Verified preparation SHALL transition reservations atomically between its completed input spend and the dedicated withdrawal output; surplus change SHALL NOT remain reserved by the parent transfer.

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
- **THEN** independent minting remains unavailable with that reason while supported disjoint transfers and sends remain available

## ADDED Requirements

### Requirement: Preparation-aware reservation continuity
All wallet mutation paths SHALL honor preparation input reservations and the dedicated withdrawal output reservation. Releasing completed preparation inputs SHALL require durable, verified output handoff. Available change SHALL refresh the shared balance, assets, Activity and B1 views for the owning account, without creating a payment or changing an unrelated account.

#### Scenario: Payment races preparation completion
- **WHEN** B1 and preparation completion run in separate cooperating contexts
- **THEN** B1 can select verified change only after the durable handoff and cannot select either the unresolved source input or the dedicated withdrawal output

#### Scenario: Handoff persistence fails
- **WHEN** the verified preparation result cannot be durably saved
- **THEN** the system retains a spending hold and does not advertise change as independently available until reconciliation safely completes the handoff
