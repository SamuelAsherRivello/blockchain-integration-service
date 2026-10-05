## Context

See proposal.md for motivation. Read-only inspection found:

- `core/context.ts` routes observer callbacks through `walletChanged(profile, false)` and `refreshBalanceView(true)`. Ready balances deliberately avoid a loading state on this path. `ui/client.tsx` already derives the Pending Operation Dialog from the page data state; `AccountBalances.tsx` clears amounts unless ready.
- `core/payment-notifications.ts` classifies pending as stage 1 and settled offchain as stage 2. It tracks a session baseline and canonical receipt references, but final messages currently have no suffix. Existing notification tests cover synthetic stable-ID transitions; they do not establish that the reported live F3 transaction reaches stage 2.
- `arkade/activity.ts` maps SDK `tx.settled` to `Settled offchain`. The shared wallet observer and existing reconciliation are the available production path. A balance change does not prove settlement. The exact live cause of missing stage 2 remains unverified and must be isolated with the same transaction's public evidence during implementation.
- `player-wallet-subscription` explicitly requires silent reconciliation after a local payment; the design-discussion also excludes background updates from runtime loading. This change creates a narrow exception for a new incoming Arkade receipt on visible Balance. The account-balance spec's older ban on subscription updates was already superseded by player-wallet-subscription.
- The payment main spec still contains historical 100-sat wording in another requirement, while current F3 code sends 1000. This change preserves the current amount; broad amount/spec cleanup is outside scope.
- Withdrawal/recovery edits are already present in context and adapter files. Integrate additively without discarding or implementing adjacent planning work.

## Goals / Non-Goals

**Goals:** Connect receipt transitions to one visible Balance read and reliable status feedback using the existing observer, pending dialog and toast queue.

**Non-Goals:** Changing F3 payment submission, amounts, balances' definitions, adding a network confirmation requirement to Arkade, or waiting indefinitely behind a loading dialog for settlement.

## Decisions

1. Expose structured receipt transitions internally from notification observation, or extract shared classification into an internal helper. The context needs a receipt identity and first-seen stage before choosing foreground refresh. Do not parse toast strings or bind balance loading to toast display time; notification presentation and wallet reads must remain independent.
2. Track first-seen live incoming Arkade receipts per account session. Promote the first visible Balance refresh for each new receipt to foreground; coalesce simultaneous events and preserve an active foreground read through duplicate callbacks. Reuse existing request cancellation/version checks and bounded read retry. Later observations remain silent. A blanket foreground refresh on every observer poll would regress the existing single-loading-cycle behavior.
3. Keep the existing pending toast unchanged and append ` (Confirmed)` to final incoming Arkade receipts. Interpret the user's “confirming” as notification that the receipt is confirmed, rather than inventing another intermediate network stage. Here confirmation means verified Arkade settlement. Keep own-transfer and Bitcoin final text unchanged.
4. Correlate pending and settled observations by stable public Arkade transaction evidence. Capture the failing transition in adapter/context regression tests before altering status normalization or identity rules. If SDK snapshots change identifiers, use supported transaction links rather than amount-only matching. Preserve sender attribution and one pending/final notification per receipt. Do not force a settled state because funds became visible.
5. Reuse existing event subscription plus reconciliation when events miss settlement. Do not add a second observer or balance polling loop. A failed/reconnected observer retains its current session baseline. Changed accounts abort old reads and notifications.

## Risks / Trade-offs

- Repeated snapshots could restart loading or cancel the foreground read indefinitely → test duplicate and overlapping snapshots with a held read, and retain one continuous foreground cycle.
- Provider settlement can arrive after balances update → keep the read bounded and the observer active; show confirmed only on actual evidence.
- The live missing-toast cause is not yet established → require same-transaction SDK evidence and report any provider limitation explicitly; unit tests alone do not establish live resolution.
- Toast can be obscured by the loading dialog → browser-check production layering and queue behavior together.

## Migration Plan

No storage or public API migration. Apply focused internal changes, run regressions and browser verification, then verify a real Signet F3 lifecycle with existing eligible wallets. Keep evidence under `output/reports/f3-receipt-feedback/` and screenshots under `output/screenshots/f3-receipt-feedback/`, without secrets. Roll back with an additive corrective change if needed; do not rewrite Git history.

## Confirmed implementation decision — 2026-09-08

The user selected confirmation of verified, spendable Arkade receipt rather than waiting for batch settlement. Installed SDK history marks an unspent preconfirmed receipt unsettled; this explained why awaiting its settled flag could leave a completed F3 payment Pending. The adapter now reads owned spendable VTXOs using the existing shared wallet with recoverable/unrolled funds excluded, matches the Arkade transaction ID and exact positive safe-integer amount across unique outputs, and exposes receiptVerified without changing the history settlement status. Only fresh healthy reads publish this evidence. New preconfirmed verified arrivals queue Pending then Confirmed; baseline history stays silent. This supersedes decision 3 and settlement-only acceptance wording above. No spend, settlement or balance-only inference is added.
