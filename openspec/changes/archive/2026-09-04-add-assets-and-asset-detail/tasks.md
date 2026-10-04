## 1. Apply preparation and exact formatting

Sections 1-4 record the original completed inspection slice. Section 5 supersedes the initial neutral-artwork/no-burn and Copy asset details defaults following the user's explicit iteration request.

- [x] 1.1 Re-read the current Account, Activity and asset-list implementation plus this proposal before editing; verify the asset entry fits the latest account navigation and record any concrete overlap with concurrent changes without modifying their scope.
- [x] 1.2 Add exact asset summary/detail formatters and metadata fallbacks; verify quantities above the safe integer range, decimals 0/2/18, absent/invalid decimals, duplicate names, missing metadata, full IDs, and deterministic copied text with focused unit tests.

## 2. Account asset state and read lifecycle

- [x] 2.1 Add provider-neutral asset presentation state, openAccountAssets and refreshAssets while preserving UI-independent listAssets; verify Account entry performs no read, asset entry performs one read, public listing does not navigate, and unrelated pending operations do not create an inspection-only blocker.
- [x] 2.2 Add bounded presentation reads, fresh/empty/unavailable transitions and request-generation checks; verify a 30-second deadline including stalled cleanup, failure after success clearing old data, and suppression of out-of-order or late responses.
- [x] 2.3 Integrate Back, account replacement, logout/reset, unmount and disposal cleanup; verify leave/reenter with the same account cannot accept an obsolete response, no cross-account values appear, and presentation cleanup does not cancel independent API callers.

## 3. Production Assets and Asset Detail

- [x] 3.1 Add Assets immediately below Account Activity and a scrollable production asset list using current BIS styling, neutral local icons, shortened IDs and exact quantities; verify populated, empty, loading, unavailable, duplicate-name and missing-metadata states in an isolated browser host.
- [x] 3.2 Add structured Asset Detail with summary, selectable full Asset ID, Copy, Name/Ticker/Decimals and Copy asset details; verify copy success/failure, full-report manual fallback, changed-content races, inert metadata, and zero icon URL requests.
- [x] 3.3 Implement same-dialog list/detail title changes and Back behavior; verify selected row, scroll offset and keyboard focus survive detail Back without another read, and Assets Back returns to Account.
- [x] 3.4 Wire Refresh on both pages to the same asset session; verify quantity updates, removed-asset return/notice, loading without old facts, retryable detail failure, unavailable list after Back, and clamped scroll/focus when the collection shrinks.

## 4. Integrated verification and documentation

- [x] 4.1 Run real-browser checks in the 9:16 demo preview and a narrow/short host with many rows and long metadata; verify headings, keyboard navigation, reachable Refresh/Copy/Back, internal scrolling, and no horizontal page overflow, and retain public screenshots as evidence.
- [x] 4.2 Verify compatibility across existing Transactions/Transaction Detail, account navigation, and Admin C1/C4 using isolated fixtures; confirm C4 remains console-only, no asset inspection action submits a transaction, and production UI imports no demo code.
- [x] 4.3 Perform a current read-only Signet asset inspection with an already available account and record the public result, list/detail consistency and refresh outcome separately from fixtures; do not mint, transfer, log out, or request recovery material to populate the test. Record empty/unavailable results and any remaining live verification limitation honestly.
- [x] 4.4 Update package documentation and the runtime asset journey in documentation/User Story Diagrams.md without renumbering existing stories or changing C4's console-only contract; verify links and wording match the implemented flow and deferred artwork/supply/actions.
- [x] 4.5 Run the relevant asset/context/account tests, repository build and strict validation for this change; record commands and outcomes, resolve concrete regressions, and verify the final diff is limited to the approved asset inspection scope before reporting implementation complete.

## 5. Authorized UI and burn iteration

- [x] 5.1 Rename Account Activity to Transactions and match asset row sizing with bold summary, status and ID lines without icons.
- [x] 5.2 Render metadata images in both asset pages; use a single-line full ID and inline Details Copy above metadata.
- [x] 5.3 Implement reusable Confirmation / Are you sure? / OK / Cancel, focus containment/restoration and confirmed whole-holding Burn above Back.
- [x] 5.4 Add guarded exact SDK burning, durable duplicate/uncertain protection and logout accounting; verify real SDK asset output preservation using controlled transport.
- [x] 5.5 Verify browser navigation, copy/image presentation, confirmation and burn outcomes using fixtures; inspect live artwork and cancel only; run relevant tests, build and strict validation, and update evidence.
- [x] 5.6 Remove the redundant live-history unavailable notice when saved operation rows are visible, retaining empty-list feedback and Refresh; typecheck passed.
