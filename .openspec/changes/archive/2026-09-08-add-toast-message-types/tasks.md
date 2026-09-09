## 1. Public types and queue

- [x] 1.1 Add the exported MessageType values/type and optional messageType option, resolve missing/invalid values to info, and verify public typechecking plus queue tests for all four values and unchanged duration/FIFO behavior.

## 2. Presentation

- [x] 2.1 Add four SVG icons and coordinated background/border/text styles to ToastViewport and overlay CSS; verify every type renders an icon and message without a visible category prefix.
- [x] 2.2 Preserve optional artwork and legacy icon compatibility while always showing the type icon; verify image success, failure and timeout coverage and no overflow at narrow widths.
- [x] 2.3 Include type in the polite accessible announcement and retain nonblocking focus/reduced-motion behavior; verify announcements occur once and contrast meets the spec.

## 3. Producers and wording

- [x] 3.1 Classify payment notifications, continue states, collection success and D1/D2 using the design mapping; verify emitted types with producer tests, including dynamic errors.
- [x] 3.2 Convert built-in messages to sentence case, preserving Arkade, Bitcoin, BIS and exact identifiers; verify receipt, transfer and trophy examples and unchanged literal host strings.
- [x] 3.3 Reconcile affected exact-message documentation and planning assertions, including the prior F3 change, without altering payment semantics; verify the all-toast inventory agrees with the final producer text and classifications.

## 4. Verification

- [x] 4.1 Run toast, image, payment notification, continue and collection regressions plus typecheck and build; record results and distinguish unrelated checkout failures under output/reports/toast-message-types/.
- [x] 4.2 Verify all four types in a real browser using an isolated test fixture, including long text, optional artwork, 9:16 preview scaling, pending-dialog coexistence and queue transitions; save screenshots under output/screenshots/toast-message-types/.
- [x] 4.3 Document MessageType and the backward-compatible default with a usable API example; verify examples typecheck and OpenSpec validation passes.
