# Verification

- Production build and TypeScript check passed (npm run build). Existing chunk-size and mixed import warnings remain.
- 15 focused activity, recovery report and report scrolling tests passed.
- BIS/scripts/check-transaction-recovery.mjs passed on the development server and bundled demo fixture: exact action labels/count, selected report isolation, matching popup styling, copy success/failure, Back, blocked popup, disabled ordinary recovery/Explorer, no status checks, and compact 280px/360px popup layouts.
- Existing activity-host and updated activity-recovery-host browser harnesses passed. Removed an obsolete AccountTransfer setup/assertion from the recovery harness so it tests AccountActivity directly.
- Visually inspected output/playwright/transaction-recovery.png and output/playwright/recovery-info.png.
- Strict OpenSpec validation passed. No live wallet transactions or secret reads were used.

## User correction: in-BIS dialog

The user clarified that Recovery Info must open inside BIS. Replaced the browser popup with a portal into the BIS overlay using AccountCard and the shared clipboard hook. The underlying card is inert; Back and Escape restore trigger focus.

Production build/typecheck and development browser checks passed, including both activity harnesses. Verified no window.open call or extra browser page, selected report isolation, copy failure/success, Back, Escape, keyboard focus containment, and compact host widths. Visually inspected the current recovery-info screenshot.
