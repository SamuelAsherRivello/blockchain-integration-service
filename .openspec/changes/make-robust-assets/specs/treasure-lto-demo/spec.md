# Spec Delta

## ADDED Requirements

### Requirement: Developer LTO controls recover from stale attempts
The G2 Start LTO and Claim LTO controls SHALL bind their countdown and actions to the current concrete offer or skipped session. A Start attempt that cannot create an offer SHALL report the current reason and clear transient controller state when complete. It SHALL NOT leave the story row permanently stuck at unavailable when the next explicit Start represents a new session. Claim SHALL only act on the current matching contract and SHALL NOT create a replacement offer.

#### Scenario: Start after a previous unavailable attempt
- **WHEN** Start LTO previously reported no offer because readiness or funding was unavailable
- **THEN** a later Start LTO with current ready wallets creates a fresh session attempt rather than replaying the old unavailable result
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
