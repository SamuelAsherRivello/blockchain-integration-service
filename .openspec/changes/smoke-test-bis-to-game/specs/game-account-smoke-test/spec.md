## Purpose

Provide the stealth game with the complete existing BIS Account experience through its Settings menu, and define reproducible cross-project smoke acceptance without requiring accounts for gameplay.

## ADDED Requirements

### Requirement: Settings opens the complete production Account experience
The game Settings menu SHALL expose an accessible ⚡ Account action. Activating it SHALL open the existing production BIS Account experience with the actual account state. The game SHALL consume the public integration package and stylesheet and SHALL NOT duplicate Account screens, import private wallet modules, or expose the BIS development/admin interface. All existing Account destinations and their current guards SHALL remain available without host-specific pruning or substituted outcomes.

#### Scenario: Guest opens Account
- **WHEN** a player without a saved game-origin account activates ⚡ Account in Settings
- **THEN** the production Create Account and Restore Account choices are available
- **AND** no account is automatically created or restored

#### Scenario: Active account opens the full menu
- **WHEN** a player with an active account opens Account
- **THEN** the same Balance, Transactions, Assets, Send, Receive, Swap, recovery access and Log Out routes exposed by the packaged BIS UI remain reachable with their existing availability rules
- **AND** opening or navigating the menu does not automatically submit financial operations

### Requirement: Account navigation preserves game pause and modal ownership
Gameplay and gameplay input SHALL remain paused while Settings or Account owns the interaction, while the scene continues rendering. Nested BIS navigation SHALL stay within BIS. Dismissing the Account root normally SHALL return to Settings with focus on its Account action. Closing Settings SHALL resume only when no other pause owner remains, without applying paused wall-clock time or replaying held input. Account loading/error states SHALL offer a return path without bypassing BIS mutation or confirmation guards.

#### Scenario: Navigate through Account and back
- **WHEN** the player opens Balance and recovery access, returns through the Account menu, and dismisses the Account root
- **THEN** Settings becomes interactive and its Account action receives focus
- **AND** no movement or gameplay action occurs until the final applicable pause is released

#### Scenario: Another game pause remains
- **WHEN** Account closes while a start, loss or other game pause remains active
- **THEN** that pause is preserved and closing Account does not restart gameplay

#### Scenario: Keyboard and narrow viewport
- **WHEN** the player uses keyboard, touch or pointer navigation in a narrow, short or fullscreen game frame
- **THEN** Account controls and Back remain reachable, inactive modal/game controls cannot receive actions, and the scene remains visibly paused

### Requirement: Account lifecycle remains origin-local and independent of gameplay
The game SHALL support the existing A1–A6 Account lifecycle on its own browser origin. It SHALL preserve saved account access across ordinary reload and menu visits, honor existing logout cleanup/reload behavior, and allow ordinary gameplay without an account or wallet connectivity. It SHALL NOT copy browser wallet storage between the BIS demo and game or expose recovery material through host state, events, diagnostics or test reports. Ordinary Account dismissal or host disposal SHALL NOT clear saved account storage.

#### Scenario: Create and return after reload
- **WHEN** a user explicitly creates a disposable Signet account, completes the production recovery step and reloads the same game origin
- **THEN** the saved account is available through Settings without another creation request
- **AND** the recovery phrase is handled only within the production private UI and user-managed backup

#### Scenario: Logout and restore
- **WHEN** the user confirms production logout for a disposable account with no pending operations and later restores that profile through Account
- **THEN** logout honors the existing cleanup and reload contract, the game remains playable, and explicit restoration returns access to the same profile

#### Scenario: Different browser origin
- **WHEN** the game is opened on a different port or hostname from the BIS demo
- **THEN** it uses its own saved account state and does not silently import the demo account

#### Scenario: Integration unavailable
- **WHEN** Account package loading, hydration or a wallet read fails or remains slow
- **THEN** the player receives truthful loading/unavailable feedback and can return to ordinary gameplay
- **AND** the game does not invent a connected account, balance or successful operation

### Requirement: Public package works in development and production hosts
The smoke delivery SHALL identify the exact BIS package artifact and both project revisions tested. The independent game SHALL load that package and its styles in development and production builds without relying on private sibling-source imports. Repeated Account activation SHALL NOT create duplicate active sessions, overlays or subscriptions, and host teardown SHALL release its UI and subscriptions without late callbacks reopening them.

#### Scenario: Packaged consumer
- **WHEN** the game installs the recorded BIS artifact and starts its development and production builds
- **THEN** Settings opens a styled, functioning production Account experience in each mode
- **AND** the evidence identifies the package version/hash and both source baselines

#### Scenario: Reopen and teardown
- **WHEN** Account is opened repeatedly, closed and reopened, or initialization finishes after the game host is disposed
- **THEN** at most one live Account session belongs to that host and disposed work cannot reopen UI or affect the replacement host

### Requirement: Smoke evidence distinguishes Account acceptance from deferred financial scope
The runbook SHALL begin with BIS baseline verification and proceed to the actual game. It SHALL document working server commands, browser origins and required SSH forwards. The acceptance record SHALL cover A1 entry, A2 creation/persistence, A3 restoration, A4 balance/refresh, A5 transactions/detail/copy and A6 logout, with explicit observed outcomes and live-versus-fixture attribution. Empty, unavailable, blocked and unperformed cases SHALL NOT be recorded as successful populated/live financial verification. Additional Account destinations SHALL receive navigation checks without requiring financial submissions. Pay-to-continue, revival and achievement gameplay hooks SHALL remain outside this change.

#### Scenario: Account smoke is complete
- **WHEN** the run is reported as passing
- **THEN** game-origin evidence includes the real disposable account create/reload/logout/restore lifecycle, A1–A6 navigation and reads, guest gameplay, focus/pause and development/production package checks
- **AND** populated-data fixture checks and any unobserved live history/funded-balance cases are explicitly distinguished

#### Scenario: Service or test data prevents a case
- **WHEN** a live account lifecycle step cannot complete, or a disposable account has no funded balance or transaction records
- **THEN** the record states the exact failed/blocked step or verified empty state
- **AND** isolated fixture success does not replace the missing live lifecycle evidence or claim a financial operation occurred

#### Scenario: Browser tunnel is missing
- **WHEN** the server responds but the remote user's browser cannot reach its localhost URL
- **THEN** the runbook supplies the client-side forwarding command and distinguishes server availability from browser reachability
- **AND** a host HTTP check alone is not reported as a successful browser smoke test
