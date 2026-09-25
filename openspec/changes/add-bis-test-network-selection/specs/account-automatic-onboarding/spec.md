## MODIFIED Requirements

### Requirement: Account-specific progress and funding details
The details page SHALL show Account ready, Fund account, Confirm incoming funds, Move funds to Arkade and Spendable funds ready, identifying funding as USER work and the other stages as CPU work. It SHALL open with all five stage disclosures closed. Each closed summary SHALL be a single vertically aligned row containing a disclosure affordance, the step and owner, the stage title, and a right-aligned status. The page SHALL display the exact introductory text: "You must fund the account per step 2. Otherwise sit back and wait for completion." Funding SHALL provide the current selected-network boarding address, Copy, a faucet/search link appropriate to that selected test network, and an explanation of automatic 50% onboarding when its disclosure is opened. For Mutinynet, it SHALL also provide a copyable user-run `mutinynet-cli onchain <current Bitcoin boarding address> [sats]` command, explain that `mutinynet-cli login` completes GitHub device authentication before funding, and retain https://faucet.mutinynet.com/ as the live manual fallback. For Signet, it SHALL provide a copyable user-run Bitcoin Core `contrib/signet/getcoins.py --addr <current Bitcoin boarding address>` command, explain that the helper requires its interactive terminal CAPTCHA, and retain https://signetfaucet.com/ as the live manual fallback. BIS SHALL neither execute either CLI nor receive, persist, or expose a Mutinynet token. It SHALL not require a fauceted acknowledgement or automatically request funds. Transfer progress SHALL appear as a local operation immediately, with no fabricated network transaction. Known incoming and settlement transactions SHALL each display their own Unconfirmed, Confirmed, or unavailable verification evidence and correct selected-network public explorer link when the associated disclosure is opened. Account or network replacement SHALL immediately remove old data and ignore obsolete callbacks.

#### Scenario: Mutinynet CLI funding guidance
- **WHEN** a player with a selected Mutinynet account opens Fund account
- **THEN** BIS shows a copyable command containing that account's current Bitcoin boarding address and explains the required user-owned GitHub device login
- **AND** it offers https://faucet.mutinynet.com/ as a manual fallback without initiating any faucet request

#### Scenario: Signet CLI funding guidance
- **WHEN** a player with a selected Signet account opens Fund account
- **THEN** BIS shows a copyable Bitcoin Core `getcoins.py` command containing that account's current Bitcoin boarding address and explains the required terminal CAPTCHA
- **AND** it offers https://signetfaucet.com/ as a manual fallback without initiating any faucet request

#### Scenario: Network switch during onboarding
- **WHEN** a player switches from Signet to Mutinynet while Signet onboarding is being observed
- **THEN** the Signet progress and callbacks are removed from the active presentation
- **AND** no Signet settlement is represented as Mutinynet readiness

#### Scenario: Initial funding presentation
- **WHEN** selected-network onboarding has no incoming transaction, plan, or completion record
- **THEN** Account ready is green and Complete, Fund account is yellow and Pending, and stages 3 through 5 are grey and Unstarted in closed single-line rows

#### Scenario: Confirming detected funding
- **WHEN** onboarding has an observed selected-network incoming transaction but no durable plan
- **THEN** stages 1 and 2 are green and Complete, Confirm incoming funds is yellow and Pending, and stages 4 and 5 are grey and Unstarted

#### Scenario: Settlement is in progress
- **WHEN** onboarding has a durable selected-network plan and the returning receipt is not verified
- **THEN** stages 1 through 3 are green and Complete, Move funds to Arkade is yellow and Pending, and Spendable funds ready is grey and Unstarted

#### Scenario: Final spendability is pending
- **WHEN** the selected-network returning receipt is verified but onboarding is not yet complete
- **THEN** stages 1 through 4 are green and Complete and Spendable funds ready is yellow and Pending

#### Scenario: Completed onboarding presentation
- **WHEN** selected-network onboarding is complete, including an already-ready account
- **THEN** all five stages are green and Complete and no stage is Pending

#### Scenario: Compact presentation excludes diagnostics
- **WHEN** the onboarding details page is rendered
- **THEN** its body contains neither a last-verified or next-check countdown nor a timing or recovery disclosure
- **AND** no content appears after the fifth stage before the existing outer Back control

#### Scenario: Two incoming transactions differ
- **WHEN** the account has one confirmed and one unconfirmed incoming transaction on the selected network
- **THEN** each card in the opened confirmation stage shows its own status and neither inherits the other's confirmation

#### Scenario: Submitted operation has no transaction ID yet
- **WHEN** a durable attempt has begun but no selected-network transaction is known
- **THEN** the opened details show its actual preparation or registration stage and next expected event without an invented transaction link

#### Scenario: Account changes during a read
- **WHEN** an old account or network status response arrives after a replacement account or network becomes active
- **THEN** it cannot populate the new account's details, balances, progress, or completion

### Requirement: Delivery requires fresh BIS evidence
Delivery SHALL include regression verification of allocation, both legs, callback failures, account changes, network changes, exclusive ownership, restart boundaries, and final reservation release. A fresh real BIS run on each supported selected test network SHALL establish exact final receipts and usable target funds through automatic execution without manual transfer initiation. A successful normal spend SHALL verify usability; simulation, registration, spike evidence, or tests alone SHALL NOT close live acceptance. Before-block completion SHALL additionally have deterministic regression coverage, and live before-block evidence SHALL be recorded when observed rather than fabricated.

#### Scenario: Network-specific acceptance
- **WHEN** onboarding implementation is reported verified for either supported network
- **THEN** the evidence names the selected network and its exact public settlement identifiers
- **AND** evidence from the other network does not satisfy that network's acceptance

#### Scenario: Successful automatic onboarding acceptance
- **WHEN** this change is reported implemented and verified
- **THEN** evidence includes the selected BIS account's frozen amounts, both public settlement identifiers, verified final target and Bitcoin return, and a successful normal spend without an onboarding confirmation wait

#### Scenario: Stable cohort and controlled recovery validation
- **WHEN** live BIS acceptance is collected
- **THEN** ordinary runs use a stable served build and reload-during-signing recovery is exercised in a separately labeled case with original inputs and exact final receipts
- **AND** existing spike successes do not mark BIS implementation or live acceptance complete
