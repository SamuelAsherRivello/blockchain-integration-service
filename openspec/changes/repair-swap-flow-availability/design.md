# Design

## Context

See `proposal.md` for the user-visible failure. The current provider-neutral `BalanceAmounts` contains one spendable amount, total Bitcoin/Arkade totals, and no per-side availability. The Swap component separately probes transfer availability but intentionally allows the `insufficient-funds` result through to quote, producing the observed error after an enabled click.

## Goals / Non-Goals

**Goals:**

- Make the balance read contract complete enough for Account Details to render total and available values for both sides.
- Keep the read/cache provider-neutral and scoped to the existing account/network/evidence lifecycle.
- Make Swap's review action truthful for unavailable direction-specific funds while retaining live quote and confirmation validation.
- Preserve the current reservation, policy, quote, and settlement boundaries.

**Non-Goals:**

- Do not change Arkade settlement, fee policy, reservation semantics, or confirmation behavior.
- Do not persist balance snapshots or treat presentation cache data as authorization.
- Do not add polling or a second balance-read owner.

## Decisions

1. **Extend the balance projection at the Arkade adapter boundary.** Derive the two side-specific available values from the same validated live wallet evidence used for the existing totals. Keep the exported shape numeric and provider-neutral so UI and core code do not depend on SDK types. If current Signet SDK evidence cannot provide a side's availability atomically, the read remains incomplete rather than inventing a value; implementation must verify the installed SDK shape before choosing the derivation.

2. **Cache the complete projection as one balance entry.** The existing read coordinator already scopes entries by account, network, lifecycle generation, query, and evidence. A complete entry must include every required field; fixtures and validation must be updated together so old partial objects cannot masquerade as complete data.

3. **Use direction-specific availability as the Swap gate.** The view owns the current direction and amount, so it will refresh or join the corresponding availability probe when either changes. `insufficient-funds` is a disabled-action state, not a quote error path. Other negative reasons remain disabled with a safe reason. A live quote remains authoritative after the button is enabled, including requested amount, reservations, policy, and current wallet evidence.

4. **Keep the visible balance and operation availability distinct.** A positive total may coexist with zero available funds because of confirmation or reservations. The UI will state that distinction instead of making the total imply spendability.

Alternatives considered: continuing to enable review and surfacing the quote error preserves the bug; using total Bitcoin as available permits invalid transfers; calculating availability only in React duplicates wallet evidence and can diverge from the live operation adapter.

## Risks / Trade-offs

- **[SDK balance shape differs across versions]** → Inspect the installed SDK types and existing boarding-input evidence, validate all fields, and keep the read unavailable rather than guessing.
- **[Availability read churn on amount edits]** → Coalesce compatible reads and only gate the action; never submit or quote from the cache.
- **[A valid balance becomes stale before click]** → Keep the live availability/quote and confirmation checks as final authorities.
- **[Existing fixtures use the old balance shape]** → Update only affected fixtures and add explicit partial-shape regression coverage.
