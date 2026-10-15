## 1. Shared Admin Dialog

- [x] 1.1 Add the demo-owned `AdminDialogFullscreen` component with native modal lifecycle, labeled title, upper-right `X`, guarded cancel/close behavior, workflow content, and focus restoration; verify focused component tests cover open, close-disabled, cancel, and restored-focus behavior.
- [x] 1.2 Add the shared dialog CSS with 10% top/bottom and 25% left/right viewport margins, border-box sizing, backdrop, internal scrolling, disabled and focus-visible states; verify computed dimensions and overflow in a real browser at wide and narrow viewports.

## 2. Mint Asset Composition

- [x] 2.1 Refactor `MintAssetDialog` to use `AdminDialogFullscreen` while preserving all existing mint state, destination, validation, recovery, submission, and busy behavior; verify the existing mint destination and Admin asset tests pass.
- [x] 2.2 Reorder existing Mint Asset content into Quick fill, Preview, and Form sections, in that order, with destination and existing inputs in Form; verify a focused markup/browser test asserts heading and control order and confirms preset edits still update Preview and Form.
- [x] 2.3 Move the current mint guidance/status calculation below the Mint/Done action into a safely rendered dialog console output region; verify focused tests cover default guidance, validation, checking, minting, success, and returned-error messages below the action.
- [x] 2.4 Remove obsolete Mint-specific dialog/header/back-arrow layout styles and retain only workflow-specific field, preview, action, and console styling; verify the rendered Mint dialog has one upper-right `X`, no back arrow, and no old spacer markup.
- [x] 2.5 Place Destination and Control Asset in one equal-width row and conditionally render the Icon URL image in a fixed-footprint Preview; verify focused tests and browser checks cover the 50/50 layout, stable Preview dimensions, preset icon, edited icon, and blank icon fallback.
- [x] 2.6 Add Clear as the leftmost Quick fill action and reset the editable draft to fresh defaults without changing Destination; verify focused tests and browser checks cover ordering, reset values, blank icon fallback, destination retention, and a fresh operation ID.

## 3. Regression And Visual Verification

- [x] 3.1 Run the focused Admin asset, Mint destination, and shared-dialog test coverage and verify there are no behavior regressions in wallet selection, submission locking, pending recovery, or close guards.
- [ ] 3.2 Run `npm run typecheck`, `npm test`, and `npm run build` from the repository root and verify all checks succeed without changing dependencies.
- [x] 3.3 Start the integration demo with the documented strict port command, verify HTTP 200, and inspect C1 in a real browser for exact margins, section order, scrolling, `X` placement, action-before-console output, keyboard focus, and wide/narrow layouts; save non-secret evidence under `output/screenshots/admin-dialog-fullscreen/`.
