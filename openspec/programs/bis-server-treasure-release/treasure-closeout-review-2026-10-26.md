# Treasure closeout review

The v0.0.27 frontend is public. Production treasure qualification remains incomplete. This review closes the evidence-review work, not the unresolved financial guarantees. No new release, wallet access, live signing, funding or network transaction was performed.

## Deployment and hardening evidence

The [BIS deployment](https://github.com/SamuelAsherRivello/blockchain-integration-service/actions/runs/40373515541) succeeded at `87580a56c7f67d0869c1511cbfed8bcf3a2cdcf6`. The [game deployment](https://github.com/SamuelAsherRivello/blockchain-stealth-and-steel-game/actions/runs/40373581687) succeeded at `fe48aaa7f4c31a49f55673953116b16881319dce`, including immutable-package verification, publishing checks, full tests, contract types, build and Pages deployment. Those runtime sources match the local checked-out files. The public inventory records the exact `f441f9e2bba7f9f6d510c00405b90c0dbb7bdc25adfac0c69bcfe28533bb914c` BIS archive.

Admin, Marketplace and game return HTTP 200 with CSP metadata. Public game `environment.json` reports v0.0.27; Account visibly reports BIS v0.0.27. The deployed game policy exactly matches the reviewed generator without unsafe inline/eval allowances. Guest Start, Settings and Account pass with zero CSP violations, and six injection canaries are blocked while same-origin script and CSSOM controls work. All 41 focused public-facade/storage/private-pending tests pass. The unchanged exact-lock dependency install previously reported zero advisories. Consent and batch/exit disclosures are retained. T010 is complete for this local-wallet model.

The older Marketplace 404 and missing-CSP findings are superseded. `/version.txt` still returns 404, but the build's canonical deployed metadata is `environment.json`; this review does not invent a new endpoint requirement. The observed game policy has `signerEndpoint=none`, so its hosted signer is not connected by this deployment. The coordinator owns a separate local configuration fix; any future server-enabled deployment requires its own checks. The package's optional server-signing support is separate from C094 local-wallet qualification. A healthy server Preview does not establish a funded treasure contract result.

## Review against both delta specs

| Requirement | Evidence and current limit |
| --- | --- |
| Local wallet ownership is explicit | Per-offer consent identifies selected wallets and available signing source, with an explicit unknown fallback. It does not assert a protected publisher treasury. |
| Original reward terms remain immutable | Tests preserve 1,000 sats and the original whole-second deadline rounded down to at most 90 seconds. New readiness/close/navigation does not authorize replacement funding. |
| Production enforcement is independently qualified | Not satisfied. Local bytecode vectors cannot establish authoritative hosted admission or delayed finalization. T006/T007 remain open. |
| Browser fallback is real, disclosed and selected before funding | Real compiled contracts and historical receipts exist; mode-selection and unknown-outcome guards pass deterministic tests. The current imported release's complete live matrix is still missing. |
| Admin documents solutions; game selects automatically | Admin exposes network-specific modes; game selection is automatic before funding. This does not turn co-signer availability into production qualification. |
| Financial state follows exact evidence | Restore, scope, pending and duplicate tests pass. Original B2 remains unresolved, with no verified refund. No unknown outcome is rewritten as failure. |
| Recovery survives lifecycle changes | Portable recovery and original-operation support have deterministic/historical evidence. Swept V4 recovery lacks a validated path; current release recovery/live cases remain incomplete. |
| Claims preserve the promised reward | Fee/destination/asset checks and local fixtures pass. Exact-release funded network matrix and asset cases remain open. |
| Reward presentation is bound to its originating run | Stale-run and duplicate-delivery tests pass. Presentation is not financial truth. |
| Qualification has separate live evidence | Enforced by this review: no current network/mode receives production qualification from UI, VM or deployment success. T018/T019/T035 remain open. |
| Bounded BIS acceptance preserves qualification gates | Original journals/reservations and upstream stop conditions remain protected. This pass makes no financial probe. |
| Treasure adds no financial startup barrier | Guest real-package browser checks and readiness/consent tests pass. No pre-approval funding is authorized. |
| Action feedback precedes financial confirmation | Local acceptance, duplicate, stale-window and delayed-feedback tests pass. Actual funded Claim/Reject timings remain unperformed. |
| Responsiveness has measured acceptance | Cold/warm component p95 passes. New 20-sample offline cohorts pass at both widths. Actual hidden-tab behavior and funded acknowledgement remain missing, so T026 stays open. |
| Authored treasure is rendered in the level | Source and deterministic rendering tests preserve authored position/artwork and require a matching funded projection. Guest/capability/cache cannot reveal a new funded chest. |
| Rendering and interaction are independently recoverable | Existing artwork survives unavailable/pending states; actions follow current scope. Runtime/UI tests pass. Exact-release live replacement/recovery cases remain open. |
| Chest presentation is stable during inspection | Immediate presentation, scoped coalescing, Back/Escape and stale callbacks pass. Two loading-feedback defects are fixed and regression-tested. |
| Loading feedback is bounded and nonblocking | Nine focused UI tests and 1,183 full game tests pass; 300 ms/ten-second feedback and completion/reopen behavior are verified without a financial success projection. |

T021's evidence review is complete with an **incomplete qualification** conclusion. It does not waive a delta-spec requirement or authorize publication. The observed frontend deployment was a separate action. Remaining tasks are T006, T007, T018, T019, T020, T026 and T035. C094 remains open at 29/36.

## Original B2 recovery assessment

The last protected original-only inspection verified the original 1,000-sat funding chain and found a swept, expired, preconfirmed output indexed as recoverable, with no refund receipt and zero spendable sats at its two original destinations. That observation is preserved in [the original reconciliation](treasure-b2-original-reconciliation-2026-10-26.md). This pass does not read the wallet again or change its state.

The offline SDK assessment uses published trivial public-vector keys, derives public keys only, and prohibits signing and network access. SDK source and the V4 compiler match the installed 0.0.27 package. The stock `ArkadeContractHandler` skips the four covenant functions when selecting generic spending paths. Its additional game-owned exit has a CSV timelock and is excluded from collaborative selection. Both player and game roles therefore receive zero selected collaborative paths. Setting the generic-spend metadata flag supplies no missing authorization and was tested only on a synthetic metadata object.

The game-owned CSV exit is an inventory of a unilateral path, not proof of an available onchain output or maturity after the parent batch has been swept. The SDK transaction builder offers its ordinary offchain `build`/`send` flow; generic `VtxoManager.recoverVtxos` selects outputs and calls wallet settlement. The protected original refund runner requires a settled/live/non-swept input or an existing submitted signed refund journal. Neither was present in the original observation.

**No supported turnkey recovery path for this original V4 output has been validated.** This is not proof that operator-assisted or contract-specific batch recovery is impossible. A new batch-recovery adapter needs supported protocol/witness semantics and verification against the immutable original script. Flipping metadata, forcing settlement or presenting another wallet payment as its refund would not establish that proof.

The [upstream diagnostics issue](https://github.com/arkade-os/emulator/issues/119) remains open, last updated 2026-09-08 with three comments. No new evidence justifies another B1 probe.

## Next critical work

The operator/protocol owner must identify a supported contract-aware recovery route for original output `6810a50d5b77d707dcea6b2469243dfceedbedfade0175bb0119bbf7d4afcec7:0`, preserving its original game destination and actor authorizations. Its reported batch is `34fe1fe6ca6415a5be86c5a9dd319fa5d9c58dbc578ab2826402fbbce9e7b2d1:0`, swept by `1eff5b382d793fab940cb3b46c6e1317f62bbd0779a3fe178b47eb91826e0e91`. Ask for the required batch intent/witness path and exact returned-output evidence. No new funding or competing operation is needed to ask that protocol question.

After supported recovery and authoritative admission/finalization evidence exist, the missing protected live UI/lifecycle/rollback matrix can resume under fresh original-operation, budget, fee and coin checks. Until then, the public frontend remains a prototype and the treasure feature is not production-qualified.

Sanitized artifacts are in the game's `output/reports/treasure-shipping-readiness/`: public route and deployed-policy checks, guest/canary logs, 41-test privacy results, offline timing cohorts, SDK path inventory and source hashes. Shared servers and original reservations are preserved.

## Public protocol follow-up

The bounded [original B2 public protocol investigation](treasure-b2-public-protocol-2026-10-26.md) identifies a source-supported CSV ownership batch-recovery candidate. Coordinator-provided protected host-context evidence now confirms the saved original game actor matches the protected identity and records compiled script SHA-256 `0ee48440ac8c72203b4fce00a36aca48684351731f755e4be80f803a9625050f`. A fresh public operator Info response still has an empty version and no recovery acceptance field. Its generic limits and fee expressions do not prove acceptance of this contract. The only remaining B2 evidence blocker is authoritative deployed build/config or operator confirmation of the exact CSV-intent route and output/fee policy. No wallet or financial action was performed. C094 remains 29/36; no production guarantee is closed by source inference.
