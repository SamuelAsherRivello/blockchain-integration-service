# Design

## Context

See proposal.md and the completed foundation's milestone.md. Vaults, Shared configuration, durable grants/reservations, Admin/Marketplace owned sessions, read-only joined Marketplace, and initial payment/funding/Swap adapters already exist. The supplied accounts have prior history and reported pending Signet onboarding; their labels are not readiness evidence.

## Goals / Non-Goals

Complete the original autonomous ecosystem workflow and prove it on each network/application. Preserve existing operation IDs, funded identities and independent journals. Do not rebuild the foundation, copy browser databases, export recovery phrases, infer readiness from cached labels, or add a hosted signing service.

## Decisions

1. Extend the existing owned adapter registry and public inspection boundary. Add game restoration with muted URLs and verified public package provenance. Prefer normal private Account UI to storage injection; app-specific persistence must remain independent.
2. Add independent owned UI actions without weakening exact origin/identity/network checks or recovery-entry privacy. Keep joined mode's small navigation allowlist separate rather than letting generic actions bypass it.
3. Complete readiness/preparation using fresh timestamped balances, holdings and pending-operation reads. Use existing funds first, separate faucet/registered-wallet funding as needed, and saved operation/asset IDs for partial retries. Unavailable reads never mean zero.
4. Complete onboarding through the separately delivered window-scoped production route. Capture original BTC inputs and the 50% target before automatic eligibility. Reconcile both intended Arkade output and Bitcoin remainder, then independently re-read BIS. Do not copy onboarding journals or switch/reset a pending window.
5. Investigate the concrete live Swap Review-control timeout using public status and bounded read-only checks. The isolated amount-edit availability regression is fixed, but is not proof of the live cause. Reconcile any existing intent before retry; never invent successful conversion.
6. Implement mint/delivery, burn, contract claim/refund and conservative zero-holdings rotation using product guards. Archive encrypted generations; preserve pending and uncertain work. Drain/reset is not rotation.
7. Verify exact scenario/network/application cells and real joined-human attachment separately from isolated coverage. Record product background activity separately from runner-initiated actions. Standing permission covers registered test identities only, not joined humans.

## Risks / Trade-offs

- [Funding lost acknowledgement] → Keep original reservation and reconcile; do not resend, including the existing unknown Signet faucet request.
- [Supplied Signet onboarding pending] → Re-observe and reconcile before mutating; prior user reports are not live proof.
- [Parallel onboarding or asset work] → Consume verified production behavior and public APIs; avoid committing other proposals' changes as fixes.
- [Full-suite failures] → Triage each current failure and attribute it; rerun complete gates on the final integrated state.
- [Insufficient live prerequisites] → Report the exact unmet dependency and leave that acceptance checkbox open.

## Migration Plan

Continue from the committed foundation without replacing identities or deleting local secrets. Stage test changes separately from unrelated tasks. Preserve encrypted backups and operation journals for rollback. The original unsplit plan in inherited-scope.md is historical traceability; current proposal/spec/tasks define this follow-up.
