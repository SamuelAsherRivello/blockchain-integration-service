## Context

See proposal.md for scope. Core currently uses singleton transfer/send records and blanket guards. Transfers select eligible inputs broadly, while mint calls assetManager.issue without pinning its selected inputs. Removing guards alone would neither preserve multiple attempts nor prevent reuse of pending inputs.

The 2026-09-04 investigation records a 1,000-sat withdrawal against a VTXO and an account balance of 289,715 sats. These are recorded observations, not a fresh wallet inspection. Reserving an input reserves its entire value, including expected change, not merely the requested withdrawal amount.

Existing cancellation findings describe an upstream queue-selection/deletion race and no verified deployed terminal receipt. Official documentation describes proof-based deletion with an empty response and permits no-expiry registration: https://docs.arkadeos.com/arkd/components/intent-system (read 2026-09-04). This proposal does not establish cancellation feasibility.

## Goals / Non-Goals

**Goals:** Isolate uncertainty to attributable inputs; preserve recovery and explicit authorization; expose what the user can actually do now.

**Non-Goals:** Undo settled transactions, bypass operator validation, force-clear uncertainty, silently split/fund coins, implement a custom backend, or promise this existing account has any independent funds. Log Out/Reset relaxation and portable recovery import are deferred.

## Decisions

1. Use an account/network/operator-scoped multi-operation journal. Each operation stores stable ID, kind, immutable request, all input outpoints, phase, public network identifiers and outcome evidence. Keep the existing same-origin mutation lock for atomic reserve/revalidate/submit boundaries, not for the lifetime of pending operations. Persist before the earliest network mutation. A singleton with a bypass was rejected because later attempts would overwrite recovery state.
2. Derive reservations from all unresolved records. Unknown/corrupt input sets produce an explained spending hold until reconstructed or terminally resolved. Never assume missing inputs mean an empty reservation. Reconcile records independently; completion of one releases only its reservations. Foreign-account records remain stored but are not shown as the active account's transactions.
3. Compute eligibility from fresh SDK coins minus reservations. Quotes, Max, fees and confirmation use this same set. Confirmation revalidates under the lock and durably reserves actual inputs. The Arkade adapter must constrain and inspect final transaction inputs, including issuance fee inputs, before network submission. Balance subtraction alone is insufficient. If the public SDK cannot enforce mint selection, report mint specifically unavailable and continue the other deliverables; do not substitute private SDK calls or an unapproved upgrade.
4. Account recovery lists pending operations independently from the new-operation form. Show requested amount, full reserved input value where verified, available funds, last check, status and allowed actions. Unknown totals display unavailable. Explain that reserved funds are part of the balance, not an additional balance. Normal UI uses plain language; public IDs and outpoints belong in recovery details. Public APIs expose JSON-safe operation summaries and per-action availability/reason codes, not SDK objects.
5. Recovery offers Check Status, Copy Recovery Details and Back. A proven never-submitted draft can be explicitly discarded and retained as not-submitted. For submitted work, Cancel Pending Transfer is enabled only under D5b's verified operator contract. Otherwise explain why cancellation cannot be verified without presenting a pretend working cancel button. An acknowledgement is not a cancelled outcome. Completed transactions have no Undo action; any later reverse movement is a new separately reviewed transaction.
6. Show manual receiving guidance if there are no independent funds. Newly received independently spendable coins may enable work after fresh verification; funding is never automatic. Reuse Receive. Neither another deposit nor a new operation resolves the old transfer.

## Risks / Trade-offs

- Whole-input reservation can reserve the entire account for a small transfer → show actual reserved value; do not claim that removing a guard frees those funds.
- Legacy pending mint lacks known inputs → reconstruct through supported evidence or keep an explicit hold, never guess.
- Old tabs and application versions can overwrite singleton state → require closing/reloading old tabs before migration and check a versioned migration marker on every new mutation path. Same-origin locks cannot coordinate independent devices or older code that ignores the marker; disclose this limitation and require one active app version for the account.
- Provider reads cannot prove cancellation finality → retain affected reservations and expose operator handoff details without blocking unrelated feature delivery.
- Persistence failure or storage eviction undermines recovery → stop submission on storage failure; document that browser recovery state must be preserved.

## Migration Plan

Import valid legacy records under the mutation lock into the versioned journal, preserving original fields and originals. Verify import before enabling the new writer; do not delete recovery history. Invalid or incomplete unresolved records remain recovery-required. Test reload, multiple pending records and failed migration. Reconcile affected deltas with existing active transfer/send/mint/cancellation plans before implementation, retaining outstanding verification tasks.

Roll out recovery inspection first, then tested per-operation availability and adapters with proven input control. Rollback disables new mutations and retains the new journal; never run an older singleton writer against multiple pending records. Cancellation remains a separately reported conditional milestone.
