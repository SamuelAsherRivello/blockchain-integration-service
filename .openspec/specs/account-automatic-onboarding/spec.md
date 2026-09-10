# account-automatic-onboarding Specification

## Purpose

Automatically prepare a funded player's account for spending through attributable, recoverable Bitcoin-to-Arkade onboarding, with clear account-specific progress and no unnecessary confirmation waits.

## Requirements

### Requirement: Account activation begins one-time onboarding
BIS SHALL begin onboarding assessment when a player account becomes active, without requiring a visit to Balance or an onboarding button click. It SHALL reconcile existing scoped work before selecting new funds. Completed setup SHALL NOT automatically repeat after spending, later deposits or ordinary reload. An account without an onboarding record whose fresh unreserved Arkade funds are already spendable SHALL be identified as already ready without inventing transfer history. Unresolved known operations SHALL retain their evidence and reservations.

#### Scenario: Funded login without opening Balance
- **WHEN** a player activates an account with eligible funding and no completed or unresolved onboarding
- **THEN** onboarding starts automatically without opening an account page or clicking a transfer button

#### Scenario: Already ready account
- **WHEN** fresh evidence establishes existing unreserved spendable Arkade funds and no unresolved onboarding operation exists
- **THEN** onboarding is recorded as already ready and no automatic transfer is submitted

#### Scenario: Later deposit after completion
- **WHEN** a completed account receives another Bitcoin deposit or spends its Arkade balance
- **THEN** setup remains complete and the new deposit is not automatically halved or reboarded

### Requirement: Verified funding and frozen 50 percent allocation
Automatic onboarding SHALL wait for confirmed, eligible, unexpired and unreserved Bitcoin funding belonging to the active account. At starting, it SHALL freeze selected input outpoints, their total T, Arkade target floor(T / 2), and Bitcoin return T minus the target. It SHALL validate zero fees, conservation, dust, expiry and operator limits for both legs before submission and revalidate applicable terms before each leg. Later deposits SHALL NOT change a started plan. Invalid or unsupported terms SHALL pause with a specific reason without changing the allocation or consuming unrelated funds.

#### Scenario: Odd number of sats
- **WHEN** eligible frozen inputs total 12,001 sats and both legs satisfy current zero-fee limits
- **THEN** the intended final Arkade target is 6,000 sats and the Bitcoin return is 6,001 sats

#### Scenario: One of two deposits confirmed
- **WHEN** two deposits exist but only one is confirmed and independently sufficient for a valid route
- **THEN** the valid confirmed input can start onboarding and the other deposit remains individually unconfirmed and excluded

#### Scenario: Funds too small or fees change
- **WHEN** available funds cannot satisfy both output minima or the operator introduces unsupported fees
- **THEN** onboarding explains the funding or policy blocker, does not submit an invalid leg, and retains any already-submitted leg for reconciliation

#### Scenario: Selection and submission use the same funding plan
- **WHEN** a complete assessment finds several confirmed eligible unreserved boarding inputs
- **THEN** the 50% plan includes that complete eligible set and does not silently shrink it to satisfy operator limits
- **AND** the exact set and applicable terms are revalidated before the submission boundary

#### Scenario: Funding changes before submission
- **WHEN** a selected input becomes ineligible while registration is provably impossible
- **THEN** the unsent draft is retired and fresh assessment proceeds automatically without retaining a permanent stale-input hold
- **AND** the same observation after submission may have occurred instead preserves the original plan and triggers reconciliation without replay

### Requirement: Attributable two-settlement route
BIS SHALL represent onboarding as one durable parent with separately attributable boarding and Bitcoin-return legs. The first leg SHALL board the full frozen total without Bitcoin outputs. The second SHALL use only verified owned first-leg receipts to return the frozen remainder to the same account and retain the target in owned Arkade outputs. Each leg SHALL retain its own inputs, intended outputs, registration boundary, known public identifiers, progress and outcome. Unrelated deposits, Arkade funds and assets SHALL NOT fund this route. Returned Bitcoin SHALL NOT start another onboarding.

#### Scenario: Successful 50 percent route
- **WHEN** 12,000 sats are frozen for onboarding under supported zero fees
- **THEN** the first leg boards 12,000 sats and the second returns 6,000 sats to Bitcoin while leaving 6,000 sats in owned Arkade outputs
- **AND** the two legs retain distinct evidence linked to the same parent

