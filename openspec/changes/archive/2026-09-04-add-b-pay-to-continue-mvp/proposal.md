## Why

Demonstrate the smallest real pay-to-continue operation without implementing game death screens or a game wallet. Admin should request a test-sat payment and show its truthful result, giving future games a simple continuation integration.

## What Changes

- Add one game-facing continuation request, an Admin Request Continue button, and Console outcomes; no Runtime Preview changes or second confirmation overlay.
- Default to 1,000 sats; throw before submission unless the amount is an integer from 1,000 to 10,000 inclusive. Comment that local validation is not fail-safe or cheat-resistant.
- Prefer native-sat burning, but the feasibility investigation found no supported path. The user explicitly authorized a fresh generated recipient wallet as the fallback sink. Save only its public Arkade address; never activate, persist or expose its secret, replace the player wallet, or call this proven destruction of Bitcoin.
- Track request identity, confirmed outcomes, and pending reconciliation without duplicate payments or stale continuation delivery. No separate consume call or stored entitlement.
- This change delivers B1. MVP Request Continue in full: request entry, single-gesture payment, validation, insufficient-funds/failure reporting and durable pending tracking. It does not touch B2 (actual game death-screen integration), B3 (optional payment review and guidance UI), or B4 (extended pending-payment and recovery UI).
- Defer D1 wallet management, D6 USD pricing, advertising, trusted server enforcement, and actual game revival.

## Capabilities

### New Capabilities
- `pay-to-continue`: Validated, identifiable test-sat payment request and durable truthful outcomes.

### Modified Capabilities
- `story-driven-demo`: Expose the implemented B Admin demonstration with Console output only.

## Impact

Integration public API, Core operation tracking, Arkade adapter, and Admin composition/tests. No custom server, new dependency, or game-repository changes proposed. The user authorized implementation and validation of the generated-recipient fallback after reviewing native-burn infeasibility. Exact output validation, authoritative transaction evidence and fresh supplementary balance/activity reads establish delivery.
