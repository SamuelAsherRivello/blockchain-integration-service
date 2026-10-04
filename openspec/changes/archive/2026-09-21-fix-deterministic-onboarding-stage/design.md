## Context

See proposal.md for the motivation. The current UI owns a small stage helper, while the Account Details entry derives its label from the asynchronous onboarding view. The live Admin reproduction showed these surfaces diverging: Account Details displayed 100,000 Arkade sats and Admin E3 then rendered Fund the account as the current stage. The existing onboarding worker must remain the authority for durable onboarding attempts, receipts, reservations, and recovery.

## Goals / Non-Goals

**Goals:**

- Give the Account Details entry and Onboarding page one deterministic readiness projection for the active profile.
- Carry a fresh active-account Arkade balance across the Account Details-to-Onboarding and Admin E3 navigation paths, or obtain it through the established bounded balance-read lifecycle.
- Preserve the current safety boundary between presentation readiness and durable transfer completion.

**Non-Goals:**

- Changing the 50% onboarding route, its record format, its reservation rules, or its retry behavior.
- Persisting balances, fabricating transaction history, or treating a raw balance as proof that an unresolved transfer completed.
- Adding a polling loop, a new dependency, or a game-facing Arkade-specific API.

## Decisions

### Use one profile-scoped readiness projection

The integration core will derive the Account Details label and five-stage display from a single typed projection containing the active profile identity, current onboarding evidence, and the current fresh balance status. The projection will return the highest supported stage and label together, rather than having the Account Details entry inspect only the onboarding view while the page separately evaluates balance.

This prevents the reproduced disagreement and lets regression tests exercise the same contract without rendering React. Keeping two independent helpers was considered, but it would allow their precedence rules to drift again.

### Treat a fresh positive Arkade amount as presentation readiness only

A positive Arkade amount supplied by the current account's successful balance read will select stage 5 and the Complete label. It will not mutate the onboarding journal, release an operation reservation, cancel/retry a transfer, or claim a settlement history. Durable completion continues to require its existing attributable receipt evidence.

Promoting a balance observation into a completed onboarding record was rejected because it would destroy recovery provenance for any separately unresolved operation.

### Make navigation preserve-or-read the same active balance

When Account Details transitions to Onboarding, the context will retain an already-ready balance only when it belongs to the unchanged active profile. When Admin E3 opens Onboarding without a retained ready balance, the context will use the established bounded balance-read path before readiness is presented. Navigating away, changing account, or receiving a late result will invalidate that read under the existing ownership guards.

Letting the page default to step 2 until a later background value arrives was rejected because it reproduces the incorrect funding prompt and makes the state navigation-order dependent.

## Risks / Trade-offs

- [Arkade total can include funds unavailable to a specific operation] → Limit the new meaning to onboarding presentation; preserve existing operation and reservation checks for every mutation.
- [A fresh read fails during direct Admin E3 navigation] → Show Pending/unavailable readiness, never a fabricated zero or Complete state, and keep the current retry/deadline behavior.
- [Profile changes during navigation] → Require the profile/generation guard before accepting a retained or newly read balance.
- [Existing tests encode two independent status paths] → Replace them with stage/label parity tests and a live browser host assertion for the Account Details-to-Onboarding route.

## Migration Plan

1. Add the shared readiness projection and update the two presentations to consume it.
2. Route Onboarding navigation through the profile-scoped balance lifecycle and add focused regression coverage.
3. Run type, unit, build, and browser checks; if a regression occurs, revert the presentation routing and helper together without touching journals or wallet data.