#### Scenario: New funds arrive between legs
- **WHEN** unrelated Bitcoin or Arkade funds arrive after the first leg
- **THEN** the return leg uses only the parent's verified receipts and its amounts remain unchanged

### Requirement: Complete as soon as final target funds are usable
Onboarding SHALL complete when evidence proves the exact final Bitcoin return and owned Arkade target, the final target is freshly verified spendable, and onboarding reservations are durably released from those final outputs. Neither Bitcoin commitment's block confirmation SHALL be an additional completion or spending gate. The first leg's temporary full-total receipt, registration alone, unrelated funds, or an aggregate balance SHALL NOT establish completion. Bitcoin confirmation tracking SHALL continue independently. Durable completion SHALL remain a historical fact after subsequent spending; it SHALL NOT be reused as a current balance.

#### Scenario: Final funds spendable before a block
- **WHEN** the exact final receipts are verified and the target is spendable while the return transaction is unconfirmed
- **THEN** onboarding becomes Complete, the final target is available to normal spending paths without an onboarding wait, and that transaction still displays Unconfirmed

#### Scenario: Temporary full boarding balance
- **WHEN** the first leg's entire frozen total is spendable but the required return is not verified
- **THEN** onboarding remains Pending and those intermediate receipts remain protected for the return

#### Scenario: Final receipt verification unavailable
- **WHEN** a commitment exists but final ownership, amounts or spendability cannot be verified
- **THEN** onboarding remains Pending with unavailable verification and never substitutes another account balance as proof

#### Scenario: Completion is saved but presentation fails
- **WHEN** final completion and output release are durable but the page fails before displaying them
- **THEN** reload reconstructs the same completed operation and release without repeating settlement or counting another completion sample

#### Scenario: Completed setup with later unavailable funds
- **WHEN** onboarding previously completed but a later payment cannot verify current eligibility
- **THEN** that payment is blocked with the actual eligibility reason while historical setup remains complete and no new automatic onboarding begins

### Requirement: Safe automatic recovery with durable boundaries
BIS SHALL persist each attempt before registration can occur and preserve uncertain outcomes across ordinary restart. It SHALL automatically retry bounded observation work and continue a leg proven never submitted under exclusive operation ownership. A rejected attempt SHALL permit automatic replacement only with authoritative evidence excluding later settlement and after the retryable cause is resolved. Timeouts, missing responses/history, unspent inputs and local cancellation labels SHALL NOT authorize replay or release. Signing continuation SHALL require a proven exact-operation path; observation restart alone SHALL NOT imply signing restarted. Unsupported recovery SHALL retain reservations and explain the actual blocker.

#### Scenario: Restart between settlements
- **WHEN** the boarding receipt and reservation handoff are durable and the return leg is proven never submitted
- **THEN** account activation resumes only the return leg automatically under the original frozen plan

#### Scenario: Registration response lost
- **WHEN** registration may have reached the operator but its response was lost
- **THEN** automatic checks reconcile that attempt without another registration or conflicting spend

#### Scenario: Storage or exclusivity unavailable
- **WHEN** the system cannot durably save the submission boundary or establish exclusive ownership
- **THEN** no network mutation begins and the details explain the blocker

#### Scenario: Callback error then successful poll
- **WHEN** signing or provider callbacks fail and a later status read succeeds
- **THEN** safe failure provenance remains attached to the attempt and the poll does not falsely report resumed signing or completion

#### Scenario: Reload during signing
- **WHEN** the document reloads after participation acknowledgement and before final receipt verification
- **THEN** the same account and frozen operation are reconciled automatically, and a supported recovery path proceeds only after prior ownership and cleanup are resolved
- **AND** recovery requires no account reset, extra funding or recovery click when its safety preconditions are satisfied, and cannot blindly repeat an ambiguous registration

### Requirement: Only attributable batch activity controls execution
Only selection of the current intent or activity attributable to its selected batch SHALL advance its settlement progress or renew its progress deadline. Failure of another batch, including an earlier attempt sharing input topics, SHALL NOT fail the current operation. Genuine selected-batch failures SHALL remain observable and enter safe recovery. Unrelated traffic SHALL NOT indefinitely postpone a recovery timeout; both initial selection waits and subsequent progress waits SHALL remain bounded.

#### Scenario: Earlier batch fails while this intent is queued
- **WHEN** the stream reports a failed batch that did not select the current intent
- **THEN** the current intent continues waiting without discarding registration or scheduling a replacement because of that unrelated failure

