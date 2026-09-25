## Purpose

Make the standalone six-step Signet spike recover safely from temporary failures, explain blockers, and reduce measurable client delays without weakening transaction evidence or changing the selected allocation.

## ADDED Requirements

### Requirement: Recoverable initialization
The spike SHALL display a usable loading or failure state before asynchronous account initialization. Temporary connection failures SHALL reconnect to the same saved account automatically. Unavailable required storage, missing browser capabilities, or unreadable identity material SHALL produce a specific blocker and a retry action without creating a replacement identity or erasing saved data.

#### Scenario: Operator unavailable during startup
- **WHEN** the saved account exists but initialization encounters a temporary operator outage
- **THEN** the app shows connection recovery and the next retry time, retains the account and pending operation, and resumes when the operator is reachable

#### Scenario: Storage initialization never completes
- **WHEN** required browser storage does not open within the configured startup deadline
- **THEN** the app leaves the loading state, explains the storage blocker, and prevents wallet submission while allowing a safe storage retry

### Requirement: Recovery policy for every step
Every asynchronous boundary in the six-step flow SHALL have a defined timeout, error classification, and fallback. Safe transient reads and provably unsubmitted preparation SHALL retry with bounded backoff. Retry schedules SHALL survive reload and respect provider rate limits. Unfamiliar errors SHALL trigger bounded safe diagnosis and reconciliation before either resuming a provably safe action or displaying an actionable pause. Validation failures MUST NOT automatically replay financial actions.

#### Scenario: Unseen error before submission
- **WHEN** preparation fails with an unrecognized exception and the saved checkpoint proves no submission began
- **THEN** the app performs a bounded number of safe rechecks, preserves the captured inputs, and either continues after valid preparation or shows a specific paused state

#### Scenario: Invalid fees or amounts
- **WHEN** fresh information shows unsupported fees, dust, invalid proof, expired inputs, or a network mismatch
- **THEN** the affected step explains what must change and does not silently alter the allocation, replace the frozen inputs, or repeatedly submit

#### Scenario: Rate limited recovery
- **WHEN** a provider supplies a future retry time
- **THEN** reloads, refresh clicks, notifications, and reconnect events do not issue an automatic retry before that time

### Requirement: Stalled work cannot silently freeze the run
Observation, initialization, lock acquisition, and durable writes SHALL have bounded waits with visible fallback states. Observation work SHALL release workflow ownership when it times out, and late results SHALL be ignored. Cancellation MUST NOT be represented as proof that a financial action failed. A replacement signer MUST NOT run concurrently with a signer or cleanup that has not terminated.

#### Scenario: Hung transaction history request
- **WHEN** transaction history never responds
- **THEN** the app reports a timed-out observation, continues independent status work, and remains responsive to confirmed Restart without accumulating requests or holding the workflow lock indefinitely

#### Scenario: Signing cleanup remains stuck
- **WHEN** the settlement stream is closed but signer cleanup has not terminated
- **THEN** the app continues independent read-only reconciliation and shows the cleanup blocker without starting a second signer

#### Scenario: Unrelated batch traffic continues without progress
- **WHEN** events keep arriving for batches that did not select the current intent
- **THEN** those events do not postpone the current transfer's recovery deadline, and expiry closes its actual event source before cleanup and reconciliation

#### Scenario: Selected batch makes progress
- **WHEN** the current intent is selected and its batch produces valid progress events
- **THEN** those events renew the progress deadline even when the event stream was opened before registration finished

### Requirement: Authoritative durable checkpoints
The spike SHALL persist the input snapshot, selected percentage, target, leg, submission identity, and recovery state before each dependent financial action. Failed persistence MUST NOT advance authoritative in-memory progress. A failed optional preference, timing, or diagnostic write MUST NOT stop wallet processing. A restart SHALL resolve its durable outcome before attempting another identity creation.

#### Scenario: Checkpoint write fails
- **WHEN** storing the prepared transfer fails before submission
- **THEN** no intent is submitted and the app preserves the last durable checkpoint until storage recovery and fresh validation succeed

#### Scenario: Restart commits but preferences fail
- **WHEN** a confirmed restart has saved the new encrypted account but resetting a display preference fails
- **THEN** the app reconnects to that new account without generating another account or retaining the old account as the active workflow

### Requirement: Reconcile uncertain financial outcomes
Missing acknowledgements, callback failures, stream loss, and reloads during either leg SHALL preserve uncertainty until evidence resolves it. Recovery SHALL reconcile the original inputs and attributable receipts before any SDK retry. It SHALL reuse the original allocation and exclude later deposits. Registration, cleanup acknowledgement, and an intermediate whole-total balance MUST NOT be treated as completion.

#### Scenario: Settlement completed but its acknowledgement was lost
- **WHEN** a boarding or return response is lost after the operator completed that leg
- **THEN** the spike discovers the exact attributable result and continues verification or the next leg without duplicating the completed transfer

