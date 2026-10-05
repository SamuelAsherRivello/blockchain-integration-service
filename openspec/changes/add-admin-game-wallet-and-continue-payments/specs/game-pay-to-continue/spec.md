## MODIFIED Requirements

### Requirement: BIS owns price and the game owns ordered loss choices
BIS SHALL expose the fixed 1000-sat price through its public API. The game SHALL dynamically build `Pay 1000 Sats To Continue` from that value as the first action, with a left lightning icon and `Restart Game` below. Shared menu labels SHALL shrink to fit their available width, accounting for icons. Pay SHALL remain visible, greyed out and unclickable whenever the player is not logged in, BIS is unavailable, or the configured game recipient is missing or invalid. Restart SHALL remain free. The separately deployed game SHALL supply the public recipient through build configuration without depending on Admin browser storage or a signing service. The demo SHALL use the selected game wallet public address for new requests; its local development Admin SHALL save only that public address into both projects for subsequent builds. Invalid recipient configuration SHALL have an accessible explanation.

#### Scenario: Logged out defeat
- **WHEN** a logged-out player reaches the loss screen
- **THEN** Pay is disabled and Restart is available, with the required order and BIS-sourced price

#### Scenario: Missing recipient
- **WHEN** a logged-in player reaches the loss screen in an unconfigured build
- **THEN** Pay is disabled with an explanation and free Restart remains available

#### Scenario: Independently deployed game
- **WHEN** a configured game runs in a player's browser without Admin open
- **THEN** it routes Continue payments to the build-configured public recipient using the existing session-bound success flow