#### Scenario: Continuous unrelated traffic
- **WHEN** unrelated batch events continue while the current intent makes no attributable progress
- **THEN** they do not renew its deadline and the bounded timeout still initiates safe cleanup and reconciliation

#### Scenario: Matching progress after early stream startup
- **WHEN** observation began before registration returned and the stream later selects the current intent and reports its signing progress
- **THEN** those matching events renew its deadline, subsequent unrelated events do not, and a failure of its selected batch still reaches recovery

#### Scenario: Duplicate matching events cannot prolong a stall
- **WHEN** the selected batch repeatedly emits previously observed selection or signing events without new attributable progress
- **THEN** duplicate events do not renew the progress deadline or regress the known stage
- **AND** an absolute bounded attempt deadline still applies even when new matching events continue, with timeout leading to cleanup and reconciliation rather than inferred financial failure

### Requirement: Recovery waits for actual cleanup and durable checkpoints
A timed-out worker SHALL stop its actual event source and resolve prior signer/connection ownership before replacement execution. Pending cleanup SHALL retain protection without freezing status inspection. A network wait or checkpoint save SHALL NOT deadlock recovery through nested non-reentrant locks. Timed-out persistence SHALL remain quarantined until the underlying write terminates; no failed or uncertain write SHALL be presented as durable success. Transport deadlines SHALL cover response bodies and caller cancellation, and retry scheduling SHALL honor provider cooldown floors.

#### Scenario: Stream abort precedes slow cleanup
- **WHEN** a progress deadline expires and SDK cleanup is still pending
- **THEN** the event source is aborted, details remain inspectable, and replacement execution waits for cleanup rather than overlapping signing or wallet connections

#### Scenario: Checkpoint inside recovery
- **WHEN** recovery saves a checkpoint while other operations are queued for the same mutation lock
- **THEN** the checkpoint completes without reacquiring its own held non-reentrant lock and network waits do not monopolize the checkpoint lock

#### Scenario: Write outlives its deadline
- **WHEN** a storage timeout occurs before the underlying write transaction ends
- **THEN** the guard remains active until termination and a late write cannot authorize a competing submission or overwrite a replacement account

### Requirement: Account-specific progress and funding details
The details page SHALL show Account ready, Fund account, Confirm incoming funds, Move funds to Arkade and Spendable funds ready, identifying funding as USER work and the other stages as CPU work. It SHALL open with all five stage disclosures closed. Each closed summary SHALL be a single vertically aligned row containing a disclosure affordance, the step and owner, the stage title, and a right-aligned status. The page SHALL display the exact introductory text: "You must fund the account per step 2. Otherwise sit back and wait for completion." Funding SHALL provide the current boarding address, Copy, a Signet faucet search, and an explanation of automatic 50% onboarding when its disclosure is opened. It SHALL not require a fauceted acknowledgement. Transfer progress SHALL appear as a local operation immediately, with no fabricated network transaction. Known incoming and settlement transactions SHALL each display their own Unconfirmed, Confirmed or unavailable verification evidence and correct public explorer link when the associated disclosure is opened. Account replacement SHALL immediately remove old data and ignore obsolete callbacks.

The completed prefix SHALL be green, the single current stage SHALL be yellow and labeled Pending, and every later stage SHALL be grey and labeled Unstarted. Account ready SHALL be complete while this page is shown. Fund account SHALL complete after an incoming transaction is observed or a durable onboarding plan exists. Confirm incoming funds SHALL complete after a durable onboarding plan exists. Move funds to Arkade SHALL complete after the returning leg's receipt is verified. Spendable funds ready SHALL complete only when onboarding is complete. The first incomplete stage SHALL be the only Pending stage; when onboarding is complete, all five stages SHALL be Complete. The onboarding body SHALL not render timing, recovery, countdown, or other content after the fifth stage. The existing outer Back control remains available.

#### Scenario: Initial funding presentation
- **WHEN** onboarding has no incoming transaction, plan, or completion record
- **THEN** Account ready is green and Complete, Fund account is yellow and Pending, and stages 3 through 5 are grey and Unstarted in closed single-line rows

#### Scenario: Confirming detected funding
- **WHEN** onboarding has an observed incoming transaction but no durable plan
- **THEN** stages 1 and 2 are green and Complete, Confirm incoming funds is yellow and Pending, and stages 4 and 5 are grey and Unstarted

