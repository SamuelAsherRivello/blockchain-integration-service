# game-pay-to-continue Specification

## Purpose

Connect verified BIS continuation payments to the actual game's defeat flow with a shared price, truthful feedback, and strictly session-bound gameplay consequences.

## Requirements

### Requirement: BIS owns price and the game owns ordered loss choices
BIS SHALL expose the fixed 1000-sat price through its public API. The game SHALL dynamically build `Pay 1000 Sats To Continue` from that value as the first action, with a left lightning icon and `Restart Game` below. Shared menu labels SHALL shrink to fit their available width, accounting for icons. Pay SHALL remain visible, greyed out and unclickable whenever the player is not logged in or BIS is unavailable. Restart SHALL remain free.

#### Scenario: Logged out defeat
- **WHEN** a logged-out player reaches the loss screen
- **THEN** Pay is disabled and Restart is available, with the required order and BIS-sourced price

### Requirement: Payment uncertainty keeps both actions disabled
An explicit Pay gesture SHALL synchronously disable both choices. The controller SHALL submit once, reconcile pending outcomes without replacement payments, and keep both choices disabled until confirmed success or definitive failure. Read errors and timeouts SHALL NOT imply failure. A definitive failure SHALL present an accessible error and restore the choices subject to current login state.

#### Scenario: Repeated click and lost response
- **WHEN** Pay is clicked repeatedly and the payment result is pending
- **THEN** only one operation is submitted, both actions remain disabled, and status reconciliation cannot initiate another payment

### Requirement: Confirmed payment delivers one toast and one matching callback
After confirmed success BIS SHALL show exactly `User paid 1000 sats to continue`, substituting the confirmed paid amount, through D7 with a lightning logo to the left of the message. It SHALL deliver a host success callback at most once for the original loss context and account. No callback or success toast SHALL be produced from submission alone. Disposed sessions and replacement accounts SHALL not receive a gameplay effect from an obsolete attempt.

#### Scenario: Pending becomes succeeded
- **WHEN** reconciliation confirms the current attempt succeeded
- **THEN** one success toast and one callback are delivered, even if later checks return the same result

### Requirement: Game resumes the current player and clears nine cells
The game SHALL own payment consequences. For a matching successful attempt in LEVEL_LOST, it SHALL dispose and replace the defeated player through the same reusable row/column spawn function used at level start, preserving the exact current position and equipped loadout with full health, fresh visible sprites, animation and input registrations. It SHALL immediately remove every enemy in the player's logical grid cell and eight adjacent cells, and resume only after that cleanup. It SHALL preserve all other run state. Normal future spawning and projectiles SHALL remain unchanged.

#### Scenario: Same-position revival
- **WHEN** payment succeeds with enemies in diagonal and cardinal neighboring cells and enemies farther away
- **THEN** a fresh visible player spawns at the same position with full health and the same loadout, nearby enemies are removed, farther enemies and other entities retain state, and gameplay resumes after removal

### Requirement: Session abandonment never grants another run a continuation
Restart SHALL begin a free new session. Closing or refreshing SHALL start at the beginning without restoring the previous run. Payment journals SHALL remain under B1 recovery, but an old result SHALL never revive a player or remove enemies in a new session. The host SHALL dispose listeners and reconciliation timers on teardown.

#### Scenario: Late completion after teardown
- **WHEN** a submitted payment completes after the originating game session is disposed
- **THEN** no toast or gameplay callback is delivered to that disposed session or a replacement run
