## Purpose

Provide a consistent, readable BIS action surface at the supported 100% browser scale while preserving the existing wallet, onboarding, logout, and host-specific navigation contracts.

## ADDED Requirements

### Requirement: Shared BIS button label fitting

Every visible production BIS button SHALL keep its complete text inside its rendered button bounds at the available width. A label SHALL retain the normal shared BIS font size when it fits and SHALL reduce its font size only as much as needed when it does not. The label SHALL not be clipped, ellipsized, or unexpectedly wrap solely because the button is constrained. When the button becomes wider, the label SHALL be able to return to its normal size.

#### Scenario: Long label in a compact action row
- **WHEN** a BIS action row gives a button less width than its complete label needs
- **THEN** the label remains fully readable inside the button at a reduced font size
- **AND** the neighboring buttons retain their layout and usable hit areas

#### Scenario: Space becomes available
- **WHEN** a preview resize or responsive layout gives the same button enough width for its normal label
- **THEN** the label returns to the normal shared BIS font size
- **AND** no stale reduced inline size remains

#### Scenario: Narrow dialog and disabled state
- **WHEN** a button is rendered in a narrow dialog or is disabled while its label is long
- **THEN** fitting still preserves the complete label and existing disabled styling, cursor, focus, and action semantics

### Requirement: Compact Game Wallet entry actions

The unconfigured Game Wallet Login page SHALL show exactly two primary setup actions on the same row: `⚡ Create Wallet` and `⚡ Restore Wallet`. Create Wallet SHALL retain primary styling, Restore Wallet SHALL retain secondary styling, and both SHALL remain independently disabled only by the existing busy state. The Back action SHALL remain below the row. The Game Wallet recovery-submit action SHALL use the label `⚡ Restore Wallet`.

#### Scenario: Open an unconfigured Game Wallet page
- **WHEN** a connected player opens Game Wallet Login without a selected Game Wallet
- **THEN** `⚡ Create Wallet` and `⚡ Restore Wallet` appear side by side
- **AND** Back appears below them
- **AND** neither action exposes the implementation phrase "Game Wallet" in its button label

#### Scenario: Choose Game Wallet restoration
- **WHEN** the player selects `⚡ Restore Wallet` and enters the restore page
- **THEN** the existing private twelve-word restore flow opens
- **AND** its submit action is labeled `⚡ Restore Wallet`

#### Scenario: Existing Game Wallet remains configured
- **WHEN** a Game Wallet is already selected
- **THEN** the page continues to show its configured message, Log Out Game Wallet, and Back without exposing create/restore actions in that state

### Requirement: Developer menu placement and return navigation

The production Account Details page SHALL place the Developer action directly below Get Recovery Phrase. The top-level active Account menu SHALL not render a separate Developer action. Opening Developer SHALL show its existing Player Wallet and Game Wallet tools. Back from Game Wallet Login SHALL return to Developer. Back from Onboarding SHALL return to Developer when Onboarding was opened through Developer. Onboarding opened directly by a host or Admin flow SHALL retain its existing return to Account Details.

#### Scenario: Open Developer from Account Details
- **WHEN** an active player opens Account Details
- **THEN** the action order includes Assets, Contracts, Transactions, Get Recovery Phrase, Developer, and Back
- **AND** the top-level Account menu does not contain Developer

#### Scenario: Return from Game Wallet Login
- **WHEN** the player opens Developer from Account Details, opens Game Wallet Login, and presses Back
- **THEN** the Developer menu is shown again
- **AND** the Account Details page is not shown between those two views

#### Scenario: Return from Developer-opened Onboarding
- **WHEN** the player opens Developer, opens Player Wallet Onboarding, and presses Back
- **THEN** the Developer menu is shown again

#### Scenario: Direct host Onboarding remains compatible
- **WHEN** a host opens Onboarding directly without entering through Developer
- **THEN** Back returns to Account Details as before

### Requirement: Game Wallet logout loading coverage

While Game Wallet logout is executing, the existing BIS Pending Operation Dialog SHALL appear above the Game Wallet page with the message `Logging out...`. The Game Wallet logout button and Back action SHALL remain disabled or otherwise non-interactive for the duration, duplicate logout calls SHALL be prevented, and the loading dialog SHALL disappear only after the wallet operation settles. A failed logout SHALL continue through the existing error handling without claiming success.

#### Scenario: Delayed Game Wallet logout
- **WHEN** the player presses an enabled Log Out Game Wallet action and the wallet logout remains pending
- **THEN** the action becomes disabled and the BIS loading window appears on top with `Logging out...`
- **AND** the underlying Game Wallet page cannot receive duplicate actions

#### Scenario: Game Wallet logout completes
- **WHEN** the pending logout resolves successfully
- **THEN** the loading window closes
- **AND** the Game Wallet page shows its unconfigured state without requiring an application refresh

#### Scenario: Game Wallet logout fails
- **WHEN** the pending logout rejects
- **THEN** the loading window transitions through the existing failure presentation
- **AND** the UI does not claim that the Game Wallet was logged out successfully
