# Original B2 receipt reconciliation

The original run is `treasure-b2-261026-1125` on Mutinynet. Only its protected journal and read-only indexer receipts were inspected. No funding, signing, submission, refund, generic SDK recovery, replacement allocation or reservation release occurred. C094 remains 26/36 complete.

## Verified funding and current funds

The existing receipt verifier confirms the exact 1,000-sat funding chain:

- Source output: `e80652365d41d3ca1f0b3807dae6b37b0c368db351e26b77c239002145502cbc:0`.
- Spending checkpoint: `93d2c323f517b55c94cabc9b48e3395d5a556f1c90246f7407dc44e5190ebeaf`.
- Contract funding output: `6810a50d5b77d707dcea6b2469243dfceedbedfade0175bb0119bbf7d4afcec7:0`.

The final output matches the actual compiled original contract script and contains exactly 1,000 sats with no assets. The funding operation's existing `settled` journal record matches that transaction and records zero fees. That status means the funding operation completed; it does not mean batch finalization, successful B2 qualification or refund.

The contract output is offchain-unspent but swept, preconfirmed, expired and not spendable. Its expiry is `2026-10-26T14:52:19.000Z`, with no `spentBy`, `settledBy` or unilateral-unroll marker. There is no claim/refund operation or signed refund-recovery journal. The original run remains `stopped-fund` / `original-unresolved`, already reconciled. It was not changed or reclassified as failure.

Read-only queries for both original payout scripts show zero spendable outputs and zero spendable sats. The Game destination has one indexed historical output and the Player destination has six; a matching value or historical balance is not a refund receipt. **The 1,000 sats have not been verified returned and are not currently spendable at either original destination.**

## Recoverability and precise blocker

The operator's `recoverableOnly` query includes the exact original contract output. Its indexed batch commitment is `34fe1fe6ca6415a5be86c5a9dd319fa5d9c58dbc578ab2826402fbbce9e7b2d1:0`. The batch-sweep endpoint reports transaction `1eff5b382d793fab940cb3b46c6e1317f62bbd0779a3fe178b47eb91826e0e91`. A later read-only Mutinynet Mempool API GET independently fetched and checked that root-sweep transaction: it is confirmed at height 3,536,981, spends one 300,000-sat input, creates one 299,850-sat output, pays a 150-sat fee, and the output was unspent at the 2026-10-26 18:34:54 UTC check. Sanitized record: `output/reports/bis-server-treasure-release/public-sweep-tx-2026-10-26.json`. This verifies the batch sweep, not an individual 1,000-sat contract refund or a returned output to either original destination. The original VTXO remains separately indexed as swept, preconfirmed, unspent and expired; its refund/recovery receipt is still missing.

The output is therefore listed as recoverable, not verified refunded or permanently lost. The installed SDK README describes swept/expired recovery through `VtxoManager`. That generic wallet feature is not proof that this custom contract has a safe supported recovery path under its original authorizations.

The exact protected refund runner, `BIS/scripts/treasure-v4-funding-recovery.ts`, requires an original settled, live, non-swept, non-preconfirmed input before new refund authorization. This input fails those checks. Its reconcile-only branch requires an already submitted, source-bound signed refund journal; none exists. The original qualification runner also records that its original reconciliation was already used. Replaying either path, forcing generic SDK settlement, or clearing a reservation would supply no missing receipt and would violate the existing guards.

The blocker is a missing validated contract-aware recovery path for the original swept/expired preconfirmed output. This report does not establish that the upstream protocol makes recovery impossible. Reopening requires a reviewed way to recover this exact output under the original contract authorizations, preserved journals and an explicitly assigned bounded operation. The original reservation and unresolved run remain protected. No retry, refueling or competing spend is permitted while its outcome is unknown.

## Evidence

Sanitized artifacts are under `output/reports/treasure-contract/b2-original-reconciliation/`: `result.json` holds original journal/funding/output/destination evidence; `receipt-followup.json` holds the verified funding chain, recoverability classification and batch-sweep receipt; `verification.json` pins both results and inspectors by SHA-256. No mnemonic, private key, password, signed packet or raw recovery material appears in those artifacts.

The first inspector stopped because it rejected an explicit pagination response. The inspector was corrected to use the SDK's all-pages read before completing this observation. That was a read-tool correction, not a financial retry. It is retained as `initial-result.json`.
