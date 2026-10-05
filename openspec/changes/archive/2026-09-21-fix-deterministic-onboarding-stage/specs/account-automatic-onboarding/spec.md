## MODIFIED Requirements

### Requirement: Account-specific progress and funding details
The details page SHALL show Account ready, Fund account, Confirm incoming funds, Move funds to Arkade and Spendable funds ready, identifying funding as USER work and the other stages as CPU work. It SHALL open with all five stage disclosures closed. Each closed summary SHALL be a single vertically aligned row containing a disclosure affordance, the step and owner, the stage title, and a right-aligned status. The page SHALL display the exact introductory text: "You must fund the account per step 2. Otherwise sit back and wait for completion." Funding SHALL provide the current boarding address, Copy, a Signet faucet search, and an explanation of automatic 50% onboarding when its disclosure is opened. It SHALL not require a fauceted acknowledgement. Transfer progress SHALL appear as a local operation immediately, with no fabricated network transaction. Known incoming and settlement transactions SHALL each display their own Unconfirmed, Confirmed or unavailable verification evidence and correct public explorer link when the associated disclosure is opened. Account replacement SHALL immediately remove old data and ignore obsolete callbacks.

The completed prefix SHALL be green, the single current stage SHALL be yellow and labeled Pending, and every later stage SHALL be grey and labeled Unstarted. Account ready SHALL be complete while this page is shown. The stage projection SHALL use the strongest current active-account evidence in this order: a fresh positive Arkade balance or completed/ready onboarding state completes stage 5; a verified return receipt completes stage 4; a durable onboarding plan completes stage 3; and observed incoming Bitcoin or a positive Bitcoin balance completes stage 2. A positive total alone SHALL not advance a stage. A positive Arkade balance SHALL complete all five presentation stages even when a durable onboarding record has not yet been written; this presentation outcome SHALL NOT fabricate transfer history, release reservations, submit a transfer, or change an unresolved operation's recovery rules. When fresh balance evidence is unavailable, the page SHALL use only verified onboarding and transaction evidence and SHALL NOT reuse a prior account's balance. The first incomplete stage SHALL be the only Pending stage; when stage 5 is complete, all five stages SHALL be Complete. The onboarding body SHALL not render timing, recovery, countdown, or other content after the fifth stage. The existing outer Back control remains available.

#### Scenario: Initial funding presentation
- **WHEN** onboarding has no incoming transaction, plan, completion record, or positive fresh Bitcoin or Arkade balance
- **THEN** Account ready is green and Complete, Fund account is yellow and Pending, and stages 3 through 5 are grey and Unstarted in closed single-line rows

#### Scenario: Confirming detected funding
- **WHEN** onboarding has an observed incoming transaction or positive Bitcoin balance but no durable plan or positive Arkade balance
- **THEN** stages 1 and 2 are green and Complete, Confirm incoming funds is yellow and Pending, and stages 4 and 5 are grey and Unstarted

#### Scenario: Settlement is in progress
- **WHEN** onboarding has a durable plan, no positive Arkade balance, and the returning receipt is not verified
- **THEN** stages 1 through 3 are green and Complete, Move funds to Arkade is yellow and Pending, and Spendable funds ready is grey and Unstarted

#### Scenario: Final spendability is pending
- **WHEN** the returning receipt is verified, onboarding is not yet complete, and no positive Arkade balance is available
- **THEN** stages 1 through 4 are green and Complete and Spendable funds ready is yellow and Pending

#### Scenario: Existing Arkade balance presentation
- **WHEN** a fresh balance for the active account reports a positive Arkade amount and Onboarding is opened from Account Details or Admin E3
- **THEN** all five stages are green and Complete, no stage is Pending, and the page does not ask the player to fund the account
- **AND** any separate unresolved operation remains protected and recoverable without a new submission or reservation release

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
