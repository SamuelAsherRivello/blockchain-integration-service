## MODIFIED Requirements

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
