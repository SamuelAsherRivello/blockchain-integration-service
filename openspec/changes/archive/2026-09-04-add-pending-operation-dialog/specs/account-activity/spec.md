## MODIFIED Requirements

### Requirement: Bounded loading and asset history
Initial Activity loading SHALL allow 75 seconds per attempt and automatically retry once under the Pending Operation Dialog. After two failures, the dialog SHALL show an error and only OK, which closes it and the source page. History reads SHALL begin without awaiting notification subscription setup. Polling SHALL remain available when subscription setup fails or stalls. Cleanup SHALL NOT delay failure reporting, and late results after cancellation SHALL be ignored.

Transactions SHALL retain SDK asset mint, receive, and transfer entries, including asset identifiers and exact signed integer quantities. Negative outgoing asset deltas, including burns, SHALL remain valid history and preserve their sign without rounding. Quantities without known decimal metadata SHALL be labeled base units. Account-scoped saved mint and transfer operations MAY supplement SDK history, with explicit pending or recorded statuses rather than fabricated confirmation, timestamps, or sats. Matching known transaction references SHALL avoid duplicate local mint entries. On live history failure, saved operations MAY remain visible with a notice that live history is unavailable; Copy SHALL remain available for that displayed text.

#### Scenario: Subscription or cleanup never completes
- **WHEN** notification setup stalls or wallet cleanup never resolves
- **THEN** initial history can load independently and exhausted foreground failures show the operation error and OK without waiting for cleanup

#### Scenario: Asset amount exceeds safe JavaScript integer range
- **WHEN** SDK history includes an asset quantity larger than the safe integer range
- **THEN** Transactions and Copy preserve every digit alongside the asset ID and supported status

#### Scenario: Outgoing asset delta
- **WHEN** history includes a negative asset quantity for an outgoing transaction or burn
- **THEN** the history loads successfully and displayed or copied details retain its exact signed quantity alongside other records

### Requirement: Public state and freshness
The public integration API SHALL expose normalized incoming and outgoing transaction history and loading, ready, and unavailable states without SDK-specific types or secrets. Opening Activity SHALL load existing history and enable automatic updates while open. A successful empty result SHALL say No transactions found and be distinguishable from an unavailable read. Subscription failure alone SHALL permit polling fallback. Initial load and manual refresh SHALL be covered immediately by the Pending Operation Dialog with no inline loading text. Only prepared content SHALL be revealed; final loading errors and OK SHALL close the source page. Transactions SHALL provide an explicitly labeled Refresh control, disabled while loading, matching Account Details. Unavailable foreground loads SHALL use the Pending Operation Dialog failure contract and SHALL NOT present prior data as current.

#### Scenario: Arrival while open
- **WHEN** a new incoming or outgoing transaction is reported while Activity is open
- **THEN** public state and the production list update without clicking Refresh Balance, including arrivals during initial loading

#### Scenario: Failure after success
- **WHEN** an activity read or detected monitoring failure occurs after a successful display
- **THEN** Activity reports unavailable rather than an empty successful list or apparently current prior result
