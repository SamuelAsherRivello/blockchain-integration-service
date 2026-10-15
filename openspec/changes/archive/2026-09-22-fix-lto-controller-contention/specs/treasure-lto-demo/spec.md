# Spec Delta

## MODIFIED Requirements

### Requirement: Developer demo controls
The BIS G2 demonstration SHALL provide always-clickable Start LTO and Claim LTO buttons with a 90-second countdown on the same compact horizontal story row used by the other demonstrations. Each click SHALL immediately update the console, followed by its outcome and asynchronous status changes. These controls SHALL use the same contract guards as the game and SHALL remain separate from the game's Start menu and collision dialogue. When multiple G2 surfaces or cooperating controller instances share the same underlying player, game wallet and exclusivity key, Start LTO SHALL surface either the single winning session's status or a truthful skipped/no-offer state for the losing session; it SHALL NOT let a losing controller adopt another session's contract or create a duplicate claim path.

#### Scenario: Claim before an offer is ready
- **WHEN** the developer clicks Claim LTO before Start or while funding is pending
- **THEN** the console reports the current eligibility without creating a duplicate operation or fabricating success

#### Scenario: Cooperating demo starts
- **WHEN** two G2 demo surfaces start different LTO sessions against the same player, game wallet and exclusivity key at the same time
- **THEN** at most one surface reaches a funded or claimable offer
- **AND** the other surface reports no offer or unavailable status for its own session without claiming the winning surface's contract
