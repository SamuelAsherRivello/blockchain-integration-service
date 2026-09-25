## 1. Implementation (after explicit apply request)

- [x] 1.1 Update only the Account catalog/rendering in AdminPanel.tsx to show the A. Account heading, `Stories: A1, A2, A3, A4, A5, A6`, and A1 Account Button / A4 Account Dialog in order; verify the rendered Account section contains exactly two buttons with the existing IDs, callbacks, selection and disabled states.
- [x] 1.2 Add shared summary spacing and wrapping only if needed; verify wide and narrow Admin widths show no overlap or horizontal overflow and other sections change only by the added summary line.
- [x] 1.3 Update affected Account entry references in the demo README and user-story documentation to use Account Dialog and production navigation; verify story IDs, story titles, pending evidence status, and unrelated sections remain intact.

## 2. Integration verification

- [x] 2.1 Run `npm run typecheck` and `npm run build`; record results and distinguish any pre-existing failures from this change.
- [x] 2.2 Verify both entry paths in a real browser: A1 renders the production button, A4 opens the current-state Account dialog, and both retain open/close guards; use isolated account fixtures to verify creation/restoration, details/activity, logout, receive/send, and transfer remain reachable without submitting transactions or clearing real account data. Record the tested URL and results.
- [x] 2.3 Review the scoped diff and browser rendering to confirm Pay-to-play, Assets, UI, Admin Tools, Game Wallet controls, Console, and Reset Client remain unchanged apart from requested story summaries; record concise evidence in this change directory.


## 3. Additional requested summaries

- [x] 3.1 Add ordered Stories lines to B, C, D, E, and F, preserving their controls; verify exact IDs and heading-summary-control order in the browser.

