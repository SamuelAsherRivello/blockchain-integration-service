Blockchain Gaming Services (BGS)
Codex Project Brief
A reusable, Signet-only BTC Lightning integration layer for browser games, developed independently from the game itself and consumed through a minimal game-facing API.


1. Project Goal
Build a separate repository named Blockchain Gaming Services (BGS). BGS provides the reusable player-facing UI, workflows, state, and Arkade SDK integration for BTC Lightning-enabled game features. The existing Babylon.js Lite / WebGPU stealth game remains a separate repository and receives only thin integration hooks.
Primary objective: Demonstrate real BTC Lightning application integration in a portfolio-worthy browser game.
Secondary objective: Keep the integration reusable and understandable by isolating it from gameplay code.
Network: Signet only.
Backend: No custom application server owned or operated by this project.
Blockchain implementation: Arkade SDK only for v1.
Frontend: React + TypeScript.
Runtime integrity: No fake transaction results. Game events may be simulated in the dev harness, but BTC Lightning operations are real Signet operations.


2. Repository and Architecture
2.1 Repository Boundary
Repo A: babylon-lite-stealth-grid
  - Babylon.js Lite / WebGPU game
  - gameplay, levels, checkpoints, win/death conditions
  - thin hooks into BGS


Repo B: blockchain-gaming-services
  - React + TypeScript runtime UI
  - game bridge and workflows
  - Arkade SDK integration
  - split-view development harness


2.2 BGS Layers
2.3 Conceptual Flow
Game Layer
   |
   v
BGS Core Services Layer
   |
   +--> BGS Frontend Layer (React overlay)
   |
   v
Arkade Integration Layer
   |
   v
Arkade SDK / public Signet infrastructure
   |
   v
BTC Lightning / Bitcoin


3. Player-Facing UI Language
The player-facing UI intentionally abstracts protocol and vendor terminology. Technical terms belong in developer documentation, README content, architecture diagrams, and the development harness—not normal player buttons.
Blockchain-enabled UI convention: Prefix related buttons and labels with the lightning icon: ⚡.
Button text prohibition: Do not write Bitcoin, Lightning, Chain, Blockchain, Arkade, BOLT, or other protocol/vendor names in player-facing button text.
Body copy convention: When explanatory body text must refer to the technology, write “BTC Lightning” with no icon.
Async convention: Use the custom lightning loader for all asynchronous BTC Lightning operations.


3.1 Example Buttons
⚡ Account
⚡ Continue
⚡ Claim Achievement
⚡ View Achievements
⚡ Activity
⚡ Log Out


3.2 Async Loader
Any asynchronous BTC Lightning operation uses a distinctive lightning loader instead of a generic spinner: the ⚡ rotates one full turn, pauses briefly, rotates one full turn, pauses, and repeats until success or failure.
Creating/restoring profile
Connecting wallet
Preparing payment
Paying
Waiting for confirmation
Claiming achievement
Loading achievements
Receiving victory reward
Recovery/refund operations


4. Runtime Modes and Player Pathways
4.1 Default: No-Integration Gameplay
The game must remain fully playable without creating or restoring an account. This is the default first-run path: the player can immediately press Play and experience the complete game loop.
BGS-dependent options remain visible where educationally useful but appear disabled.
Selecting a disabled option may open a short explanatory dialog rather than silently doing nothing.
Suggested message: “This feature is unavailable for this run. Restart and connect your account to enable it.”


4.2 Connected Gameplay
A player who creates or restores a Signet profile enables the BGS feature set. From the player perspective the UI remains simple; BGS internally handles whether a particular operation uses Arkade off-chain execution, BTC Lightning interoperability, or Bitcoin settlement.


4.3 Educational Activity View
An optional Activity screen may classify interactions as no-integration, off-chain, or on-chain using Arkade’s architectural explanation. This is educational metadata; it must not clutter normal gameplay.


5. Account / Wallet Flow
5.1 Frictionless Primary Path
Player opens Gear → ⚡ Account.
If no profile exists, show ⚡ Create Account and ⚡ Restore Account.
⚡ Create Account creates a genuine Arkade Signet wallet in-browser.
Immediately show the recovery phrase with a clear test-only warning.
The player may save the phrase externally or ignore it for a disposable demo session.
Continue into the game with the new real Signet identity.


