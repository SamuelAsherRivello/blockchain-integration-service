## MODIFIED Requirements

### Requirement: Account lifecycle remains origin-local and independent of gameplay

The game SHALL support the existing A.P.1–A.P.5 Account lifecycle on its own browser origin. It SHALL preserve saved account access across ordinary reload and menu visits, honor existing logout cleanup guards and request host-owned restart after confirmed cleanup, and allow ordinary gameplay without an account or wallet connectivity. It SHALL NOT copy browser wallet storage between the BIS demo and game or expose recovery material through host state, events, diagnostics or test reports. Ordinary Account dismissal or host disposal SHALL NOT clear saved account storage. The game’s explicit Clear All Settings action SHALL be a separate force-reset path: it SHALL clear game-owned settings and invoke BIS’s public force-reset operation, which clears BIS-owned player-wallet and game-wallet state without applying the interactive logout acknowledgement flow.

#### Scenario: Create and return after reload
- **WHEN** a user explicitly creates a disposable Signet account, completes the production recovery step and reloads the same game origin
- **THEN** the saved account is available through Settings without another creation request
- **AND** the recovery phrase is handled only within the production private UI and user-managed backup

#### Scenario: Logout and restore
- **WHEN** the user confirms production logout for a disposable account with no pending operations and later restores that profile through Account
- **THEN** logout honors the cleanup guards and BIS requests a restart that the game performs, the game remains playable, and explicit restoration returns access to the same profile

#### Scenario: Different browser origin
- **WHEN** the game is opened on a different port or hostname from the BIS demo
- **THEN** it uses its own saved account state and does not silently import the demo account

#### Scenario: Integration unavailable
- **WHEN** Account package loading, hydration or a wallet read fails or remains slow
- **THEN** initial package loading and hydration show only the blocking backdrop; failure or the bounded timeout shows truthful unavailable feedback with a return to Settings
- **AND** the game does not invent a connected account, balance or successful operation

#### Scenario: Clear All Settings force-reset
- **WHEN** the player activates the game’s Clear All Settings action
- **THEN** the game clears its own settings and invokes BIS force reset without an “are you sure” prompt
- **AND** both BIS wallet roles and BIS-owned local state are absent afterward while ordinary guest gameplay remains available