#### Scenario: Critical callback cannot persist
- **WHEN** a settlement event callback fails while recording an acknowledgement
- **THEN** the workflow marks the attempt uncertain, preserves its original context, and reconciles instead of treating a logged error as successful persistence

#### Scenario: Earlier batch fails while the replacement intent waits
- **WHEN** a previous or unrelated batch failure arrives on the current transfer's input topics without selecting its registered intent
- **THEN** the current transfer keeps waiting for its own batch instead of starting another recovery cycle, while a failure of its selected batch still triggers recovery

### Requirement: Account and attempt isolation
Only results belonging to the current window, active account, operation revision, and submission attempt SHALL advance that workflow. Reload SHALL retain the same window state; another independently opened window SHALL retain independent state. A confirmed Restart SHALL remain available during an unresolved operation, archive the previous account and operation, and fence late callbacks without claiming to cancel an external transfer.

#### Scenario: Late result after restart
- **WHEN** an old account's request or settlement callback completes after Restart has activated another account
- **THEN** it cannot change the new account's operation, balances, recovery schedule, or completion status

#### Scenario: Repeated and concurrent triggers
- **WHEN** notifications, polling, a refresh click, and another window run concurrently
- **THEN** each window processes its own account and the same active attempt is not submitted twice

### Requirement: Actionable error listening
The spike SHALL capture startup failures, awaited failures, callback exceptions, unhandled rejections, resource-loading failures, and browser connectivity/lifecycle changes. The affected step SHALL show whether it is waiting normally, recovering, or paused, plus its last successful checkpoint and next action. Diagnostics SHALL use bounded, redacted records and MUST NOT include recovery material, signed request bodies, or arbitrary provider payloads.

#### Scenario: New callback exception
- **WHEN** a previously unseen callback throws
- **THEN** the error is associated with its step and attempt, a recovery or pause action is selected, and the page remains usable without exposing the thrown payload

#### Scenario: Faucet unavailable or popup blocked
- **WHEN** funding has not appeared or the faucet cannot be opened
- **THEN** Step 2 keeps a copyable address and direct faucet link, explains that no deposit is yet verified, and never automatically requests additional faucet payments

### Requirement: Prompt progression with polling fallback
Notifications and completed SDK operations SHALL promptly trigger a fresh, coalesced observation without waiting for the normal poll interval. Missing or disconnected notification streams SHALL fall back to periodic checks. Failed optional history or display work MUST NOT block a transition whose required fresh evidence is available. Event payloads alone MUST NOT authorize a transfer or establish completion.

#### Scenario: Settlement boundary notification
- **WHEN** a settlement finishes and fresh evidence makes the next action eligible
- **THEN** the next action is scheduled within one second of evidence validation in an active foreground browser, excluding network and signing execution time

#### Scenario: No notifications arrive
- **WHEN** notifications are absent while network reads remain healthy
- **THEN** a five-second fallback observation continues progression without requiring a user refresh

### Requirement: Preserve completion and measure avoidable delay
Step 6 SHALL retain confirmation of the required commitments, the original input spend, exact Bitcoin change, and linked owned spendable target outputs. Earlier spendability SHALL be displayed only as a separate verified milestone. Timing SHALL distinguish total elapsed time, observed external waits, recovery backoff, suspension or unobserved time, and client handoff delays. Reports SHALL include sample counts and incomplete or failed runs, and MUST NOT infer an exact server event time from client observation time.

#### Scenario: Spendable before Bitcoin confirmation
- **WHEN** exact attributable target funds are freshly verified spendable but required Bitcoin confirmation is absent
- **THEN** the app records the spendability milestone while Step 6 remains awaiting confirmation and its total timer continues

#### Scenario: Comparing faster runs
- **WHEN** an implementation timing report compares baseline and updated runs
- **THEN** it compares the same allocation and completion predicate, identifies measured client savings separately from changed external waits, and does not claim the observed duration is guaranteed

### Requirement: Repeatable fault and live acceptance evidence
Automated verification SHALL inject failures, delayed responses, and non-resolving operations at each asynchronous stage, including both sides of durable and external submission boundaries. Acceptance SHALL check recovery to completion where dependencies recover and safe visible pauses otherwise. Live acceptance SHALL record real public commitment evidence and exact amounts separately from synthetic test results.

#### Scenario: Temporary outage in each step
- **WHEN** each retryable boundary fails and subsequently recovers in the test matrix
- **THEN** the original run reaches the existing Step 6 predicate without duplicate intents, changed inputs, leaked resources, or invented success

#### Scenario: Permanent dependency failure
- **WHEN** a required dependency stays unavailable
- **THEN** the spike remains responsive in recovery or an actionable pause, retains durable state, and never reports completion without evidence
