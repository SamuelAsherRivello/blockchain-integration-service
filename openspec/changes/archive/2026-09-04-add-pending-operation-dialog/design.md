## Context

See proposal.md. Loading comes from shared core snapshots and local Send, Transfer and Burn components. Activity's observer outlives its initial result. Asset confirmation currently shares a busy flag with submission. Existing work in the checkout must be preserved.

## Goals / Non-Goals

Render page and covering layer together; reveal only prepared content. No new wallet operations, background blocking, external dependencies, public API changes, or migrations.

## Decisions

- A React coordinator owns one host-scoped overlay. Core snapshots and child layout-effect signals contribute operation labels/errors. Layout effects settle focus, child state and image readiness before paint. Keep the rendered content mounted and inert under the overlay. Avoid document-modal showModal for this layer because Admin must remain interactive.
- Data reads use a shared bounded retry helper with one retry and linked per-attempt AbortControllers. Preserve Activity 75s and Assets 30s; add 30s where absent. Do not wrap mutation submission in retry. Activity resolves readiness on the first snapshot while preserving ongoing observation.
- Scope transient signals to component/page/account lifetime. Failed operations latch until OK; acknowledgement invokes the source page's parent navigation, and never discards transaction journals.
- Keep Burning... through its refresh and image preparation. Remove inline async progress/completion messages, not transaction facts, empty results, input validation or clipboard feedback.
- Asset images load/decode or use local fallback within a bounded preparation phase. Reuse existing dialog/bolt CSS, with an absolute backdrop scoped to the runtime host and keyboard containment.
- Use outcome-not-confirmed plus OK for uncertain submissions, as accepted in the implementation request. Existing reconciliation remains authoritative.

## Risks / Trade-offs

- Multi-stage renders can flash → test delayed initial data, chained refresh and image preparation in a real browser.
- Read retry can duplicate mutation → separate read helper from submit handlers and assert one burn/send submission.
- An old callback can clear a new overlay → use request generations, unmount cleanup and keyed account/page signals.
- Existing specs include stale UI descriptions → delta only affected presentation requirements; do not rewrite unrelated concurrent changes.

## Migration Plan

No stored-data migration. Deliver code, updated fixtures and documentation together. A rollback is an additive change reverting this presentation layer, without modifying wallet records.
