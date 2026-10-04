## Context

GameWalletPanel currently puts balance/Details in F1, payment in F2 and boarding in F3. The live probe only returns a waiting boolean; completed journals can be returned without a fresh read, so they alone cannot prove current completion.

## Goals / Non-Goals

Goals: preserve wallet isolation and payment execution while separating identity, boarding and payment presentation. Non-goals: new payment protocols, automatic boarding, persistent boarded flags or a new-deposit repeat exception.

## Decisions

Extend the existing read-only transaction probe to classify confirmed matching boarding input spends as well as pending ones. Keep the old boolean API as a compatibility wrapper. Use wallet-scoped in-memory UI state with cancellation, and re-read after reload; unknown provider state disables submission and retains Details. Do not infer boarding from a positive balance or a saved completion flag.

F1 keeps Login/Logout. F2 keeps boarding Details and quote/confirmation, replacing its action with Boarded for live completion. F3 carries the payment button, usable balance and wallet Details. Only Awaiting Balance is appended to the payment label; all other guards remain with visible accessible explanatory text. Existing mutation guards remain authoritative if eligibility changes between render and click.

## Risks / Trade-offs

- Incomplete provider history may leave boarding unknown or unrecognized: never fabricate completion; show unavailable reads and keep recovery inspection.
- The no-repeat rule prevents boarding later deposits through this Admin action; this follows the user's baseline, not the unaccepted repeat recommendation.
- Concurrent wallet-operation work may change eligibility: retain its implementation and test against the current checkout.

## Migration Plan

No storage migration. Renumber current documentation and UI without renaming historical change directories or changing journal identifiers. Verify focused evidence classification tests, typecheck/build and a browser fixture. Record live network verification separately.
