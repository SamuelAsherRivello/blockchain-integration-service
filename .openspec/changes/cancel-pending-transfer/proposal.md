## Why

A registered transfer can remain unresolved after interrupted signing, blocking further wallet mutations, Log Out and Reset. Players need an explicitly confirmed cancellation recovery path that preserves these protections until the operator outcome is verified.

## User Story and Independence

**D5b — Cancel Pending Transfer:** As an account holder with an unresolved transfer, I want to explicitly cancel that operation when safely supported, so I can use the account again without risking duplicate spending.

D5a. Inspect and Copy Transfer Recovery Details is independently delivered by [add-transfer-recovery-report](../archive/2026-09-04-add-transfer-recovery-report/proposal.md). D5a is a read-only handoff, not partial cancellation implementation; it does not depend on this feasibility gate or resolve the pending transfer. D5 remains the documentation umbrella for these two stories.

This proposal does not implement D3a new sending. D3a in `add-d3a-address-sending` is delivered independently using clean accounts/isolated tests; the existing pending account remains protected. No D5 feasibility gate is a prerequisite for writing or testing D3a. D5 is not being implemented as part of the current D3a apply.

## What Changes

- Add Cancel Pending Transfer to production Account Transfer for eligible same-account unresolved operations, with a separate confirmation showing direction, amount and public operation identifiers.
- Request signed cancellation only after confirmation, through the Arkade adapter with automatic settlement disabled; never resubmit or resume the original transfer.
- Persist cancellation progress and evidence without erasing the original transfer journal or storing signing material. Lost responses and cancellation/settlement races remain unresolved until authoritative reconciliation.
- Release existing guards only for verified terminal cancellation or existing verified transfer completion; require a fresh review and confirmation for any later transfer.
- Track D5b. Cancel Pending Transfer as a separate story linked from D4 and D5a, with its own status, flow and acceptance criteria. The production entry remains Account Transfer; no separate Admin bypass is introduced.
- Gate cancellation availability on verified SDK/operator targeting and finality semantics. A successful HTTP response alone is not assumed to rule out an already-running settlement.
- Resolve feasibility before building cancellation code or UI. If the gate cannot pass, stop and report the blocker; disabled UI is not delivery. The current gate is blocked; see FEASIBILITY.md.

## Capabilities

### New Capabilities

- `account-transfer-cancellation`: Explicit, account-scoped cancellation, durable recovery, evidence-based guard release and production presentation.

### Modified Capabilities

None in the current main specs. This change extends the unarchived `add-bitcoin-boarding-settlement` transfer capability without duplicating or rewriting its deltas; implementation and archive must reconcile that dependency first.

## Impact

- Integration core operation storage/state, public context API, Arkade cancellation adapter, Account Transfer UI and Activity formatter.
- Existing D4 demonstration, user-story documentation, unit/adapter/browser fixtures and Signet verification notes.
- Depends on the transfer journal and guards from `add-bitcoin-boarding-settlement`. Preserve unrelated pending changes, account identity and existing logout confirmation.
- No new backend, dependency upgrade, external sending, forced journal clearing, automatic cancellation, automatic retry or actual cancellation during planning.
- Unresolved technical gate: establish exact-input targeting, cancellation-versus-active-batch finality, replay behavior and a supported proof-construction API for the installed SDK/operator. The proposal does not claim the currently stuck transfer is already recoverable.
