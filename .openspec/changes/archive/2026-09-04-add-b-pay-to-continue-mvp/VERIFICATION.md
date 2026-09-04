# B1 verification - 2026-09-04

## Result

B1 is implemented and successfully verified live after the asset-bearing-input repair below. All 11 OpenSpec tasks are complete. The payment is a Signet sink payment, not proven Bitcoin destruction. Earlier failures and diagnosis are retained below as historical evidence.

## Automated evidence

65 focused tests passed, with each file run in its own Node process using `node --test --test-isolation=none <file>`:

- integration/tests/continuation.test.mjs: 6
- integration/tests/continuation-adapter.test.mjs: 5
- integration/tests/sending.test.mjs: 6
- integration/tests/send-context.test.mjs: 4
- integration/tests/send-adapter.test.mjs: 4
- integration/tests/logout.test.mjs: 14
- integration/tests/burning.test.mjs: 6
- integration/tests/asset-context.test.mjs: 19
- integration-demo/tests/admin-assets.test.mjs: 1

The continuation and Admin tests were rerun after final error wording and account-context checks. `npm run build` passed including TypeScript and both packages. Vite's existing large-chunk warning remains. Windows sandbox subprocess restrictions initially produced EPERM; the authorized build outside the sandbox passed. Running several Node files with isolation disabled in one process caused shared global-fixture interference; running each file separately passed without changing those tests.

`openspec validate add-b-pay-to-continue-mvp --strict` passed.

Coverage includes valid price bounds, invalid values before submission, account guards, exact prepared inputs/outputs, no recipient identity persistence, storage failure before network, lost responses, absent/wrong/exact finalized indexer outputs, independent durable journals, changed request rejection, original account/run attribution, pending spending/clearing guards, and safe retries after reload.

## Real-browser fixture evidence

Chrome at http://127.0.0.1:5173/tests/continue-host.html used isolated in-memory storage and an explicitly injected test adapter (no network or real wallet).

- Pending request displayed in Console with one submission.
- Repeating pending request kept the submission count at one.
- Switching fixture to succeeded reconciled the original ID and still kept one submission.
- A deliberately new request in failed mode reported failure in Console.
- No-account mode reported account change without submitting.
- Runtime Preview remained empty throughout. No confirmation overlay appeared.

These fixture successes are not live payment evidence.

## Live Signet evidence

Used a separate Chrome tab at http://127.0.0.1:5173/ with the existing player login. No account creation/save/logout/restore action was used on the player.

- Player profile: 38a45d3d35c367c1d19f4d93d8231acd73ce36d98cb0576b31a387ebc87ce803.
- Fresh Account Details: total 289,715 sats; Arkade 289,715 sats; Bitcoin 0 sats.
- Requested amount: 1,000 Signet sats, required fee 0.
- Operation ID: 153e352c-fc2a-4e60-af26-4d493e9c038c.
- Original context: 71bfe7c6-c535-43e7-91a2-14adef9ee68c.
- Actual result: failed during preparation, before submission, with no transaction ID. Original message: "Enter an affordable whole-sats amount above the minimum."
- A subsequent fresh Send view showed **Spendable: 0 sats**. The inherited send path uses eligible, asset-free VTXOs only. The total alone cannot establish eligible spendable funds. No claim is made that all remaining funds are necessarily asset-bearing without an additional VTXO inventory.
- Reload recovery returned the same failed operation without initiating another payment.
- The player remained logged in under the same profile.

Future insufficient-funds results now explicitly say that eligible Arkade funds are insufficient and that this payment excludes asset-bearing outputs. The historical failed journal is retained unchanged.

## Remaining live acceptance

The player needs at least 1,000 eligible spendable, asset-free Signet sats (and valid change if applicable). Automatic funding and relaxing asset-preservation guards were not performed. Once eligible funds exist, a new deliberate request ID can run the authorized validation. Record exact prepared recipient script/value, authoritative completion, matching finalized indexer output when available, and fresh balance/activity as supplementary evidence. A missing output or timeout must remain pending. Do not infer success merely from a balance decrease.

B2/B3/B4 gameplay and expanded UI, D1 managed Admin wallet, and D6 USD pricing remain deferred. B1 uses a transient generated recipient and truthfully reports sink-payment, never proven destruction of Bitcoin.

Final live read-only regression check: C4 List Assets returned success for the same player with three assets. Account and Assets remain functional; Runtime Preview stayed empty during B1 requests. The validation tab is left with the recovered failed B1 result in Console.

## Follow-up: misleading failure message fixed

The concrete error regression was reproduced with `node --test --test-isolation=none packages/integration/tests/continuation-errors.test.mjs`: three assertions failed before the fix (combined amount/funds message and legacy presentation). The same command now passes all four tests. Five related files (continuation, continuation-adapter, sending, send-adapter, send-context) pass another 25 tests; TypeScript passes.

New preparation errors distinguish invalid numeric input, operator minimum, insufficient eligible funds (available and required amounts), and subdust change. Eligible funds are not presented as total wallet balance. The brittle generic-message-to-insufficient-funds mapping was removed.

