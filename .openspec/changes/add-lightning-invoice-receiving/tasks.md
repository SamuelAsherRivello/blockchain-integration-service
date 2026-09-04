## 1. Baseline and unavailable presentation

- [x] 1.1 Inspect the current account, storage, Activity/A5, demo, and story-document baseline; record affected modules and verification commands without changing unrelated work.
- [x] 1.2 Add tests for unavailable receiving capability, default selection, unchanged addresses, disabled invoice controls, and usable Back; verify they fail for missing behavior before implementation.
- [x] 1.3 Implement provider-neutral unavailable state and the separated Lightning invoice section using production UI; verify the tests pass and the 9:16 preview retains readable addresses and controls.

## 2. Live receiving feasibility gate

- [ ] 2.1 Recheck official support and installed package compatibility; deliver dated evidence for Signet receiving, exact payer-amount quotes, fee validity, invoice validation, expiry, claim recovery deadlines, and idempotent reconciliation. A negative result leaves this gate incomplete and live tasks blocked.
- [ ] 2.2 Identify a supported provider/client pairing and obtain explicit approval for any dependency/provider change; verify approval and compatibility evidence are recorded before installation. If no supported route exists, stop live work after the unavailable slice and report the blocker.

## 3. Account-owned operation state and clearing protection

- [ ] 3.1 After the live gate passes, write failing lifecycle and storage tests covering intent persistence, uncertain creation, restart, account isolation, and encrypted recovery fields; verify fixtures cannot enter production demo outcomes.
- [ ] 3.2 Add versioned durable operation storage through an additive migration and explicit public-state mapping; verify existing accounts still load and recovery secrets do not appear in public state or logs.
- [ ] 3.3 Implement the account-owned reconciliation supervisor and adapter recovery contract; verify restart resumes without Receive/Activity and duplicate observations or claim retries do not duplicate logical receipts.
- [ ] 3.4 Write failing Log Out/Reset tests for payable, hidden, creating, expired-but-pending, unknown, and resolved operations, including hydration and two-context races; verify the expected blocks and release conditions.
- [ ] 3.5 Enforce a shared clearing guard inside Core APIs and both UI actions, with cross-context serialization against creation; verify race tests pass, reasons are visible, Back/gameplay remain usable, and normal acknowledged logout still works when unblocked.

## 4. Live adapter and invoice interaction

- [ ] 4.1 Implement only the approved Signet adapter behind the capability gate; verify contract tests reject wrong-network, wrong-amount, expired, unverifiable, and changed-fee responses and retain uncertain operations for reconciliation.
- [ ] 4.2 Add failing UI tests for amount validation, Clear to 0, first-Submit fee review, second-Submit creation, changed terms, and duplicate submission; implement the same-prompt flow and verify all tests pass.
- [ ] 4.3 Implement actual invoice display, Copy, With Invoice: <amount> sats, inline failure handling, and within-visit hide/reuse; verify tests assert identical invoice reuse and no extra result dialog or Generate button.
- [ ] 4.4 Implement Expired/Renew and confirmed Paid presentation; verify tests cover disabled Copy, explicit renewal at the same amount, changed-fee review, and no false Paid state for initiation or held payments.
- [ ] 4.5 Implement navigation presentation reset independently of operation processing; verify leaving and returning gives No Invoice/0/no displayed invoice while earlier operations remain tracked.

## 5. Activity and demo integration

- [ ] 5.1 Extend A5 Activity with reconciled pending/confirmed receive records and available payer/fee/net details; verify duplicate provider/wallet observations merge and unpaid invoices are not fake pending transactions.
- [ ] 5.2 Connect the receiving demonstration through the public production flow without auto-creating accounts or payments; verify independent-host and demo parity and protected Admin Reset behavior.
- [ ] 5.3 Synchronize D2 receiving documentation and implementation status while preserving existing A/B/C story IDs and separate D3 all-send-types scope; verify the document diff marks unavailable versus live behavior accurately and does not close unrelated A5 verification.

## 6. Cross-cutting verification and delivery evidence

- [x] 6.1 Run the repository's type checks, tests, and production build; record commands and results, including regressions for address receiving, logout acknowledgement, and unrelated demo flows.
- [ ] 6.2 Verify the production UI in a real browser at the 9:16 preview and an independent host, covering keyboard access, quote review, navigation defaults, Copy errors, and clearing-block explanations; record non-secret evidence.
- [ ] 6.3 With a verified service and explicitly authorized or user-assisted test payer, verify actual Signet generation, receipt, expiry/renewal, hidden-invoice payment, restart recovery, and Activity reconciliation; record exact versions and outcomes without secrets. Do not send payments automatically or substitute fixtures for this evidence.
- [ ] 6.4 Verify offline/unknown-state handling, cross-tab creation-versus-clearing races, and creation-disabled rollback with outstanding recovery; record results proving account state remains protected.
- [ ] 6.5 Validate OpenSpec and compare implementation against every scenario; record any live-provider blockers and leave incomplete tasks unchecked rather than reporting the unavailable slice as full Lightning delivery.
