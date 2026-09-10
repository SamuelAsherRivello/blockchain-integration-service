## MODIFIED Requirements

### Requirement: Start-triggered session attempt
Clicking the existing Start control SHALL begin gameplay and a 90-second elapsed-time deadline immediately, without a treasure button, offer information or debugging information on the start menu. Eligible sessions SHALL initiate background funding. Missing player readiness, missing selected game wallet, or unresolved previous treasure cleanup SHALL silently skip the offer for the session without stopping play or enabling it later. Pauses, tab switches and funding delays SHALL NOT extend the deadline.

#### Scenario: Normal Start
- **WHEN** the player starts with ready wallets and no unresolved prior treasure offer
- **THEN** gameplay starts immediately and funding/toasts run in the background against the original Start-time deadline

#### Scenario: Connect after starting
- **WHEN** the player starts without a connected wallet and connects later
- **THEN** that session remains skipped and the next Start may attempt a new offer

#### Scenario: Game wallet missing at Start
- **WHEN** the player starts with no selected game wallet
- **THEN** gameplay starts normally and that session silently has no treasure offer

#### Scenario: Return to start menu
- **WHEN** the current run returns to the start menu
- **THEN** it ends the prior attempt and silently checks/reconciles relevant contracts and requests eligible cleanup, without displaying contract diagnostics

### Requirement: Demonstration and consumer parity
The BIS G1/G2 demo SHALL exercise production public APIs and may simulate host gameplay events only. Stealth & Steel SHALL consume the built BIS public package and integrate the same lifecycle through its game-owned session and chest UI. Both Runtime Preview and the consumer game SHALL use the locally selected F1/F2 game wallet directly through Arkade, without a BIS wallet-service endpoint or an Admin tab. Financial live acceptance and browser-visible consumer delivery SHALL be reported separately and neither SHALL be inferred solely from unit fixtures.

#### Scenario: Package delivery
- **WHEN** the new BIS package is installed into Stealth & Steel
- **THEN** browser verification checks the actual loaded version, F2 game-wallet setup, visible chest flow, runtime toasts, and independent gameplay during asynchronous operations

#### Scenario: Standalone game configuration
- **WHEN** a player opens a game build on an origin that has no Admin surface
- **THEN** F2 is the available game-wallet setup route and an eligible fresh run uses its selected local wallet without a BIS wallet service

#### Scenario: Shared wallet in local and deployed games
- **WHEN** a user configures a game wallet through F1 or F2 in a local or deployed game origin
- **THEN** that origin's game uses the selected local wallet directly, contains no hosted wallet-service dependency, and reports direct Arkade unavailability without blocking ordinary play

## ADDED Requirements

### Requirement: Game-wallet change creates a fresh treasure presentation
When F1/F2 changes or deselects the game wallet, the game SHALL let an already-running session finish without changing its signer. The next Start SHALL use a fresh treasure session and SHALL not show the former wallet's G2 offer, countdown state, claim/refund action, or history. The chest remains present and collidable independently of that reset.

#### Scenario: Change during a run
- **WHEN** the selected game wallet changes while a treasure run is active
- **THEN** the current run does not switch signer and the next Start presents a clean no-history G2 state
