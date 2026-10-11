# Tasks

## 1. Define the view capability and shared interaction boundary

- [x] 1.1 Add the per-view boolean back-dismissal contract and thread the active view’s existing Back callback through the shared BIS presentation boundary; verify TypeScript compilation still succeeds for the integration package.
- [x] 1.2 Add Escape handling that invokes the current eligible view’s Back callback once, respects busy/closing guards, and yields to the Pending Operation Dialog or other higher-priority modal surface; verify with focused keyboard interaction tests.
- [x] 1.3 Add backdrop pointer handling that distinguishes outside-card clicks from card-content clicks and delegates only eligible outside clicks to Back; verify controls inside the card remain operable in browser/component tests.

## 2. Audit and wire every BIS view

- [x] 2.1 Manually inventory the shared account, recovery, onboarding, wallet, collection, list/detail, loading, and error views and declare the back-dismissal boolean for each; verify the inventory records true only where an existing Back or cancel destination is valid.
- [x] 2.2 Preserve local Back behavior for Assets, Contracts, Transactions, and their detail states while wiring their current handlers into the shared boundary; verify Escape/backdrop from detail returns to the matching list before closing the account.
- [x] 2.3 Keep loading, terminal error, pending-operation, account-entry, and busy/closing surfaces non-dismissible unless they already expose an explicit cancel action; verify pending coverage prevents interaction with the underlying view.

## 3. Regression coverage and integration verification

- [x] 3.1 Add regression tests for enabled views using Back, Escape, outside-card click, inside-card click, repeated input, and focus restoration; verify the tests pass in the integration client test suite.
- [x] 3.2 Add regression tests for disabled and covered views, including loading/error/pending states and busy operations; verify no unintended navigation or duplicate action occurs.
- [x] 3.3 Run the relevant integration typecheck, tests, and production build; verify all commands pass and the existing navigation/view-transition behavior remains intact.
