## Context

The core currently runs a retained payment observer and a page-owned Activity observer. Both use `watchActivity` in production. `observeActivityWallet` already reads SDK history and boarding UTXOs, uses incoming notifications to accelerate reads, and reconciles every 15 seconds. It has abort, timeout and disposal handling. Incoming notification eligibility currently controls balance refresh. See proposal.md for the resulting B1 defect.

## Goals / Non-Goals

Goals: share the existing SDK observer, fan out history safely, refresh visible wallet data regardless of transaction direction, and retain local confirmation as an immediate invalidation signal.

Non-goals: change transaction submission, wallet custody, operation recovery, game APIs, network or dependencies. A logical subscription does not promise uninterrupted network delivery or SDK support for every event type.

## Decisions

- Introduce a core sharing adapter around the existing observer contract. It multiplexes subscribers, retains only an in-memory live snapshot, propagates failures, aborts when no subscribers remain, and supports explicit fresh reads by restarting the one source. This retains the established bounded foreground loading path instead of replacing its error contract.
- The retained account subscriber and foreground Activity subscriber share that adapter in production. Explicitly distinct test observers retain dependency injection semantics.
- Every successful observation invalidates visible balance/asset reads, including unchanged history snapshots: spendability can change without a new history row. Abort superseded reads and issue a replacement; burst signals coalesce within a microtask. Automatic observer reconciliation preserves an already ready Balance view while reading in the background. Initial loads and explicit manual/local-operation refreshes retain the foreground loading indicator. A delayed snapshot must not reopen the loading window after local payment completion. Failed background reads still clear amounts into the existing unavailable state. Notification filtering only governs toasts.
- Confirmed local continuation, send, transfer, mint and burn paths use the shared invalidation entry point. Local signals request a fresh history snapshot; observer snapshots do not recursively restart observation.
- Keep the existing SDK notification plus 15-second reconciliation fallback and 10-second background reconnect. Foreground manual refresh requests a fresh shared source and retains its 75-second first-read deadline and retry.

## Risks / Trade-offs

- Incomplete notification coverage → periodic SDK reconciliation covers fresh history/UTXO evidence; do not claim instantaneous external delivery.
- Rapid updates or slow reads → coalesce bursts, abort old reads, and preserve existing request/version guards.
- Observer failure or account replacement → clear replay snapshots, propagate unavailable status, and reject stopped-session callbacks.
- Test fixtures are synthetic evidence → use them for lifecycle and rendering assertions; do not report them as live Signet transactions.

## Migration Plan

No persistent migration. Ship the integration build with shared observation; reverting through an additive follow-up code change requires no wallet or journal changes.

## Single visible payment refresh refinement

The implemented local path refreshes Balance and restarts observation. Its asynchronous snapshot then invalidates Balance again, beyond the microtask batching window. Keep both authoritative reads but distinguish foreground loading from background reconciliation; do not ignore the next event or use a time-based suppression window, which could discard an independent payment. Retain existing request-version guards and account cancellation.