Legacy failed records with the exact old combined message receive a presentation-only clarification: the B1 price is valid; no payment was submitted; the stored record lacks evidence to distinguish eligible-funds and operator-limit causes. Financial history is not rewritten and no historical available amount is fabricated.

Browser verification used `/tests/continue-status-host.html`, which exposes only the public status read and cannot initiate payments. Reading operation 153e352c-fc2a-4e60-af26-4d493e9c038c visibly returned the corrected message for the original profile/context and retained failed status. No funding or payment was performed for this fix.

## Live root-cause diagnosis (subsequent read-only investigation)

The player's current live SDK balance is 289,715 available/total sats, all preconfirmed, with zero recoverable sats. `getSpendableVtxos({withRecoverable:false,withUnrolled:false})` returns one spendable output containing all 289,715 sats and three assets (one unit each). The extra BIS filter `.filter(c => !c.assets?.length)` excludes that entire output, leaving zero inputs. This is a BIS input-selection limitation, not a lack of spendable Arkade currency, an operator fee problem, or a recovery lock.

The output is 25a233c28ef8c53f5c1ee095cb7ee448319acdc9beca31797df1976870558ea4:0. Live operator txFeeRate is zero; vtxoMinAmount is 1. SDK spendability with recoverable enabled yields the same one output.

A read-only numerical reproduction using production sendAmounts confirms that the filtered 0 sats rejects the 1,000-sat request; the unfiltered 289,715 sats yields 288,715 sats change. This does not authorize bypassing output validation.

Minting uses SDK spendable outputs without excluding asset-bearing inputs. Installed SDK issue code preserves prior assets in its output. SDK send also constructs asset-bearing change and an asset extension packet. The correct B1 repair is to support and verify that asset-preserving transaction shape (including every original asset and amount), not to remove the filter alone: current BIS exact-output validation expects the simpler asset-free shape.

No payment, mint, funding, account switching or storage reset was performed during diagnosis. Public-only diagnostics are available in tests/continue-diagnostics.html. Earlier suggestions to fund more sats were premature; the wallet already has enough SDK-spendable sats.


## Successful live acceptance after asset-preserving repair

- Operation: dc556841-c28d-4962-aee2-95e5fd3620f0.
- Context: 3058f442-3bfa-409f-a14f-bea5895f658a.
- Same player profile: 38a45d3d35c367c1d19f4d93d8231acd73ce36d98cb0576b31a387ebc87ce803.
- Transaction: 40b789ce9ea7ed49d2f17749292cbe6c96a62e4a97837a545ace10233e5512a0.
- SDK send finalized successfully after strict prepared transaction checks. The Admin Console returned succeeded, sink-payment, 1,000 sats, fee 0.
- Independent SDK indexer read of outputs 0 and 1 confirmed recipient output 0 contains exactly 1,000 sats and no assets; output 1 contains exactly 288,715 sats and all three original asset IDs with quantity 1 each.
- Fresh read-only player wallet inventory independently returned that same output 1 and all three assets; available and total balances were both 288,715 sats. Before payment both were 289,715 sats. Account identity was unchanged.
- Both outputs are preconfirmed Arkade virtual outputs. This is successful offchain payment evidence, not base-layer Bitcoin confirmation or destruction.
- No extra confirmation overlay or Runtime Preview content appeared during the payment. One new payment was submitted; earlier failed identities remained failed.

The original insufficient-funds diagnosis was caused by BIS excluding asset-bearing inputs. B1 now opts into those SDK-eligible inputs, commits asset holdings into its quote fingerprint, verifies the complete asset extension returns them to owned change, and journals that change for exact-output recovery. Generic Account Send retains its prior asset-free policy.

Regression test `continuation-adapter.test.mjs` failed before the repair for the 289,715-sat/three-asset fixture. After repair: 11 adapter tests, 7 continuation lifecycle tests, 4 send adapter tests, 6 send-domain tests, 4 send context tests and 4 error tests pass (36 total). Coverage rejects redirected, omitted or altered asset quantities; insufficient asset change; missing/wrong finalized change; and unexpected recipient assets. TypeScript, build and strict OpenSpec validation pass.

Fresh SDK transaction history also identifies transaction 40b789ce9ea7ed49d2f17749292cbe6c96a62e4a97837a545ace10233e5512a0 as SENT, amount 1,000, settled true, with no asset delta. This independently confirms the payment appears in player activity.

## Archive and commit verification (2026-09-04)

Synced all four pay-to-continue requirements and both story-driven-demo delta requirements into the canonical main specs, preserving unrelated requirements and scenarios. All 20 main specs pass `openspec validate --specs`. All 11 B1 tasks are complete; the change was then archived and its documentation link updated.

The complete repository test set passes: 229 tests across 36 files, each run separately with `node --test --test-isolation=none`. The documentation and invoice-receiving files required rerunning outside the process sandbox because Vite process restrictions caused the first attempts to fail; both passed unchanged. `npm run build` passes TypeScript and both production builds, with the existing bundle-size warning.
