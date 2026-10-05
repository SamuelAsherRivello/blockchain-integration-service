## 1. Feasibility before implementation

- [x] 1.1 Inspect installed SDK and authoritative Signet documentation for native-sat burning, supported amounts, fees, confirmation and reconciliation; deliver a source-backed feasibility report. Investigation delivered in FEASIBILITY.md. The user resolved the unsupported-burn gate by explicitly authorizing the generated-recipient fallback; no asset burning or fake success.
- [x] 1.2 Establish fee presentation and a verifiable single-gesture contract; document the exact expected debit and recovery evidence before any live submission. The later user decision authorizes fallback validation; record the exact debit and transaction evidence.

## 2. Public API and operation lifecycle

- [x] 2.1 Implement the plain-domain continuation request and 1,000–10,000 inclusive integer validation with the not-fail-safe comment; verify both boundaries and rejection of strings, fractions, non-finite numbers and out-of-range values before adapter submission.
- [x] 2.2 Add durable per-account request identity and public status recovery; verify identical retries do not resubmit, changed inputs fail, and reload preserves unknown outcomes.
- [x] 2.3 Implement the verified SDK adapter and integrate existing funds/reservation guards; verify no-account, insufficient-funds, confirmed-failure and pending paths and distinguish fees from paid sats.
- [x] 2.4 Preserve unresolved records through logout/reset protection and bind results to original continuation context; verify lost responses and late success cannot produce a replacement-run success or duplicate payment.

## 3. Admin demonstration

- [x] 3.1 Add Pay-to-play / Request Continue with a visible 1,000-sat default and public API Console reporting; verify repeated clicks cannot submit twice and no second overlay or preview content is created.
- [x] 3.2 Add browser coverage for Admin outcomes and unchanged Runtime Preview, using clearly test-only fixtures for edge cases; verify existing Account and Assets demonstrations still work.

## 4. Delivery verification

- [x] 4.1 Run focused tests and the project build; record commands and results, separating fixture evidence from live operation evidence.
- [x] 4.2 Using the explicit authorization for the generated-recipient fallback, verify one real 1,000-sat Signet operation with authoritative completion and fresh balance/activity evidence; report a blocker instead of claiming completion if unavailable. Initial attempt failed due to the BIS asset-free filter; after asset-preserving repair, operation dc556841-c28d-4962-aee2-95e5fd3620f0 succeeded with exact recipient/change and asset verification. See VERIFICATION.md.
- [x] 4.3 Update B1 status and public API documentation with verified delivery, usage, fees and local-enforcement limitation; mark B1 complete only after its acceptance passes, and verify B2/B3/B4 and D1/D6 remain deferred and untouched by implementation.
