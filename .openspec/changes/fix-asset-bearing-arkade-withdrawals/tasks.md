## 1. Confirm the existing local implementation

The preceding task already produced code and verification evidence. These checkboxes track acceptance under this focused proposal, not a requirement to rebuild the same implementation. Prior evidence is in `../add-bitcoin-boarding-settlement/BOARDING_VERIFICATION.md`.

- [x] 1.1 Verify the current withdrawal adapter includes eligible asset-bearing inputs, reserves current minimum change, and rejects reserve-consuming amounts; run `node --test --test-isolation=none BIS/packages/integration/tests/boarding-assets.test.mjs` and record the tested revision.
- [x] 1.2 Verify exact asset fingerprints, stale-quote rejection and pre-registration intent checks; confirm tests reject changed IDs, quantities, output allocation and input references without registration, adding only missing regression coverage before any corrective code.
- [x] 1.3 Verify durable asset-change persistence and legacy recovery compatibility; run boarding asset/recovery/quote tests and confirm missing or mismatched asset receipts cannot report success or enable replay.

## 2. Integration and planning consistency

- [x] 2.1 Run all integration tests, typecheck and build; record results and report the repository-wide documentation-test stall separately if still present rather than claiming a full-suite pass.
- [x] 2.2 Run the transfer browser harness and verify reverse Max, retained Arkade balance, review expiry and explicit confirmation controls; record its visible PASS result and identify it as isolated test data.
- [x] 2.3 Reconcile the overlapping reverse-transfer requirement in `add-bitcoin-boarding-settlement` with this complete delta; verify neither archive order can remove the reserve-error, asset-free or legacy-recovery scenarios, and validate both changes without completing unrelated gates.

## 3. Delivery and live acceptance

- [x] 3.1 Prepare a release handoff identifying the tested BIS revision/build and the separate published-game consumer update; verify the handoff names the target build and outstanding delivery steps without claiming publication.
- [ ] 3.2 After the game-consumer delivery is separately scoped and performed, verify the published application loads the intended BIS revision and record its URL/build evidence; keep this task open while delivery is unavailable.
- [ ] 3.3 On that build, read fresh eligible funds, assets, operator limits/fees and pending-operation state, then prepare a chosen withdrawal review; verify its amount, reserve and expected asset retention using public data only, leaving financial confirmation to the user.
- [ ] 3.4 After the user confirms, verify recorded inputs settled into the confirmed Bitcoin receipt and exact owned Arkade asset change; record public identifiers, fresh balances and Activity, including reload recovery. If evidence is unavailable or ambiguous, keep this task pending without resubmission.
- [ ] 3.5 Update acceptance evidence, sync the final delta and prepare archive only when applicable delivery/live gates are satisfied; verify OpenSpec validation passes and the broader change's unrelated tasks retain their true status.

## 4. User-confirmed Admin interaction revision

- [x] 4.1 Add a failing regression for prompt registration acknowledgement while settlement is unfinished; keep the signer alive and the public record pending.
- [x] 4.2 Preserve independent durable operation records, exact-ID late callbacks, reserved inputs, partial input selection, and all pending transaction rows.
- [x] 4.3 Ask the requested Yes/Cancel warning on every new balance transfer in either direction, recheck pending IDs at confirmation, and show submitted/Transactions guidance after acknowledgement.
- [x] 4.4 Verify isolated browser Cancel, both directions, changed pending set and submitted result; verify the actual Admin pending warning without duplicating its unresolved transfer.
- [x] 4.5 Complete final integration/build/spec checks and refresh the acceptance evidence for this revision.
