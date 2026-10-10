# Design

## Context

See proposal.md for motivation. The current implementation constructs a BIS LTO service in the Admin app, starts a reconciliation interval, and calls reconciliation immediately. Reconciliation calls the shared notification path for records it observes. The Admin treasure controller separately polls its current session, while the game-facing contract boundary already supports exact session filtering.

The design must preserve durable contract storage, encrypted recovery material, input reservations, exclusivity, and exact receipt verification. The game-facing surface remains provider-neutral and the game repository is a separate consumer.

## Goals / Non-Goals

**Goals:**

- Make reconciliation trigger-aware: initialization and passive reads are silent; explicit Admin, game, or operation actions can reconcile.
- Keep unresolved operations visible and recoverable without deleting, replacing, or falsely resolving them.
- Make Admin Contracts the deliberate inspection boundary and make game level start the deliberate treasure-offer boundary.
- Ensure funding progress is represented in the initiating surface or game chest rather than replayed as a global startup toast.
- Preserve targeted safety checks before competing spends, claims, refunds, or replacement offers.

**Non-Goals:**

- No new application server, background service, or cross-device recovery system.
- No change to contract cryptography, receipt-verification rules, exclusivity semantics, wallet ownership, or reward amounts.
- No TreasureLTO-specific BIS UI or game-owned wallet secret handling.
- No automatic deletion or migration of existing unresolved contract records.
- No implementation in the separate game repository during this BIS change; its consumer integration is a follow-up coordination task.

## Decisions

### 1. Separate local restoration, query, reconciliation, and feedback

The LTO controller will treat these as separate operations:

```text
restore durable record  -> local only, silent
query contracts         -> read-only, silent
reconcile contract      -> provider-backed, explicitly triggered
present feedback        -> only when trigger owns a presentation session
```

The controller will carry reconciliation intent/feedback scope internally (for example, passive, explicit, or active-operation). Existing public query results remain provider-neutral. This is preferred over simply suppressing all toasts because it prevents app-load reconciliation from consuming network work while preserving meaningful feedback for user actions.

Alternative considered: keep startup reconciliation and only hide the toast. Rejected because it still performs unexpected provider work and can mutate cleanup state while the user is merely opening Admin.

### 2. Remove eager reconciliation and generic service polling

Creating a BIS LTO controller will not immediately call reconciliation and will not start an always-on interval. An explicit offer start or action may acquire an active-operation monitor that polls only while the operation is unsettled. The monitor ends after a verified terminal result, definitive pre-submission failure, cancellation, disposal, or an explicit lifecycle boundary.

This keeps recovery safety local to active work and avoids treating every browser refresh as an operation presentation session. A later Contracts-page status action can start a one-shot targeted reconciliation.

Alternative considered: retain a silent five-second service interval. Rejected for the current UX because it still performs hidden network activity on every Admin load and creates ambiguous ownership of cleanup.

### 3. Make Contracts navigation read-only and details/actions explicit

The Contracts page will use the existing account-scoped query to render current durable/live projections. It will not call reconciliation merely because it mounted. Contract Details will provide an explicit check/reconcile action for unresolved records; eligible Claim/Reject/Refund actions will use the same targeted status guard before submission.

This preserves the existing Contracts list as a truthful inspection surface while making the user’s intent the trigger for network reconciliation. Status changes are shown in the row/details view; only an explicit operation may opt into operation feedback.

### 4. Keep Admin Start LTO as an explicit demo action

The D.P.2 Start LTO button remains a deliberate developer trigger. The controller created for the story owns the active session, countdown, and operation feedback. Admin refresh, component mount, and unrelated contract queries cannot create or adopt a session.

Funding-pending state is written to the Console and represented by the current story/session state. A generic funding-pending toast is not emitted for the initial funding phase; verified late funding may use scoped feedback when it changes an explicitly started operation, especially when the offer has ended and funds are being returned.

### 5. Make game level start the game trigger

The game consumer will call the provider-neutral start operation when a level session begins. BIS will bind the offer to the level session ID and enforce existing readiness, exclusivity, reservations, and deadline rules. The game starts immediately and owns the chest UI.

When the chest is opened, the game queries the exact session reference. If the operation is still unresolved, the game may request a targeted check for that session and display preparation/pending state in the dialogue. The game never queries or acts on unrelated contracts.

The BIS package will document this lifecycle and expose only provider-neutral types. The separate game implementation will consume it after this change.

### 6. Scope toast deduplication to an active presentation session

The existing operation/phase deduplication will remain, but its lifetime will be tied to an explicit Admin action, game level session, or contract action rather than the lifetime of a newly constructed service. Passive startup reads will never call the feedback path. A fresh process can therefore observe the same pending record without replaying a toast, while an explicit action can still receive one meaningful pending or terminal update.

## Risks / Trade-offs

- [Risk] An unresolved operation may remain provider-unverified after a browser restart. -> Keep it durable and visible in Contracts; trigger targeted reconciliation on explicit inspection, action, or the next game lifecycle event.
- [Risk] Removing eager cleanup can delay refunds after expiry. -> Continue cleanup for explicitly active operations and ensure Contracts and new level-start paths can invoke targeted cleanup; document the deferred-recovery trade-off in acceptance tests.
- [Risk] A host may forget to establish an active operation monitor after an explicit start. -> Make the start/action controller own the monitor and test that it stops only at terminal or explicit lifecycle boundaries.
- [Risk] Existing consumers may assume reconciliation begins during service construction. -> Preserve read/query/action APIs, add lifecycle behavior tests, and coordinate the separate game repository migration before publishing a breaking package version.
- [Risk] A silent pending state may be mistaken for no offer. -> Preserve evidence freshness and explicit `pending`, `unknown`, `unavailable`, and empty distinctions in contract queries and chest UI.

## Migration Plan

1. Add trigger-aware reconciliation and feedback scope to the BIS LTO controller without changing durable record formats.
2. Change Admin and D.P.2 controller wiring to use explicit status checks and active-operation monitoring.
3. Update Contracts UI tests and LTO browser tests to prove refresh is silent and explicit checks remain truthful.
4. Update the public lifecycle documentation and coordinate the separate game consumer to start offers at level start and inspect them at chest interaction.
5. Validate existing unresolved records through read-only fixtures before and after controller recreation.

Rollback is code-level: restore the previous controller trigger wiring while retaining the durable record schema. No storage migration or destructive cleanup is required.

## Open Questions

- The exact label and placement of the explicit Contracts action (`Check Status`, `Reconcile`, or equivalent) can be finalized during UI implementation without changing the behavioral contract.
- The separate game repository must choose its existing level-session hook and chest query hook; the BIS contract remains session-scoped and provider-neutral.
