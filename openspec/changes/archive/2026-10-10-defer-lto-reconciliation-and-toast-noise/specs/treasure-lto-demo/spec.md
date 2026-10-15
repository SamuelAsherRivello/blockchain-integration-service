# Spec Delta

## MODIFIED Requirements

### Requirement: Start-triggered session attempt
Starting a game level SHALL create the level-scoped treasure session and 90-second elapsed-time deadline immediately, without a treasure button or offer diagnostics on the start menu. Eligible sessions SHALL initiate background funding from that explicit level-start trigger. Missing player/game readiness or unresolved previous treasure cleanup SHALL skip the offer for the session without stopping play or enabling it later. Application load, Admin component mounting, pauses and tab switches SHALL NOT start a treasure offer or extend the deadline.

#### Scenario: Normal Start
- **WHEN** the player starts a level with ready wallets and no unresolved prior treasure offer
- **THEN** gameplay starts immediately and funding runs in the background against the original level-start deadline
- **AND** unchanged funding-pending state does not produce a startup toast

#### Scenario: Connect after starting
- **WHEN** the player starts without a connected wallet and connects later
- **THEN** that session remains skipped and the next level start may attempt a new offer

#### Scenario: Return to start menu
- **WHEN** the current run returns to the start menu
- **THEN** it ends the prior attempt and records the session outcome without presenting contract diagnostics
- **AND** any required cleanup is targeted to that session and may continue only under an active recovery trigger

#### Scenario: Admin loads without a developer action
- **WHEN** Admin loads or the D contract section mounts without clicking Start LTO
- **THEN** no treasure offer is created, no funding is submitted, and no funding-pending toast is shown

### Requirement: Non-blocking Claim and Reject
Claim and Reject SHALL invoke the corresponding generic BIS operation once. On accepted processing the pending toast MAY appear because it follows an explicit player action; the game SHALL close its dialogue and release only its treasure pause reason, and completion SHALL arrive through a toast without interrupting gameplay. Reject SHALL forfeit this session's prize and request refund without replacing the offer. A failed/uncertain operation SHALL remain inspectable without an automatic resubmission or startup notification.

#### Scenario: Successful claim
- **WHEN** a valid claim is accepted for processing
- **THEN** gameplay resumes after pending feedback and verified receipt later produces a 1,000-sat reward toast without a modal

#### Scenario: Reject
- **WHEN** Reject is accepted
- **THEN** the prompt closes, refund processing continues in BIS, and the chest's later inspection cannot create another offer in that session

#### Scenario: Unchanged pending funding
- **WHEN** the game is reloaded before funding is verified
- **THEN** the game restores the session record silently and does not show `Offer funding pending` merely because the process restarted
- **AND** the chest or explicit contract inspection remains able to present the truthful pending state

### Requirement: Developer LTO controls recover from stale attempts
The D.P.2 Start LTO and Claim LTO controls SHALL bind their countdown and actions to the current concrete offer or skipped session. Start LTO SHALL be the explicit Admin trigger for a demo offer, and mounting or refreshing the Admin application SHALL not invoke it. A Start attempt that cannot create an offer SHALL report the current reason and clear transient controller state when complete. Claim SHALL only act on the current matching contract and SHALL NOT create a replacement offer.

#### Scenario: Start after a previous unavailable attempt
- **WHEN** Start LTO previously reported no offer because readiness or funding was unavailable
- **THEN** a later explicit Start LTO with current ready wallets creates a fresh session attempt rather than replaying the old unavailable result
- **AND** the countdown starts only after the new concrete offer or preparation state belongs to that fresh session

#### Scenario: Claim before and after a concrete offer
- **WHEN** Claim LTO is clicked before any current concrete offer is active
- **THEN** it reports the current ineligible state without submitting a claim or creating an offer
- **WHEN** a later current offer becomes claimable
- **THEN** Claim LTO re-evaluates that offer instead of being blocked by the earlier ineligible click

#### Scenario: Wallet selection changes
- **WHEN** the Game Wallet selection or active network changes while a developer session is visible
- **THEN** the old session is treated as no-offer for controls and countdown
- **AND** the next Start LTO must create a fresh session bound to the new active wallet state
