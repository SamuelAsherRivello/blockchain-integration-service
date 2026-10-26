# Treasure local responsiveness and gate review

Canonical C094 progress remains **27/36**. This pass performs no B2 wallet access, signing, funding, recovery, package import or publication. The protected unresolved run and reservations are untouched.

## Completed local work

Two game-owned inspection-feedback defects are fixed in `treasure-ui.js`. Completion previously cleared the inspection handle before testing it, leaving visible loading feedback behind. Reopening or checking an inspection after ten seconds also reset its delayed notice without restoring it. Completion now clears feedback for the current adopting window, and elapsed feedback is restored before scheduling any remaining thresholds. Coalescing and financial commands are unchanged.

Both new regressions fail against the reconstructed previous implementation. The fixed UI suite passes 9/9 and the full game suite passes **1,183/1,183** on Node 24.21.0, with zero failures/skips. Public contract types, 10 publishing checks, production build and the exact BIS 0.0.27 verifier pass. All 201 installed files still match archive `f441f9e2bba7f9f6d510c00405b90c0dbb7bdc25adfac0c69bcfe28533bb914c`. The build retains its existing chunk-size warning. The actual production game passes guest Start, Settings and Account, displays BIS v0.0.27 and has zero CSP violations. Its signing/provider requests remain blocked.

## Measured local component response

The reference setup is managed headless Chromium 156 on Windows, SwiftShader, DPR 1, reporting 32 logical processors and 32 GiB device memory. Each width uses 20 fresh component-page cold samples and 50 warm samples, at height 844 CSS pixels. It loads the actual game window/UI and production stylesheet/CSP. State remains unverified, Claim/Reject stay disabled, and no financial success is fabricated.

| Width | Cold presentation p95 | Cold Back p95 | Warm presentation p95 | Warm Back p95 |
| --- | --- | --- | --- | --- |
| 1280 px | 19.3 ms | 17.9 ms | 16.3 ms | 14.9 ms |
| 390 px | 18.6 ms | 17.0 ms | 15.4 ms | 15.4 ms |

Acknowledgement measures local synchronous state/accessibility feedback followed by two animation frames, a browser rendering opportunity rather than physical-display latency. Back's existing exit animation completes separately; it is not counted as provider latency. Repeated reopening adopts one slow inspection. Ten-second feedback survives reopening/status checking and clears on completion. Offline smoke samples stay responsive, with no provider request or financial call. The initial harness incorrectly equated Back acknowledgement with finished exit animation; that assertion was corrected and its diagnostic log retained.

The headless browser stays visible despite switching tabs, so an actual hidden-tab condition was **not obtained**. Offline measurements are smoke samples, not a p95 series. Funded Claim/Reject acknowledgement and live provider durations remain unperformed. This evidence does not complete T026 or establish whole-engine cold-start/mobile-device performance.

## Independent local proof reproduction

A fresh native VM run passes all **50 vectors**, with six accepted and 44 rejected, no mismatches and no project-source drift. The engine is pinned to upstream commit `7b830f6d7bd3998e1790f3d3e7737f34f40588f1`; the three contract-script source files match the installed 0.0.27 archive. The report is `output/reports/treasure-contract/authorized-vm/run-6VI0QK/result.json` in BIS.

This proves local bytecode execution under supplied clock/expiry context. It supplies neither an authoritative remote clock nor admission/finalization receipts or an independent qualification review. No provider or wallet is used.

## Remaining gate dispositions

| Task | Disposition after this pass |
| --- | --- |
| T006 | Blocked by missing live attributable negative-admission and delayed-finalization proof. No financial retry. |
| T007 | Local reproduction strengthened; remote clock/admission semantics and independent qualification remain unproved. |
| T010 | Local consent/CSP/dependency evidence remains passing; exact deployed resource/privacy review is absent. |
| T011 | Complete for the exact local 0.0.27 import. No public release is implied. |
| T021 | Both delta specs reviewed. Required live, recovery, deployed and performance gaps prevent final qualification. |
| T026 | Local component p95 passes; hidden-tab, offline p95 series and funded acknowledgement are still missing. |
| T035 | Missing live checks remain blocked under the no-financial-action instruction. Existing B2 evidence is preserved. |

The other open tasks are T018, T019 and T020, covering funded game UI, the full network lifecycle matrix and funded rollback. Deterministic tests and controlled UI samples cannot close them.

Sanitized game evidence is `output/reports/treasure-local-responsiveness/verification.json`, SHA-256 `9bc3b098e3fe506b4c684402e67b65e8a02a1a0b857cdafecebbf927105f12f2`. It pins source/log hashes, detailed timing samples, native proof and cleanup. The owned preview on 6176 is stopped. Shared game PID 65412 remains healthy on 5176; other servers and wallet storage are preserved.
