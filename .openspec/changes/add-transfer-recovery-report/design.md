## Context

AccountTransfer already consumes account-scoped BisTransferStatus through Check Status. It shows unresolved warnings but offers no selectable report or copy handoff. Existing CopyFieldLabel and Account Activity provide the styling and clipboard feedback pattern. Actual cancellation remains separately blocked in cancel-pending-transfer (D5b).

## Goals / Non-Goals

**Goals:** Complete D5a with deterministic formatting, explicit copy and browser verification independent of cancellation feasibility.

**Non-Goals:** New SDK APIs, secret access, changing persistence/guards, automatic outreach, cancellation, live payments or a new Admin story button. Completion means the report works, not the transfer is resolved.

## Decisions

- Add a pure internal core formatter consuming existing public BisTransferStatus. No new host API or SDK access. Output only pending reports; UUID IDs and 64-hex commitment IDs are syntax-checked, enums map to fixed text, and sats must be a positive safe integer. Invalid/missing fields use fixed unknown labels; never interpolate raw errors or arbitrary properties.
- Add a small Recovery details component using native details/summary, existing copy control and wrapped read-only textarea. It is mounted only for pending state. Exact text is copied on click, with pending/success/failure feedback scoped to the current report and component lifetime. Manual selection remains available if clipboard is absent/denied.
- Use a constant snapshot disclaimer rather than inventing timestamps. A thrown subsequent status check marks existing pending status verification unavailable. During checks disable copy and mark the report busy; the next result replaces it. Existing status polling and mutation guards remain unchanged.
- No added dependency, backend, route or storage schema. Reuse the Account Transfer entry in production and the D4 Admin demo. D5 is the documentation umbrella; D5a and D5b each have their own proposal/status/acceptance criteria.

## Risks / Trade-offs

- Public IDs can reveal financial activity → Show explicit trusted-support sharing guidance; do not auto-send or include balances/addresses.
- Previously successful checks becoming stale → Snapshot disclaimer, busy state and unavailable marking after errors.
- Clipboard completion after a status change → Match feedback to report and ignore stale/unmounted results.
- Recovery report confused with cancellation → Explicit no-cancellation/no-resubmission guidance; D5b remains blocked and separate.

## Verification

Failing then passing core formatter tests; isolated real-browser fixture for rendered text, copy success/failure, status updates, disappearance and unchanged journal/mutation counts. Run integration tests, demo documentation tests and build. No live cancellation or payment is required for D5a acceptance.
