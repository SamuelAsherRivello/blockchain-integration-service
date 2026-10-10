# Proposal

## Why

The BIS Account UI can already publish safe player-account lifecycle events, but the game does not consistently rebuild its main menu when those events arrive. As a result, the Items button can remain stale after login or logout, and logout from gameplay currently restarts only part of the game instead of allowing the game to decide whether a browser refresh is required.

## What Changes

- Keep BIS responsible for publishing typed account connection and disconnection events through `IBisGame.onBisEvent`; BIS must not reload the browser window.
- Ensure the game consumes login/logout events as host-owned lifecycle signals and rebuilds its main menu so Items visibility and availability reflect the latest BIS snapshot.
- Make the game choose the refresh behavior: account changes at the main menu are handled by menu reconstruction, while account changes outside the main menu request a game-owned browser refresh.
- Preserve the existing logout restart identity and idempotency behavior.
- Add BIS contract tests and game unit/browser coverage for login, logout, menu reconstruction, and refresh ownership.
- Update current BIS/game integration documentation to describe the event and refresh boundary.

## Capabilities

### New Capabilities

<!-- No new capability; this is a refinement of the existing public game boundary. -->

### Modified Capabilities

- `bis-game-contract`: clarify that account connection/disconnection notifications are delivered to the game without BIS browser refresh, and that the game owns menu reconstruction and any browser refresh decision.

## Impact

- BIS public game event types and focused integration tests under `BIS/packages/integration`.
- Stealth & Steel game BIS adapter, runtime menu lifecycle, and related UI/browser tests under `blockchain-stealth-and-steel-game/stealth-steel`.
- No new wallet/provider dependency and no change to account persistence or financial operations.
