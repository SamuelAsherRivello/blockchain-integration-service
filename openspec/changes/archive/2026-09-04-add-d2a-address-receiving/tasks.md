## 1. Baseline and regression coverage

- [x] 1.1 Review current Receive/Core/demo code and prior receiving evidence; record reused behavior, remaining gaps, and D2a ownership without marking the earlier combined change complete. Verify the record maps each D2a requirement to a test or browser check.
- [x] 1.2 Run existing address and invoice tests, then add missing coverage for copy success/failure, loading and Refresh failure/retry, late results, and default navigation. For any missing behavior, demonstrate a failing test before a scoped fix and verify the resulting tests pass.

## 2. Production demonstration

- [x] 2.1 Add a failing demo-selection test for D2a active-account Receive versus logged-out chooser, including no automatic creation/funding and preservation of existing story selection; verify failure is due to missing D2a behavior.
- [x] 2.2 Add D2a / Receive Funds to the Account catalog and route selection through production public methods; verify selection tests pass and no private imports, simulated transactions, or new dependencies are introduced.

## 3. End-to-end acceptance

- [x] 3.1 Verify the real production Receive page in the demo using a Signet test account: both actual addresses, independent Copy, Refresh, Back/re-entry, unavailable invoice controls, keyboard focus, and readable 9:16 layout. Record evidence without exposing recovery words or requesting funds.
- [x] 3.2 Verify the same acceptance matrix in an independent host using the public package API/UI; exercise clipboard denial and address failure/retry in isolated checks without adding mock outcomes to production. Record results and fix only test-proven D2a gaps.
- [x] 3.3 Run all integration/demo tests, typecheck, production build, and strict OpenSpec validation; record commands/results and inspect the scoped diff for unrelated changes.

## 4. Documentation and handoff

- [x] 4.1 Update user-story status and relevant package/demo documentation to link this change, explain D2a entry, and retain blocked D2b/D3/D4 boundaries; verify documentation tests and all edited links/anchors.
- [x] 4.2 Record final per-scenario D2a evidence and compare implementation against the two delta specs; verify every D2a acceptance criterion is met before declaring it complete, while retaining earlier combined-change historical evidence and incomplete live tasks.
