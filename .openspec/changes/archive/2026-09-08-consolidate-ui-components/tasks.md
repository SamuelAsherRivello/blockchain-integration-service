## 1. Record the behavior baseline

- [x] 1.1 Record current affected fixture results and known stale expectations in verification.md, using isolated storage and clipboard doubles; verify the record distinguishes existing failures from refactor regressions and preserves the user's uncommitted recovery edits.
- [x] 1.2 Extend copy-host/recovery-host coverage for Set/Get titles, masked initial words, explicit reveal/hide, copy normalization, Back/reopen/remount and heading/copy/eye alignment at 280px and 360px widths; verify the current baseline passes after correcting confirmed obsolete navigation labels.

## 2. Consolidate field and clipboard primitives

- [x] 2.1 Introduce private IconButton, named copy/paste/visibility controls and FieldHeading; migrate CopyFieldLabel and the duplicated Send/Restore paste icons, preserving accessible labels, disabled/pressed states and markup geometry; verify keyboard activation and existing copy/restore fixture assertions.
- [x] 2.2 Extract useClipboardCopy with synchronous duplicate protection and scope/request generation invalidation; verify success, denial, retry, unmount, value/session changes and A → B → A delayed results using controlled promises and clipboard doubles.
- [x] 2.3 Replace AddressRow with CopyableValueField in Receive and Balance, and reuse it for Asset ID; verify exact copies, existing messages/manual fallback, blank unavailable balances, Bitcoin-first order and unchanged field geometry through affected address/balance/asset fixtures.
- [x] 2.4 Reuse the clipboard helper and CopyableTextArea in Activity and TransferRecoveryDetails, and the helper in asset report copying; verify full versus selected exports, independent Asset ID/report feedback, manual fallbacks and stale report handling in activity-host, account-assets-host and recovery-report-host. Preserve the separate recovery-window popup and verify activity-recovery-host still opens it without a mutation.

## 3. Consolidate recovery and account presentation

- [x] 3.1 Extract RecoveryPhrasePanel, read-only words and shared seed heading/warning/visibility composition from client.tsx; use it for Set/Get while keeping acquisition, Continue/Back and saved recovery cleanup in their existing controller; verify default masking, explicit copy, reset on each session, and no recovery material in public state/events with recovery fixtures and existing recovery-access/context tests.
- [x] 3.2 Reuse seed heading/warning/visibility controls in RestoreAccount without replacing its editable grid or paste controller; verify word distribution, overflow preservation, checksum handling, hidden editing and late-paste protection. Correct confirmed stale error-navigation fixture expectations to the existing Pending Operation Dialog behavior and record unresolved drift separately.
- [x] 3.3 Extract AccountCard with title/description association, heading ref and optional actions while preserving its DOM hierarchy; verify headings, Refresh behavior, Back focus, Assets/Activity sizing and the host-local pending overlay with pending-operation-host, account-assets-host and activity-host.

## 4. Consolidate review and demo presentation

- [x] 4.1 Extract ReviewDetails, UI sats formatting and useQuoteExpiry for Send/Transfer; verify review values/order, expiry disabling and fresh-quote reset in send-host/transfer-host, with unchanged Max, back-navigation, feature gates and exactly-once submission behavior in existing send-context/account-transfer tests.
- [x] 4.2 Extract demo-local StoryAction for mapped and B/C story buttons; verify story IDs, labels, arrows, selection, disabled rules and callbacks against Admin behavior, with no new private integration imports and no automatic wallet operations.
- [x] 4.3 Consolidate extracted component CSS, preserving per-screen sizes and theme scope; remove the unused non-inline recovery copy branch and only selectors proven obsolete by reference search. Verify remaining consumers and compare recovery rows, balance subgrid, review forms and short-host action reachability.

## 5. Verify the integrated refactor

- [x] 5.1 Run affected isolated browser fixtures in independent hosts and the demo at 100%, 50% and 25% preview scale; record layout, keyboard/focus, modal cancellation, pending Admin usability, clipboard failures and navigation results in verification.md without real recovery material or live mutations.
- [x] 5.2 Run focused existing Node suites for account creation/recovery/restoration, addresses/balances, activity/assets and Send/Transfer, plus relevant demo tests; run npm run typecheck, npm run build and git diff --check. Record commands, pass/fail outcomes and incomplete checks, without claiming baseline failures passed.
- [x] 5.3 Document private component ownership and retained exceptions in packages/integration/README.md and the change verification record; verify public exports/dependencies, core/SDK behavior and unrelated working-tree changes remain unaffected, and that all accepted consolidation targets in design.md have migrated.