#### Scenario: Settlement is in progress
- **WHEN** onboarding has a durable plan and the returning receipt is not verified
- **THEN** stages 1 through 3 are green and Complete, Move funds to Arkade is yellow and Pending, and Spendable funds ready is grey and Unstarted

#### Scenario: Final spendability is pending
- **WHEN** the returning receipt is verified but onboarding is not yet complete
- **THEN** stages 1 through 4 are green and Complete and Spendable funds ready is yellow and Pending

#### Scenario: Completed onboarding presentation
- **WHEN** onboarding is complete, including an already-ready account
- **THEN** all five stages are green and Complete and no stage is Pending

#### Scenario: Compact presentation excludes diagnostics
- **WHEN** the onboarding details page is rendered
- **THEN** its body contains neither a last-verified or next-check countdown nor a timing or recovery disclosure, and no content appears after the fifth stage before the existing outer Back control

#### Scenario: Two incoming transactions differ
- **WHEN** the account has one confirmed and one unconfirmed incoming transaction
- **THEN** each card in the opened confirmation stage shows its own status and neither inherits the other's confirmation

#### Scenario: Submitted operation has no transaction ID yet
- **WHEN** a durable attempt has begun but no network transaction is known
- **THEN** the opened details show its actual preparation or registration stage and next expected event without an invented transaction link

#### Scenario: Account changes during a read
- **WHEN** an old account's status response arrives after a replacement account becomes active
- **THEN** it cannot populate the new account's details, balances, progress or completion

### Requirement: Reassuring and truthful live observation
Onboarding SHALL update automatically while the account is active, with a normal healthy check interval of approximately five seconds, bounded calls and backoff after failures. It SHALL distinguish unavailable checks from known transaction evidence internally and preserve the durable automatic-recovery behavior required by this capability. The compact onboarding presentation SHALL not render last-verified timestamps, next-check countdowns, operation durations, historical timing averages, or recovery measurements. Removing those presentation details SHALL NOT alter automatic observation, safe recovery, settlement, reservation, or completion behavior.

#### Scenario: Automatic observation remains active without a countdown
- **WHEN** a background check is delayed by backoff or a provider cooldown
- **THEN** the scheduled check still runs at its actual eligible time without rendering a countdown in the onboarding details

#### Scenario: Connection restored
- **WHEN** failed observation reconnects successfully
- **THEN** automatic status checks resume without claiming a financial submission was repeated

#### Scenario: Timing began after transaction creation
- **WHEN** a completed measurement started after its stage was already underway
- **THEN** the compact onboarding presentation does not render that partial measurement or a completed-duration average

#### Scenario: Recovery-inclusive timing and external waits
- **WHEN** a completed cohort includes a development reload or recovery delays
- **THEN** the compact onboarding presentation does not render its duration, interruption marker, sample count, or timing comparison
- **AND** automatic observation and completion remain independent of Bitcoin confirmation as required by this capability

#### Scenario: Automatic recovery countdown
- **WHEN** a background check is delayed by backoff or a provider cooldown
- **THEN** its actual scheduled check remains internal to automatic observation and is not rendered as a countdown in the onboarding details

#### Scenario: No remaining observation work
- **WHEN** setup is complete and all required confirmation tracking has finished
- **THEN** onboarding stops its periodic checks without changing other account subscriptions or payment eligibility rules

### Requirement: Delivery requires fresh BIS evidence
Delivery SHALL include regression verification of allocation, both legs, callback failures, account changes, exclusive ownership, restart boundaries and final reservation release. A fresh real BIS Signet run SHALL establish exact final receipts and usable target funds through automatic execution without manual transfer initiation. A successful normal spend SHALL verify usability; simulation, registration, spike evidence or tests alone SHALL NOT close live acceptance. Before-block completion SHALL additionally have deterministic regression coverage, and live before-block evidence SHALL be recorded when observed rather than fabricated.

#### Scenario: Successful automatic onboarding acceptance
- **WHEN** this change is reported implemented and verified
- **THEN** evidence includes the BIS account's frozen amounts, both public settlement identifiers, verified final target and Bitcoin return, and a successful normal spend without an onboarding confirmation wait

#### Scenario: Stable cohort and controlled recovery validation
- **WHEN** live BIS acceptance is collected
- **THEN** ordinary runs use a stable served build and reload-during-signing recovery is exercised in a separately labeled case with original inputs and exact final receipts
- **AND** existing spike successes and its recorded 89 passing tests do not mark BIS implementation or live acceptance complete
