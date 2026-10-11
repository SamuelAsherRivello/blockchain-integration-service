# Spec Delta

## MODIFIED Requirements

### Requirement: Safe state and notifications share one host channel

BIS SHALL provide a readonly safe snapshot and notify the game through `IBisGame.onBisEvent` about snapshot changes, Account dismissal, player account connection or disconnection, restart requests and operation/effect changes. Snapshots SHALL distinguish unavailable state from empty success. Notifications SHALL contain no wallet secrets, SDK objects or raw provider errors. BIS SHALL not reload the browser window in response to an account lifecycle event; the consuming game owns menu reconstruction and any browser refresh decision.

#### Scenario: Account closes or logout requests restart
- **WHEN** BIS closes Account or completes a logout that requires game restart
- **THEN** the typed notification SHALL identify the action without requiring observation of internal UI state
- **AND** restart notification SHALL include a stable identity for host deduplication

#### Scenario: Player account connects or disconnects
- **WHEN** a player account becomes active or is removed
- **THEN** BIS SHALL deliver `accountConnected` or `accountDisconnected` with only the safe profile identifier through `IBisGame.onBisEvent`
- **AND** BIS SHALL not call `window.location.reload()` or otherwise refresh the browser

#### Scenario: Game chooses lifecycle recovery
- **WHEN** the game receives an account connection, disconnection, or logout restart notification
- **THEN** the game SHALL reconcile its menu and account-dependent controls from the latest safe snapshot
- **AND** the game SHALL decide whether to remain in place, rebuild the main menu, or refresh the browser based on its current gameplay location

#### Scenario: Contract funding confirms while the game window is closed
- **WHEN** BIS observes a pending contract become confirmed
- **THEN** its safe contract projection and host notification SHALL update independently of game UI polling
- **AND** financial confirmation SHALL not alone assert that the current gameplay target is eligible

#### Scenario: Reset invalidates old work
- **WHEN** pre-reset work completes after the reset generation has changed
- **THEN** it SHALL not publish a stale snapshot, deliver a game effect, or reactivate cleared state
