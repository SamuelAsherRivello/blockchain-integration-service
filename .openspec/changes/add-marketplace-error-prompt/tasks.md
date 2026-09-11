## 1. Shared BIS error prompt

- [x] 1.1 Update the shared Pending Operation Dialog terminal-error variant to render the exact `Error` title, its supplied error text as body copy, no lightning bolt, and the existing OK acknowledgement; verify `BIS/packages/integration/tests/pending-operation-dialog.test.mjs` covers both loading and terminal-error markup.

## 2. Marketplace consumption

- [x] 2.1 Preserve Marketplace's `PendingOperations` and `usePendingNotice` public BIS composition without local error-modal markup or CSS; extend `BIS/packages/marketplace/tests/pending-operation-prompt.test.mjs` to verify the shared error state is the Marketplace failure presentation.

## 3. Verification

- [x] 3.1 Run the focused integration and Marketplace prompt tests, then `npm.cmd run typecheck` and `npm.cmd run build`; verify all pass with no new dependencies.
- [ ] 3.2 Run Marketplace in a real browser and trigger a safe terminal failure; verify the darkened centered prompt retains the loading frame, reads `Error`, shows the error text as body copy, omits the bolt, blocks covered controls, and acknowledges with OK; save non-secret evidence under `output/screenshots/marketplace-error-prompt/`.
