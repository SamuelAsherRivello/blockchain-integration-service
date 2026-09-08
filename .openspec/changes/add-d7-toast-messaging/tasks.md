## 1. Shared notification API and delivery

- [x] 1.1 Add the focused context-owned notification module, `BisContext.showToast`, and exported options type; verify with Node tests that logged-out calls require no wallet work, blank text is ignored, durations normalize correctly, and independent contexts do not share messages.
- [x] 1.2 Implement FIFO entry identity and presentation lifecycle controls; verify duplicate strings remain separate entries, submissions during every phase preserve order, pre-mount messages retain their full lifetime, and disposal prevents delivery.

## 2. Shared runtime presentation

- [x] 2.1 Add the toast component and runtime overlay slot through `BisView`/`PendingOperations`, outside the account screen's visibility condition and inert wrapper; verify in a browser fixture that notifications appear with Account closed and alongside a pending/error dialog without changing its focus or acknowledgment behavior.
- [x] 2.2 Implement entering, visible, and exiting phases with the 3000 ms default hold, duration override, and top-edge CSS clipping; verify under a controlled clock that entry/exit are excluded from the hold and the next entry waits for the preceding exit.
- [x] 2.3 Add polite per-message announcements, literal text rendering, wrapping, pointer pass-through, and reduced-motion handling; verify focus remains unchanged, markup is text, duplicate messages update the live announcement, and reduced motion retains holds and order without sliding.
- [x] 2.4 Connect timer and queue cleanup to real UI unmount and context disposal with stale-callback guards; verify unmount/remount, new submissions after unmount, account navigation, and StrictMode replay do not replay old notifications, leak timers, or lose valid entries.

- [x] 2.5 Add optional `imageUrl` input, left-hand proportional thumbnail, bounded image preparation with text fallback, and trophy icon mapping; verify missing/broken/stalled images, full hold after preparation, and cleanup in unit and browser checks using the existing trophy artwork.
- [x] 2.6 Update visible runtime bounds after scrolling into view; verify the real demo at 390px width shows the toast inside nonzero runtime bounds after scrolling from Admin to Preview.

## 3. D1 Admin demonstration

- [x] 3.1 Add D. UI and D1 Show Toast in `AdminPanel`, wiring `App` to the active context's public notification method with `This is a test message from BIS.`; verify the real button works logged out and Account-open, three clicks produce three toasts, and existing Admin actions retain their behavior.
- [x] 3.2 Extend the Admin tests and add an independent toast host fixture using the public integration API; verify production rendering is shared and neither demonstration needs wallet mutation or mock payment outcomes.
- [x] 3.3 Rename the existing Tools section to E. Admin Tools and number its existing actions E1. Fund Signet Sats and E2. Open On Mempool.space; verify exact labels, existing callbacks, and disabled states in Admin tests without invoking live funding.

- [x] 3.4 Add D2 Show Toast With Icon beside D1 using existing local trophy artwork; verify its callback, left-hand loaded image, and shared queue wiring with text-only samples.

## 4. Integrated acceptance and documentation

- [x] 4.1 Verify the real demo and independent host in a foreground browser at narrow/mobile dimensions and preview scales 100%, 50%, and 25%; record visible entry, complete hold, full exit, queue order, override duration, runtime containment, focus, reduced motion, and pending/error coexistence, with screenshots or equivalent observations. Inspect live-region behavior and record any unperformed assistive-technology check honestly.
- [x] 4.2 Run `npm test` and `npm run build` (which includes typecheck); record results and resolve regressions caused by D1 without reporting unrelated pending wallet checks as completed.
- [x] 4.3 Update D1's proposed documentation status only to match delivered behavior, keep its table-of-contents anchor and diagram synchronized, and record acceptance evidence under this change; verify the user-story documentation check and `openspec validate add-d7-toast-messaging --strict` pass.
- [x] 4.4 Reconcile delivered Admin labels with the documented D. UI and E. Admin Tools sections and X1-X6 appendix; verify every internal documentation link resolves, old account-selection handlers still work, and historical change links retain their original targets.

