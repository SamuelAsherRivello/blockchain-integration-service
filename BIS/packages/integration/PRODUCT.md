# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Game developers embed the public integration API and its production React UI in browser games. Players create or restore a disposable Signet account, then use account, balance, asset, payment, and recovery flows inside the game experience.

## Product Purpose

Provide a reusable browser-game integration layer for real Signet BTC Lightning functionality while keeping game code independent of wallet and Arkade SDK concerns.

## Positioning

The package exposes a minimal game-facing API while separating Core workflow/state, player-facing React UI, and Arkade SDK integration. It uses real Signet behavior rather than simulated transaction outcomes.

## Operating Context

The package is consumed through public exports by a game host and by the sibling integration demo. The host owns placement, game policy, and lifecycle; this package owns its UI and wallet workflows.

## Capabilities and Constraints

- React and TypeScript browser package.
- Signet only; Arkade SDK is the v1 integration.
- No custom application server and no mock transaction results.
- Normal gameplay remains available without an account.
- Player-facing blockchain-related controls use a lightning icon with neutral language; vendor/protocol names stay out of player button labels.
- Recovery surfaces must warn people never to use a real-funds wallet phrase.

## Evidence on Hand

- [Package README](README.md) documents the public API and implemented account flows.
- `src/core`, `src/ui`, and `src/arkade` define the package boundaries.
- Automated integration and demo-host tests are present in the repository.

## Product Principles

- Keep game-facing integration small and protocol-agnostic.
- Make real Signet state clear without making wallet setup mandatory for play.
- Protect recovery material and distinguish test-only behavior from production custody.
- Preserve recoverable, explicit user-controlled financial workflows.

## Accessibility & Inclusion

Player flows provide clear status and error states, keyboard-operable controls, and warnings suitable for a test-wallet experience.
