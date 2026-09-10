# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Developers and testers run a dedicated, local Signet experiment to observe and validate account creation, funding, onboarding, settlement recovery, and timing behavior without touching production integration state.

## Product Purpose

Exercise the real Arkade SDK onboarding path in isolation, documenting a recovery-safe route from funded Signet Bitcoin to a selected usable Arkade balance.

## Positioning

This standalone spike has its own browser storage, identity, operation locks, and recovery behavior. It intentionally avoids imports from the production integration package and does not simulate wallet results.

## Operating Context

The Vite app guides an operator through six steps: create account, fund with a faucet, observe incoming Bitcoin, onboard a selected percentage, track the Bitcoin-to-Arkade transition, and confirm usable Arkade funds. Each window has isolated state and can preserve recovery behavior through reloads.

## Capabilities and Constraints

- Direct Arkade SDK Signet experiment with no custom backend.
- Real Signet funding and settlement behavior; automated tests do not establish live funded acceptance by themselves.
- Browser-local encrypted account state and explicit, time-limited recovery-detail display.
- Never use, enter, log, or commit a real-funds recovery phrase.
- Restart archives the prior local experiment but does not cancel submitted transfers or move funds.
- Exact output and recovery checks prevent duplicate or ambiguous onboarding actions.

## Evidence on Hand

- [Package README](README.md) documents the workflow, recovery limits, verified runs, and local commands.
- `tests/FAILURE_MATRIX.md` records implemented and remaining robustness boundaries.
- The app and tests are intentionally isolated from the production integration package.

## Product Principles

- Prefer recoverability and exact evidence over optimistic completion claims.
- Keep real Signet experiments isolated from production wallet state.
- Require explicit operator action for funding and sensitive recovery details.
- Preserve enough diagnostic state to reconcile interruption without unsafe replay.

## Accessibility & Inclusion

Step ownership, status, duration, errors, and recovery actions are communicated explicitly; sensitive information has deliberate reveal, copy, timeout, and clear-state behavior.
