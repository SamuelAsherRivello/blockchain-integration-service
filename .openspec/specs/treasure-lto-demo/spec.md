# treasure-lto-demo Specification

## Purpose

Demonstrate generic BIS limited-time contracts through a game-owned treasure chest with uninterrupted gameplay and clear claim, reject and expiry interactions.

## Requirements

### Requirement: Start-triggered session attempt
Clicking the existing Start control SHALL begin gameplay and a 90-second elapsed-time deadline immediately, without a treasure button, offer information or debugging information on the start menu. Eligible sessions SHALL initiate background funding. Missing player/game readiness or unresolved previous treasure cleanup SHALL skip the offer for the session without stopping play or enabling it later. Pauses, tab switches and funding delays SHALL NOT extend the deadline.

#### Scenario: Normal Start
- **WHEN** the player starts with ready wallets and no unresolved prior treasure offer
- **THEN** gameplay starts immediately and funding/toasts run in the background against the original Start-time deadline

#### Scenario: Connect after starting
- **WHEN** the player starts without a connected wallet and connects later
- **THEN** that session remains skipped and the next Start may attempt a new offer

#### Scenario: Return to start menu
- **WHEN** the current run returns to the start menu
- **THEN** it ends the prior attempt and silently checks/reconciles relevant contracts and requests eligible cleanup, without displaying contract diagnostics

### Requirement: Game-owned chest and contract matching
The host SHALL own Tiled-authored chest placement/spawning, collision, treasure dialogue and pause/focus behavior. The chest SHALL exist and be collidable independently of funding/backend/expiry state. On collision the game SHALL open its dialogue and query generic BIS contracts, selecting only its current session's exact contract reference. BIS SHALL NOT implement a TreasureLTO class or chest-specific UI.

#### Scenario: Other contract types
- **WHEN** the account also contains a non-LTO or unrelated LTO
- **THEN** chest interaction ignores those contracts and does not claim/cancel them

#### Scenario: Persistent overlap
- **WHEN** the player closes the dialogue while still overlapping the chest
- **THEN** it does not immediately reopen; a new collision after leaving/re-entering permits inspection

### Requirement: Preparation and active treasure dialogue
The game dialogue SHALL be titled `Treasure Chest`. A matching claimable offer SHALL show `You found a treasure of 1000 sats` with Claim and Reject. Known preparation SHALL show `Treasure is being prepared`, disabled Claim/Reject and Back. An open dialogue SHALL update when contract or deadline state changes. Query failure SHALL remain distinguishable from no offer; every non-actionable state SHALL provide Back.

#### Scenario: Reach before funding completes
- **WHEN** a player opens the chest during known funding
- **THEN** the preparation state permits Back and updates to claimable if funding completes before expiry

#### Scenario: No player for this session
- **WHEN** the session skipped funding because no player was connected at Start
- **THEN** the chest explains that an account is needed for treasure offers and offers Back

#### Scenario: Skipped offer or unavailable read
- **WHEN** another prerequisite prevented the offer or a contract read fails
- **THEN** the game shows respectively a no-offer or unavailable state with no enabled Claim/Reject and keeps detailed contract diagnostics in BIS

### Requirement: Click-time eligibility and expired inspection
Collision SHALL NOT reserve claim eligibility. At or after the 90-second deadline, the game SHALL show `You found a treasure but it's expired`, disable Claim and Reject, and show Back, including when the deadline passes with the prompt open. The expired chest SHALL remain inspectable after financial cleanup.

#### Scenario: Open before expiry and wait
- **WHEN** the player collides before the deadline but waits until expiry to click
- **THEN** the dialogue transitions to expired and no new claim is requested

#### Scenario: Backend refund completed
- **WHEN** an expired offer has been refunded and the player later reaches its chest
- **THEN** the game retains its session outcome and shows the expired prompt even though BIS omits the resolved contract from the active list

### Requirement: Non-blocking Claim and Reject
Claim and Reject SHALL invoke the corresponding generic BIS operation once. On accepted processing the pending toast SHALL appear, the game SHALL close its dialogue and release only its treasure pause reason, and completion SHALL arrive through a toast without interrupting gameplay. Reject SHALL forfeit this session's prize and request refund without replacing the offer. A failed/uncertain operation SHALL remain inspectable without an automatic resubmission.

#### Scenario: Successful claim
- **WHEN** a valid claim is accepted for processing
- **THEN** gameplay resumes after pending feedback and verified receipt later produces a 1,000-sat reward toast without a modal

#### Scenario: Reject
- **WHEN** Reject is accepted
- **THEN** the prompt closes, refund processing continues in BIS, and the chest's later inspection cannot create another offer in that session

### Requirement: Demonstration and consumer parity
The BIS G1/G2 demo SHALL exercise production public APIs and may simulate host gameplay events only. Stealth & Steel SHALL consume the built BIS public package and integrate the same lifecycle through its game-owned session and chest UI. Financial live acceptance and browser-visible consumer delivery SHALL be reported separately and neither SHALL be inferred solely from unit fixtures.

#### Scenario: Package delivery
- **WHEN** the new BIS package is installed into Stealth & Steel
- **THEN** browser verification checks the actual loaded version, hosted game-wallet readiness, visible chest flow and independent gameplay during asynchronous operations

#### Scenario: Shared wallet in local and deployed games
- **WHEN** the owner has imported the game wallet through Admin and opens either game build
- **THEN** the game automatically uses the configured hosted wallet service, contains no game-wallet import UI or game signing secret, and reports service unavailability without blocking ordinary play

### Requirement: Developer demo controls
The BIS G2 demonstration SHALL provide always-clickable Start LTO and Claim LTO buttons with a 90-second countdown on the same compact horizontal story row used by the other demonstrations. Each click SHALL immediately update the console, followed by its outcome and asynchronous status changes. These controls SHALL use the same contract guards as the game and SHALL remain separate from the game's Start menu and collision dialogue.

#### Scenario: Claim before an offer is ready
- **WHEN** the developer clicks Claim LTO before Start or while funding is pending
- **THEN** the console reports the current eligibility without creating a duplicate operation or fabricating success
