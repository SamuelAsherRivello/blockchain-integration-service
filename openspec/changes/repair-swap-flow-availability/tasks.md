# Tasks

## 1. Complete balance contract and cache

- [x] 1.1 Extend the provider-neutral balance type and Arkade balance adapter with validated Bitcoin-available and Arkade-available amounts, verifying the installed Signet SDK evidence and updating adapter tests for valid zero, mixed, invalid, and partial reads.
- [x] 1.2 Update context balance preparation, cache fixtures, and Account Details rendering so complete per-side availability is loaded and reused under the existing account/network/evidence scope; verify background-cache and Account Details tests reject partial entries and preserve no-stale-value behavior.

## 2. Make Swap review truthful

- [x] 2.1 Bind Swap presentation to direction-specific transfer availability and amount changes, keeping unavailable, reserved, policy, and insufficient-funds reasons distinct; verify the component disables Review Transfer when prerequisites are not met and does not start a quote from a disabled action.
- [x] 2.2 Preserve live quote and confirmation validation while updating balance/tooltips and accessible disabled-action messaging; verify valid eligible funds still reach Review Transfer and stale cached totals cannot authorize submission.

## 3. Regression and integration verification

- [x] 3.1 Add a regression reproducing the reported sequence—positive Bitcoin total, zero confirmed eligible funds, enabled Review Transfer, and quote failure—and verify it now ends with a disabled action and no quote request.
- [x] 3.2 Run focused balance, transfer, cache, and UI tests plus `npm run typecheck` and the affected production build; verify unrelated working-tree changes remain untouched and record any pre-existing failures separately.