5.2 Restore Path
Player opens ⚡ Restore Account.
Player pastes the recovery phrase previously created by this experience.
BGS reconstructs the same Arkade-compatible Signet identity.
BGS reconnects and reloads available wallet state and achievement assets.
The same profile becomes active again.
Do not advertise arbitrary third-party wallet seed compatibility. Recovery is for BGS/Arkade-compatible test profiles created for this experience.


5.3 Logged-In Account Menu
Profile/status
Wallet details/balance when available
⚡ View Achievements
⚡ Activity
⚡ Log Out


6. Pay-to-Continue Flow
The core portfolio interaction is a real Signet BTC Lightning payment that changes gameplay state.
Player dies.
Death screen shows Restart Game and ⚡ Continue. If no account is active, ⚡ Continue is disabled.
With an active profile, the player selects ⚡ Continue.
BGS opens the runtime payment overlay and displays the test-sat price and checkpoint context.
BGS initiates the real Signet payment workflow through the Arkade integration.
Show the lightning loader while preparing, paying, and confirming.
Only after the SDK reports successful completion does BGS emit a continue-success event to the game.
The Babylon game resumes from the supplied checkpoint.


6.1 Timing and Failure UX
Design the happy-path modal to be comfortable for seconds to tens of seconds, not hours.
After roughly 10 seconds, change copy to indicate the operation is still processing.
After a longer threshold (for example 30–60 seconds), allow the player to return to Restart while BGS safely resolves any pending wallet recovery state.
Never revive the player merely because a transaction was initiated; wait for actual success.
The game must remain playable if the payment path is unavailable.


7. Achievement Flow
Achievements are intended to demonstrate Bitcoin-native player-owned state using Arkade Assets rather than a custom application database.
Player beats a level.
Results UI shows normal gameplay choices plus ⚡ Claim Achievement when BGS is available.
If the player is not connected, the button is disabled and explains that the next run can use an account.
If connected, BGS issues or transfers the appropriate Arkade Asset to the active wallet.
After successful completion BGS emits achievementClaimed to the game.
Gear → ⚡ Account → ⚡ View Achievements queries the wallet and displays owned achievement assets.


7.1 Suggested Initial Achievements
First Extraction — complete Level 1
Ghost Run — complete a level without detection
Second Chance — successfully use ⚡ Continue
Final Extraction — complete the game


7.2 Optional Victory Reward
Stretch goal: after completing the entire game, reward the active Signet wallet with test sats. The client is not cheat-resistant and does not claim secure economic gameplay. This is a proof-of-concept demonstrating the receive/payment path.


8. Minimal Game-Facing API
The Babylon game must know as little as possible about BGS internals. It should not import Arkade concepts or protocol-specific types.


interface BlockchainGamingServices {
  initialize(): Promise<void>;
  isAvailable(): boolean;


  openAccount(): void;
  openAchievements(): void;


  requestContinue(input: {
    checkpointId: string;
    priceSats: number;
  }): Promise<void>;


  requestAchievement(input: {
    id: string;
    name: string;
  }): Promise<void>;


  onEvent(callback: (event: BgsEvent) => void): () => void;
}


8.1 Example Events
{ type: "accountConnected", profileId: "..." }
{ type: "continuePurchased", checkpointId: "cp-03", sats: 10 }
{ type: "achievementClaimed", achievementId: "level-1" }
{ type: "operationFailed", operation: "continue", reason: "..." }


9. Development Harness
BGS must be independently developable without running the Babylon game. The primary development application is a split-view harness.


9.1 Split View
LEFT: Development / Admin Panel        RIGHT: Runtime View
- game-event controls                   - portrait 9:16-ish viewport
- simulate death                        - exact production React UI
- simulate level complete               - no duplicate/mock UI components
- open account                          - real BGS workflows
- checkpoint / price inputs
- event output + event history


