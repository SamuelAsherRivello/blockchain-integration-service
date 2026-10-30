# Verification

Updated 2026-10-28. Implementation is present. Live acceptance remains open.

| Requirement | Evidence | Result |
| --- | --- | --- |
| Network-specific submitted identities and retryable feedback | `browser-wallet-cleanup.test.ts` covers both profiles, captured values, invalid credentials, progress, success and errors | Deterministic pass |
| Original pending-send continuation | Focused tests and both live network cases verify finalization under the original ID, pending flag cleared, one finalization and zero replacement submissions | Pass on both networks |
| Recovery preserves exact assets/value after verified fees | Focused maintenance tests, successful live Mutinynet recovery, and a matched Signet operator failure with unchanged value/assets | Mutinynet success verified; Signet success gate remains open |
| Durable isolated evidence and retained history | Journal reconstruction, identity/network isolation and terminal history tests | Pass |
| Serialized mutations | Web Lock tests include overlapping calls on the same instance and independent identities | Pass |
| Settlement events belong to the original intent | Maintenance tests cover unrelated failures/finalization, event arrival before registration returns, matched failure with confirmed deletion, and lost deletion acknowledgement | Pass |
| Asset carrier minimum/default 330, legacy selection migration, tooltip | Asset payment unit/browser tests and exact 330-sat, one-unit recipient receipts on both networks | Pass on both networks |
| Read-only inputs first, then editable inputs, each alphabetized | Browser visits every registered demo and checks the actual rendered inputs | Pass |

All 169 deterministic sandbox tests pass, including settlement correlation cases added after the baseline run. Four browser checks pass across the asset payment and cleanup files. The sandbox production build and root typecheck pass with the correlation change. The root typecheck has the repository's existing scope; a direct sandbox TypeScript invocation reports existing errors in imported faucet, conditional-vault, navigation and settlement modules, with no diagnostics in the maintenance modules. OpenSpec strict validation passes.

Public logs and receipts are under `output/logs/prototype-wallet-cleanup/` and `output/reports/prototype-wallet-cleanup/`. They are ignored temporary artifacts. Test phrases and signed browser recovery state are excluded from those folders.

## Live receipts

- Mutinynet recovery commitment `e43655c5dcd0a635baa8899ef379784ab4675cf22e612262bd1faff18761795b` preserved all three asset IDs/quantities and the full 150,659-sat inventory, with zero verified recovery fees. See `mutinynet-v2.json`.
- Mutinynet send `b747f5385bd11faf3a4b009eec6ea5391ceb62771b7a369f07c492518a7c1406` delivered exactly 330 sats and one unit of asset `5bd477112137c40d2b3a2b126e8c3b1968001f329771a89faade1139d0c7095f0000`. Cleanup continued that original transaction with one finalization and zero new submissions.
- Signet send `e48797a135f6aec1c30c43cb190e5072462a1264c54fa40cc91b2a9051735446` delivered exactly 330 sats and one unit of asset `f6db123e92e0051d9e147cda0845b0f377a4e7786b298212b2e01a7645d7dafd0000`. Cleanup continued that original transaction with one finalization and zero new submissions. See `signet-pending.json`.
- After adding batch correlation, real SDK maintenance on Mutinynet recovered an owned asset-bearing fixture through commitment `1379a370e046296cf5f16e1674aa60f0720c5b389d310f00223c04113f3496f5`. Before/after totals were both 150,329 sats, both asset IDs/quantities were identical, verified fees were zero, and no recoverable balance or pending record remained. This Node SDK financial check complements the separate browser presentation checks. See `mutinynet-node-recovery.json`.

## Confirmed Signet operator failure

An independent registered Signet test wallet completed real mint and self-transfer fixtures. Its recovery intent `6ff5f99d013e7687f20cbb33c9dc484d0f768e50c45d2bb8bbb9169772b22570` was selected and acknowledged in batch `40fc677f-0902-455b-a9b5-69c109291e00`. The correlated batch failed before commitment creation with `fee-estimation-unavailable`. A hash comparison against the retained, known operator error established that reason without recording arbitrary SDK exceptions or signed material in public artifacts.

The SDK's original cleanup deletion was replayed only after that matching terminal failure. The operator specifically returned `INVALID_INTENT_PROOF: no matching intents found for intent proof`. Fresh discovery verified all 1,000 sats and one unit of asset `210c0253616e99244c1c5b299d9907128c4344ae76714c5c7ccc8783794ea9490000` unchanged, with the captured inputs unspent. The attempt was reconciled as failed history, not successful recovery. The implementation now handles that specific response after a matching failure without leaving a false pending lock. Generic errors, unrelated failures and lost acknowledgements remain pending. See `signet-node-recovery.json` and its validated public journal.

Successful Signet asset recovery remains unverified because the operator cannot currently estimate its Bitcoin fees. A decision on whether to accept that documented external limitation is pending; it is not silently counted as a successful recovery.

A controlled retry reused only the confirmed-failed fixture and retained its failed history. Intent `61c675ca8a5de8f48ef9b40e652e52bf6277264f6713771a256a8572aa8a0905` was selected and acknowledged in batch `06fb2520-3c91-4c05-b1c0-e2964d0a04c8`; the matching batch failed with the same verified fee-estimation error. The updated implementation automatically recorded this attempt as failed, preserved the previous failed record, and left the pending flag clear. Fresh reads again verified all 1,000 sats and the exact asset quantity unchanged. Its external protected operation was reconciled as failed. This verifies the live error-handling correction without claiming successful Signet recovery. See `signet-node-recovery-retry.json`.

## Retained uncertainty

The first live multi-output fixture was rejected by SDK 0.4.79 before dispatch because it exceeded the OP_RETURN output limit. A blocked-write replay and installed SDK control flow established that local rejection; its protected operation history records failure. Earlier Signet recovery attempts have uncertain outcomes and remain reserved. Neither unspent inputs nor a timeout was treated as proof of failure. The separately recorded prototype-loss policy was applied only to an unacknowledged faucet funding request, retaining `networkOutcome: unknown`; it was not applied to registered recoveries or acknowledged sends. Operator rate limits also interrupted test reads. Subsequent runs continued original sends from encrypted browser recovery state without replacement payments.

The final separate Signet recovery case, `signet-recovery.json`, captured 1,670 sats and one unit of asset `c4e16da0736bdc3be28f0a8d8e39895edc8ef1c3ce868b5d1c3407638e96381b0000` before maintenance. Its external protected operation `clean-signet-mvrmbx9c-recover` remains `submitting`; the encrypted snapshot contains no settlement journal record. That absence is not sufficient to release the reservation, because snapshot capture and asynchronous completion can race. No replacement was submitted. Earlier registered Signet recovery `clean-signet-mvrlrrg6-recover` remains `unknown` with its public captured inputs and expected output retained. Signet recovery acceptance remains open until attributable receipts or authoritative terminal failure establish the original outcomes. It is not reported as live verified.

At 2026-10-28 04:43 UTC, a short-lived, signed ownership query to Signet's read-only `POST /v1/intent` succeeded with HTTP 200 and an empty intent list. Transaction writes were blocked throughout that diagnostic, and no signed proof was retained. Fresh indexer reads still show both fixture pairs unspent with no `settledBy` commitment. The [operator implementation](https://github.com/arkade-os/arkd/blob/master/internal/core/application/service.go) documents that ownership lookup as a search over cached intents. An empty cache result therefore cannot establish a historical terminal failure. See `signet-original-intents.json`. Further acceptance requires attributable commitment evidence or authoritative terminal failure for the captured original inputs, not another recovery submission.
