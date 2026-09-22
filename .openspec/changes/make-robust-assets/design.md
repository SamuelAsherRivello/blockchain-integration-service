# Design

## Context

See proposal.md for motivation. The current project already has durable operation records, wallet mutation locks, reservations, safe public errors, and active-network stores. The weak point is the boundary between those durable protections and short-lived controller state: maps, busy flags, start chains, and per-batch booleans can coordinate one active attempt, but they must not become a second source of truth after that attempt settles.

The implementation must preserve the current separation of responsibilities:

- Core Services own operation identity, durable records, reservations, locks, and safe public statuses.
- Arkade Integration owns SDK calls, live network/provider validation, exact receipt checks, and no-secret error handling.
- Admin/Demo code may simulate host gameplay events but must use the public production APIs for wallet mutations and contract actions.

## Goals / Non-Goals

**Goals:**

- Make every audited transient guard settle cleanly: single-flight map entries, busy flags, acting flags, and batch item state must clear in `finally` or equivalent completion paths.
- Keep durable operation records authoritative for duplicate prevention, same-session LTO skip prevention, submitted/unknown recovery, reservations, and network isolation.
- Normalize legacy saved records that lack `network` only when they were loaded through a network-scoped active store.
- Add focused tests that fail for stale unavailable caches and stale global batch blocks.
- Preserve existing public API shapes and error categories.

**Non-Goals:**

- No new wallet operation type, backend service, or dependency.
- No relaxation of unresolved-operation guards, logout/reset safeguards, or recovery records.
- No claim that live Signet marketplace atomic trading is available.
- No broad UI redesign of Account, Marketplace, or Admin controls.

## Decisions

### Decision: Treat transient guards as live-attempt coordination only

Use maps and booleans only to prevent duplicate work while the attempt is active. Once the attempt promise settles, remove the map entry or clear the flag in a `finally` path. If a submitted or unknown operation still needs protection, rely on durable records and reservations, not a retained in-memory promise.

Alternative considered: keep completed promises cached for idempotency. This caused the observed failure mode: an unavailable or skipped result can be replayed from memory after the condition clears. Durable operation IDs already provide safe idempotency without poisoning fresh attempts.

### Decision: Persist skip/attempt markers before readiness exits that must not later start

For LTO Start, same-session skip semantics require durable evidence even when readiness is missing. The controller should persist the same-session attempt marker before returning a readiness unavailable result that must never "late start." Fresh Start sessions use a distinct session ID, so they are not blocked by the prior marker once the in-memory promise is removed.

Alternative considered: treat readiness failure as entirely transient and unmarked. That would allow stale async paths or reload recovery to start a session that the host had already skipped.

### Decision: Normalize legacy networkless records at store boundaries

When a network-scoped store returns an older account record without `network`, operation checks may compare it as the selected active network. If a record explicitly names a network, that value remains authoritative. This preserves older saved accounts while keeping cross-network isolation intact.

Alternative considered: require every loaded record to contain a network before any operation. That is safer in isolation but creates false unavailability for legacy records that were loaded through an already network-scoped store and whose balances/readiness are otherwise current.

### Decision: Keep batch state per item, not per run outcome

Marketplace H1/H2 should classify each item by durable operation identity and fresh eligibility. A failed or unknown item result can affect that item, but it must not permanently block untouched items once the item attempt settles. Batch helpers should report item-level outcomes and revisit all eligible items on later invocations.

Alternative considered: abort a batch on first unknown. That minimizes live work, but it contradicts the existing requirement that H2 continues checking other eligible items when disjointness can be proven.

### Decision: Verify through focused unit tests first, then browser fixtures where controls expose behavior

The primary regressions live in controllers and service boundaries, so tests should first cover those units deterministically. Browser checks should be reserved for G2 developer controls or Admin batch flows where visible behavior can otherwise diverge from unit behavior.

Alternative considered: only manual browser verification. That would miss same-service-instance cache bugs and race-specific stale promise behavior.

## Risks / Trade-offs

- [Risk] Clearing a transient cache too early could allow duplicate submission. → Mitigation: clear only after the attempt promise settles, and assert durable operation records/reservations exist before any network submission boundary.
- [Risk] Marking LTO attempts earlier can make a not-ready same session permanently skipped. → Mitigation: that is the intended session contract; fresh explicit sessions use fresh session IDs.
- [Risk] Legacy network normalization could hide a real mismatch. → Mitigation: normalize only undefined network values loaded by network-scoped stores; explicit mismatches still fail before signing or submission.
- [Risk] Batch continuation after unknown outcomes could touch inputs that are not disjoint. → Mitigation: continue only when existing input/reservation checks prove disjointness; otherwise skip the item for later reconciliation.
- [Risk] Focused tests may not prove live Signet behavior. → Mitigation: do not claim live acceptance from isolated tests; use live verification only where existing specs already require it.

## Migration Plan

1. Add failing regression tests for stale LTO attempt cache, LTO same-session skip marker, legacy networkless active records, burn batch continuation, and asset operation transient guard release.
2. Patch controller state cleanup and durable marker ordering in the smallest affected modules.
3. Update marketplace batch helpers to report and clear per-item transient state while preserving durable per-operation records.
4. Run focused unit tests for changed services and admin helpers.
5. Run relevant browser fixtures for G2 LTO controls and marketplace/admin batch flows if their visible behavior changed.
6. Rollback is ordinary code revert of the affected implementation files; durable record formats are not changed.