9.2 Harness Rules
The harness may simulate game events such as death or level completion.
The harness must call the exact same BGS public API that Babylon will call.
The right-hand runtime viewport must render the exact production React components.
No dummy blockchain mode exists. Once a BGS operation touches the Arkade integration, it uses real Signet behavior.
The left panel displays the exact event payload returned to the game and keeps a timestamped event history.


10. Hard Constraints
Signet only.
Arkade SDK only as the backend integration in v1.
No custom application server.
No mock/simulated transaction outcomes.
Browser-first and deployable as a static web experience where possible.
Game remains playable without an account or BGS connectivity.
BGS is a separate repository from the game.
Player-facing buttons use ⚡ + neutral text; no protocol/vendor terminology in button labels.
Explanatory player-facing body copy uses the phrase BTC Lightning.
Recovery UI must warn users never to paste a mainnet/real-funds recovery phrase.


11. Explicit Non-Goals for v1
Mainnet support.
Production custody/security claims.
Cheat-resistant economic rewards.
Email/password authentication.
Importing arbitrary third-party wallet seeds.
Supporting multiple wallet SDKs/providers.
Supporting NWC, Alby, ZBD, Wavelength, Breez, or EVM technologies in v1.
Building or operating a custom backend server.
Making BTC Lightning mandatory for normal gameplay.


12. Recommended Codex Implementation Sequence
Scaffold BGS repo: React + TypeScript, Frontend/Core/Arkade boundaries, tests, dev harness shell.
Define the minimal game-facing API and event contracts before implementing Arkade.
Implement the portrait runtime UI and split-view dev harness using game-event simulation only.
Implement real Signet wallet creation, immediate recovery-phrase display, restore, logout, and profile state through Arkade.
Implement achievement issue/list flow through Arkade Assets.
Implement the real Signet ⚡ Continue payment flow with robust pending/failure states.
Add optional victory test-sat reward only after the core flows are reliable.
Integrate the packaged BGS build into babylon-lite-stealth-grid through thin hooks.
Document the architecture, network assumptions, security limitations, and real-vs-game-simulated boundaries for portfolio reviewers.


13. Suggested First Codex Prompt
Read BGS_PROJECT_BRIEF.md (or this document exported to Markdown) and treat it as authoritative. Create the initial Blockchain Gaming Services architecture with React + TypeScript, a Frontend Layer, Core Services Layer, Arkade Integration Layer, and a split-view development harness. Do not implement real Arkade transactions in the first change. First establish package boundaries, interfaces, state flow, runtime UI shell, dev harness, tests, and the minimal game-facing API. The harness may simulate game events, but there must be no fake blockchain transaction mode. The eventual integration is Signet-only and Arkade-only.


14. Technical Caveats to Preserve
Arkade is an emerging/experimental ecosystem. Treat this as a portfolio proof-of-concept, not production payment infrastructure.
Arkade uses shared operator infrastructure; “no custom server” does not mean “no servers exist.” The browser SDK communicates with Arkade infrastructure.
A wallet recovery phrase is sensitive private material. The test-only UI must communicate that clearly.
BTC Lightning payment/receive workflows may depend on current Arkade Intents/solver availability and can fail or take longer than the ideal interaction.
Off-chain operations are real BTC-backed activity but should not be presented as equivalent to immediate Bitcoin L1 settlement.
The client-side game is intentionally not authoritative or cheat-resistant for monetary reward logic.


AUTHORITATIVE SCOPE
This document captures the final decisions from exploratory design discussion. Codex should treat these decisions as authoritative unless a later spec explicitly replaces them.


Layer        Responsibilities        Must Not Own
Frontend Layer        React runtime overlay; account/profile UI; payment flows; achievements; async status and errors.        Gameplay logic or direct Babylon dependencies.
Core Services Layer        Game-facing API; workflow orchestration; state machine; events/callbacks; Signet-only policy; availability checks.        Arkade-specific UI assumptions.
Arkade Integration Layer        Arkade SDK; wallet creation/restoration; operator connectivity; payments; assets/achievements; network operations.        Game-specific logic.


TEST-ONLY WARNING
The UI must clearly state that this is a Signet test wallet and users must never enter or reuse a recovery phrase from a wallet containing real funds.
