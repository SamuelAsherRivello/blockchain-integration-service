## 1. Establish the failure boundary and recovery capabilities

- [x] 1.1 Inspect the existing reported operation and intent without resubmission or active-session reload; deliver a public-evidence timeline identifying the last proven stage, worker condition, transaction/receipt evidence and any inaccessible operator data. Verify the timeline distinguishes observations from hypotheses.
- [x] 1.2 Map installed SDK settlement callbacks, provider acknowledgements, timeout/disposal and interruption behavior to a stage-specific continuation matrix; verify each proposed continuation names its supported API, required retained state, authorization and duplicate-prevention conditions. Mark unsupported stages explicitly rather than assuming resume works.
- [ ] 1.3 Identify the evidenced adapter or verifier fault and define its regression check; verify the corrective scope stays within the proposed SDK/browser architecture. If existing evidence cannot determine the fault, specify the exact missing stage observation to capture during authorized live acceptance; do not claim diagnosis complete or assume a new server/SDK.

## 2. Own execution and preserve evidence

- [x] 2.1 Add compatible operation progress, observation-time and execution-condition fields; verify old journals remain readable with unknown progress, all IDs/reservations survive, and public projections exclude secrets and raw SDK errors.
- [x] 2.2 Evolve background signing into a session-owned coordinator independent of screen lifecycles; verify closing panels, switching views/Admin stories and refreshing presentation reads neither disposes nor duplicates the owning operation, while session-clearing protections remain effective.
- [x] 2.3 Capture safe SDK/provider stage acknowledgements and observe worker completion/rejection after the foreground response; verify interruptions cannot remain labeled actively executing and an unsigned commitment cannot be reported as broadcast.
- [x] 2.4 Serialize and merge exact-operation updates and read-only reconciliation; verify late/out-of-order events preserve stronger evidence, independent transfers remain independent, and transfers sharing a commitment retain correct input/receipt attribution.
- [ ] 2.5 Apply the narrow correction established by section 1 and implement only proven continuation paths; verify the failing regression is resolved, unsupported recovery reports needs-recovery, and no timeout, local cancellation label or missing receipt permits replay or reservation release.

## 3. Present pending and recovery accurately

- [x] 3.1 Replace the acknowledgement with exactly "Transfer pending. You can view progress in Transactions." without keep-tab-open or refresh instructions; verify the production UI text and that dismissing it permits ordinary navigation while execution continues.
- [x] 3.2 Show evidence-supported stage, interrupted processing and unavailable verification in Transactions/Recovery Info; verify local observation times are not presented as chain timestamps and Explorer requires a validated compatible transaction ID.
- [x] 3.3 Preserve the pending-transfer Yes/Cancel warning for every additional transfer in either direction; verify Cancel performs no quote/submission, Yes obtains a fresh unreserved-input quote, and a newly pending ID at final confirmation asks again without replaying an existing intent.

## 4. Prove integration and live completion in Admin

- [x] 4.1 Run focused transition/reservation/legacy/reconciliation checks, integration tests, typecheck and build; record commands and results with isolated logic checks clearly separated from live evidence. Do not add simulated financial outcomes to the product or use fixtures to mark live acceptance complete.
- [ ] 4.2 Verify navigation, presentation refresh, tab-focus changes, late events and interruption recovery in the real Admin/SDK integration; record the loaded revision and observed lifecycle, preserving active signing sessions during development. Record any browser suspension separately from app-triggered cancellation.
- [ ] 4.3 With an explicitly authorized amount and eligible unreserved funds, prove an Arkade-to-Bitcoin transfer from confirmation through broadcast and confirmed exact Bitcoin receipt, retained assets and refreshed balances/Transactions; record public evidence and keep this gate open if completion cannot be demonstrated. Do not duplicate the existing unresolved transfer.
- [ ] 4.4 Independently prove Bitcoin-to-Arkade completion from eligible confirmed Bitcoin inputs through exact Arkade receipt, verified Bitcoin change and refreshed balances; retain its own evidence and leave this gate open if funds or operator support are unavailable.
- [ ] 4.5 Verify read-only recovery of completed and unresolved operations, plus supported interruption handling without blind replay; record that reopening Transactions and reloading after signing has ended preserve the evidenced outcome and reservations where still required.

## 5. Reconcile planning and acceptance

- [x] 5.1 Reconcile complete overlapping status/live requirements with fix-asset-bearing-arkade-withdrawals and add-bitcoin-boarding-settlement before sync/archive; verify the latest pending wording, per-attempt warning and asset protections survive either archive order. Preserve historical task evidence and separate cancellation/game-delivery gates.
- [ ] 5.2 Produce final acceptance evidence tying the exact revision to both live outcomes and documented recovery limits; run strict OpenSpec validation and report any remaining live gate explicitly. Do not mark the feature complete merely because implementation or unit tests pass.
