## Why

BIS has shared account and operation dialogs but no reusable way to deliver brief user-facing notifications without interrupting the player. D1 adds that messaging path and an Admin button that lets the user try the production toast presentation directly.

## What Changes

- Add a shared, account-independent BIS toast API and runtime presentation for plain-text notifications with an optional image on the left. A trophy notification supplies the trophy asset's image.
- Slide each toast down from the top of the runtime viewport, keep it fully visible for 3 seconds by default with an optional per-message duration, then slide it back up out of view.
- Queue messages in arrival order and display one at a time, including repeated identical test messages.
- Keep errors requiring acknowledgment in their existing dialogs. Toasts do not replace operation progress, confirmations, or recovery information.
- Add D1. Show Toast to the user stories and a D1 Show Toast action under a D section in Admin. It sends `This is a test message from BIS.` through the shared BIS API into Runtime Preview.
- Organize the story document as D. UI with D1. Show Toast, E. Admin Tools with E1. Fund Signet Sats and E2. Open On Mempool.space, followed by X. Appendix containing the former D1-D6 stories as X1-X6. Update its internal references and anchors while keeping historical change paths intact.
- Group the existing funding and explorer buttons under E. Admin Tools with those E1/E2 labels, preserving their handlers and availability rules.
- Include lifecycle cleanup, accessible announcements, reduced-motion behavior, and browser verification in the implementation scope.

Confirmed interview decisions are the error-dialog boundary, FIFO delivery, and a 3-second default with a per-message override. API spelling, animation timing, styling, and lifecycle details in design.md are proposed implementation defaults, not additional user-confirmed decisions.

## Capabilities

### New Capabilities

- `toast-messaging`: Shared BIS notification entry point, ordered delivery, timed presentation, accessibility, and context/UI lifecycle handling.

### Modified Capabilities

- `story-driven-demo`: Add D1 under UI, number the existing Admin tools E1/E2, and align documentation with the X appendix.

## Impact

- `BIS/packages/integration/src/core/context.ts` and a focused notification module: context-local notification state and public entry point.
- `BIS/packages/integration/src/index.ts`: exported notification option types.
- `BIS/packages/integration/src/ui/client.tsx`, `PendingOperationDialog.tsx`, a toast component, and `overlay.css`: shared runtime mounting and presentation outside account-screen visibility and inert content.
- `BIS/packages/integration-demo/src/App.tsx` and `admin/AdminPanel.tsx`: D1 action wiring through the public API.
- `BIS/documentation/User Story Diagrams.md`: proposed D1 story and flow.
- Existing Node tests and browser host fixtures: delivery, lifecycle, and presentation verification.

No new dependency, wallet operation, persistence, server, or external game repository edit is required. Existing operation-dialog requirements remain authoritative; no existing wallet outcome is automatically converted into a new toast by this change.

The Admin demonstration also includes D2. Show Toast With Icon, using existing trophy artwork to preview the optional left-hand image.
