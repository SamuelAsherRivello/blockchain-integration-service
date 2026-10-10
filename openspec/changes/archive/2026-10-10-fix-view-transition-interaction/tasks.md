# Tasks

## 1. Restore active-surface interaction

- [x] 1.1 Update the shared view-transition styling so every active surface's direct content root restores pointer interaction while exit surfaces remain non-interactive; verify the rule preserves the existing transition and overlay selectors.
- [x] 1.2 Extend `BIS/packages/integration/tests/client/view-transition.test.mjs` to assert the active-content interaction contract and the continued non-interactive exit boundary; verify the focused view-transition test passes.

## 2. Cover the reported Restore Account flow

- [x] 2.1 Extend the Restore Account host/browser verification to focus and edit a recovery-word field and exercise the visibility and Back controls through the transitioned surface; verify the existing isolated restoration checks still pass.

## 3. Verify shared coverage

- [x] 3.1 Run the relevant integration UI tests and inspect all current `ViewTransition` composition branches for the shared interaction rule; verify every supported transitioned view remains interactive without page-specific pointer-event workarounds.
