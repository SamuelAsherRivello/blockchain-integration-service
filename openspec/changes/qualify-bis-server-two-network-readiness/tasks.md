# Tasks

## Deferred after the current release

By the user's 2026-10-29 decision, this change is future hosted Mutinynet support. Preserve its existing task states. Do not execute or require its hosted Mutinynet configuration/acceptance during the current Mutinynet Local + Signet Server release. Local feature parity is mandatory in `add-bis-server-game-wallet`, the Treasure changes and the standalone Sandbox Treasure Hunt change. A Local-wallet result cannot complete a hosted task here.

## Current execution order, 2026-10-30

- Owner: server/BIS execution chat; see the current takeover section in the BIS program ledger for its exact chat ID and file boundary.
- Preserve existing task IDs, checkboxes and historical evidence. This ownership update completes no acceptance task.
- Retain the Signet release prerequisite. Prepare independent deterministic and configuration work concurrently; enable Mutinynet only after its existing per-network acceptance passes. The original Treasure B2 output does not by itself block unrelated server verification.
- Reconcile actual commits and unrelated dirty work before scoped commits on main. Do not create a branch/worktree or include unrelated changes.
- Stop unchanged status polling and repeated blocked probes. Record only a result, changed prerequisite, concrete defect, accepted artifact or required decision. Financial actions require the coordinator's sole slot and all existing journal/budget gates.

## 1. Network-scoped configuration and policy

- [x] 1.1 Audit Signet and Mutinynet runtime configuration, environment isolation, caps, and state namespaces; add or correct any gap and verify focused server tests prove there is no cross-network fallback. (Evidence: `output/reports/bis-server/two-network/2026-10-27/network-policy-acceptance.md`; wallet-pool regression coverage now also proves a public signer identity duplicated across Signet and Mutinynet is excluded from both pools, while independent candidates remain available.)
- [x] 1.2 Verify the three-slot candidate policy on both networks using fresh balance responses, including missing, malformed, duplicate, unknown, insufficient, and operation-appropriate balances; record deterministic results without exposing secrets. (Evidence: focused wallet-pool suite exercises each condition with deterministic balance readers; see report.)
- [x] 1.3 Verify existing and interrupted operations remain pinned to their original network and signer across balance changes, backend restarts, and manual fallback; record regression coverage. (Evidence: client-selection and signing-store checkpoint suites cover balance drain, cancellation, network replacement, cold instances, exact replay, and unresolved-operation quarantine; see report.)

## 2. Hosted network acceptance

- [x] 2.1 Configure private Signet and Mutinynet test identities independently in the existing free-tier Vercel project and datastore; verify health and public identity routes for both without exposing secret values. (Evidence: `output/reports/bis-server/two-network/2026-10-27/preview-qualification.md`; Preview-only allowlist, distinct Preview Redis endpoint, storage-ready health, both live identity routes ready with distinct public identities, no secrets exposed.)
- [ ] 2.2 Exercise deployed policy rejection, request binding, quotas, idempotency, replay protection, concurrency, and cold starts separately on Signet and Mutinynet; save sanitized evidence under `output/reports/bis-server/two-network/`. (Partial deployed evidence: protected Preview wrong-game and no-grant rejection probes, plus network- and profile-bound connection-token rejection probes, returned the expected denial on both networks; one valid connect per network was accepted. Local deterministic slice passed 6/6 for caps, rate limits, network allowlisting/missing-Mutinynet fail-closed, exact replay across cold instances, and concurrent signing refusal. These local fixtures are not deployed valid-grant acceptance. Current latest Preview is READY at commit `87580a56c7f67d0869c1511cbfed8bcf3a2cdcf6`; independent read-only Vercel metadata cross-check (report: `output/reports/bis-server/two-network/2026-10-29/vercel-deployment-metadata-readonly-2026-10-29.md`) confirms Preview READY but cannot verify its protected route; latest Production is READY as a redeploy with no commit metadata, so source identity remains unverified; direct unauthenticated health/identity requests return Vercel 302 protection, and one authenticated CLI read timed out after 10 seconds. A separately authorized 300-second bypass was later used only for read-only `GET /api/bis/health` (HTTP 200; `service=bis-server`; sanitized health counters reported Signet=3 and Mutinynet=3), then revoked immediately. This is endpoint-health evidence only; no identity/connect/valid-grant probe, signing, or wallet action occurred, and no 2.2 acceptance criterion is closed by this request. Deployed valid-grant quotas/idempotency/replay, concurrency, and cold-start cases remain open; see `output/reports/bis-server/two-network/2026-10-27/preview-qualification.md` and `local-signing-policy-slices.txt`.)
Wallet-free follow-up (2026-10-28): current-tree Signet submit/finalize policy and durable journal fixture slice passed 7/7 (`tests/arkade-write-proxy.test.ts`, `tests/arkade-write-hosted.test.ts`, `tests/native/arkade-submission-store-redis.test.ts`). This adds local exact-request/signature binding, one-attempt, replay, and unknown-outcome coverage. It does not exercise deployed valid-grant policy on either network; task 2.2 remains open.
Focused signer-metadata follow-up (2026-10-28): `node --test BIS/packages/bis-server/tests/arkade-write-proxy.test.ts` passed 5/5. A regression proves a durable completed signer result with altered `sighashType` is rejected against the original request; PSBT signature-field classification now uses exact fields, so `sighashType` remains bound unsigned metadata. The prior matcher already rejected this mismatch, so this is a classification/diagnostic correction, not evidence of a signing bypass. Deployed valid-grant policy on either network remains untested; task 2.2 remains open.
- [ ] 2.3 Complete bounded real Signet signing acceptance using approved test wallets; verify actual network evidence and reconcile the operation before any competing spend. (Read-only audit at 2026-10-28 08:43 UTC found 5 unresolved Signet refund operations: two `unknown` and one `submitting` without provider IDs; two `failed` rows carry only opaque `batch:` references, not transaction IDs. The protected wallet ledger stores no provider response body/error field, and there is no matching Admin/proof/V4 qualification run keyed to these operations. The existing Admin UI was opened with all external requests blocked, but its Contracts UI action was disabled because no account was active; no contract row or provider response was exposed. A direct read-only IndexedDB open failed with Chromium `UnknownError: Internal error`. Nothing was reconciled, retried, signed, or altered. Fresh 1,000-sat guard probes at 08:52 UTC refused both Signet and Mutinynet with `acceptance-budget-unverified`; journal-only earliest possible checkpoints are Signet 2026-10-29 08:41:47.239 UTC and Mutinynet 2026-10-29 08:32:13.421 UTC, assuming no new operations and unchanged fee evidence. A later narrowly filtered Vercel Production runtime-log query for `clean-signet-mvrlrrg6-recover` returned HTTP 400 because Hobby retains runtime logs for only one hour. This is not a zero-result query and supplies no transaction disposition; the old log window is unavailable and no further query was made. See the closeout report.)
- [ ] 2.4 Complete bounded real Mutinynet signing acceptance using its separate approved test wallets; verify actual network evidence and reconcile the operation before any competing spend.

## 3. Consumer release and closeout

- [ ] 3.1 Update BIS clients and documentation to enable both hosted networks after acceptance; verify Mutinynet remains explicitly unavailable when its server configuration is absent. (Partial: added and ran `BIS/packages/bis-server/tests/hosted.test.ts` case “Mutinynet identity and connect stay unavailable when no Mutinynet signer is configured”; Signet remains ready while the unconfigured Mutinynet identity/connect fail closed with HTTP 503. Also ran the server-first/manual-fallback client suite, 12/12 passed. Repository typecheck passes. Do not enable Mutinynet until tasks 2.2–2.4 pass.)
- [x] 3.2 Export and import the exact verified BIS package into Stealth & Steel; verify package hash, dependency lock, endpoint configuration, and matched release versions. (Evidence: game `@bis/integration` 0.0.29 tarball SHA-256 `3617a257a9d1e48084d9e845d9d911747735d3dff9dcd6f4bb9fb0d51d89aff6` matches its inventory, installed files, package.json, package-lock resolved entry and SRI; `node stealth-steel/tools/verify-bis-package.mjs` passes 201 files. Provenance pins BIS source commit `0a2b1726877fa6f85917c13bebbe29dbaf4e5d72`, verified in GitHub. Game release metadata and live versioned Pages metadata are v0.0.29; the deploy workflow uses `https://bis-server-rho.vercel.app/api/bis/`. This closes exact package/config/version parity only; two-network signing enablement and acceptance remain gated on 2.2–2.4 and 3.1/3.3.)
- [ ] 3.3 Run focused and full BIS/game suites, production builds, real contract checks, and deterministic server-absent fallback checks; publish both Pages workflows and verify public routes and identities. (2026-10-29 independent game Pages/CSP slice: 9/9 tests passed; report `output/reports/bis-server/two-network/2026-10-29/game-pages-csp-focused.md`. BIS deterministic creation-disabled LTO rollback suites then passed 24/24; they prove new creation stays unavailable while existing inspection/refund/recovery remains accessible and reset preserves unresolved journals. This is fixture-bound local behavior, not live wallet or contract acceptance; task map and evidence: `output/reports/bis-server/two-network/2026-10-29/rollback-and-game-performance.md`.) (Partial: 2026-10-28 corrected current-tree root `npm test` yielded 1,774/1,775 in the restricted shell; its sole process-ownership test then passed within the separately rerun file (8/8) under scoped inspection. Root typecheck and `build:all` pass. Combined evidence: `output/reports/diagnostics/bis-final-root-suite-2026-10-28/npm-test-summary.txt`. Current local game `npm test` passed 1,192/1,192 after C096-T006 (log: `D:\Documents\Projects\VC\Bitcoin\blockchain-stealth-and-steel-game\output\reports\diagnostics\treasure-root-suite-2026-10-28\npm-test.log`); the game package verifier and build pass for its local 0.0.30 candidate. That archive SHA-256 is `5f031b0915fb7b865679fdd080c74b3e906a58c0a0f6f1c8a0373a2165da6ede`, but provenance points to dirty BIS commit `a77ad6b20da03e0a063cd689bd6a5f4d9663ee83`, not the current/final clean BIS release source. It is not the exact accepted candidate and no Pages publication of that final artifact is evidenced. Read-only game inspection confirms package/lock and public Pages metadata v0.0.30; checked-in `public/environment.json` is a build input placeholder, not evidence of a deployed mismatch. Separate game task C094-T038 checks imported version and archive SHA-256 against lockfile, verifier and provenance; managed-guest and real funded Signet Claim/Reject receipts remain open. Current live acceptance remains blocked by protected rolling-budget gates; no BIS release was published from the dirty candidate. See `output/reports/bis-server/two-network/2026-10-27/consumer-release-verification.md`. New read-only Pages evidence (report `output/reports/bis-server/milestone-1/public-pages-readonly-2026-10-28.md`): BIS #306, game Release #7 and Pages #172 all succeeded; public BIS routes and game route return 200 with matching 0.0.30 markers, and all 18 tracked root asset PNG URLs return 200. These deployed-baseline checks do not close live two-network qualification or the exact accepted-artifact requirement.)
- [ ] 3.4 Write the two-network acceptance report with per-network deployment, live signing, consumer, release, and rollback evidence; run `openspec validate` and confirm every scoped task is complete. (Partial, 2026-10-28: current BIS root `npm test` covered 1,774/1,775 cases before the sandbox denied process/port ownership inspection; the isolated ownership test file then passed 8/8 under scoped inspection, covering the final case. See `output/reports/diagnostics/bis-final-root-suite-2026-10-28/npm-test-summary.txt`. Game `npm test` passed 1,192/1,192. BIS typecheck/build passed. Local server-absent UI fallback and verified-fee reconciliation are recorded, but the rolling-budget preflight still refuses new funded intents. Signet/Mutinynet live signing, remaining deployed valid-grant qualification, client enablement, exact accepted consumer artifact, release, and rollback evidence remain open.) (2026-10-29 current evidence: the BIS root suite passes 1,805/1,805 and the focused BIS server suite 112/112; strict OpenSpec validation passes. Current Production is Signet-only: health and Signet identity are ready, Mutinynet identity is unavailable. A zero-exposure Signet proof signature verified, but no real payment-signing, Mutinynet acceptance, funded contract lifecycle, exact accepted package, release, or live rollback was verified. The 2,000-sat refund remains unknown and no further provider/indexer request was made. See `output/reports/bis-server/milestone-1/verification-2026-10-29.md` and `output/reports/diagnostics/bis-root-suite-2026-10-29/npm-test-host-context-summary.md`.)

2026-10-28 reconciliation of Proposal 2 remaining wallet-free work: current
source, focused policy tests, local build evidence, public route/identity
checks, and deterministic acceptance checks are recorded in
`BIS/documentation/treasure-hardening-acceptance.md`. No unchecked Proposal 2
task can be closed solely from that evidence: 2.2 requires deployed valid-grant
policy/concurrency evidence; 2.3 and 2.4 require real network signing; 3.1
requires acceptance before enabling both networks; 3.3 requires end-to-end
consumer/release evidence; and 3.4 requires complete per-network reports.
Do not retry the protected Preview timeout or infer a pass from local fixtures.
An earlier root suite did not complete cleanly: 1,748/1,770 passed, with 21
sandbox temp-directory atomic-rename failures and one process-ownership
inspection failure; the isolated affected wallet fixtures passed 30/30 using
an external permitted temporary directory. A later current-tree root suite
completed successfully: 1,773 passed, zero failed/cancelled/skipped, 816,362
ms. This supersedes the earlier incomplete run and the prior stale 1,756/1,756 citation, now replaced in task 3.3. The current-run report and full log are under
`output/reports/bis-server/milestone-1/root-npm-test-current-tree-2026-10-28.md`
and `output/reports/diagnostics/bis-p1-root-suite-2026-10-28/npm-test.log`.
No live acceptance or release is claimed.

Fresh protected gate refresh (2026-10-28 11:32 UTC) supersedes the earlier
budget forecast: registered Signet pair grants are active, but its journal has
one unknown 2,000-sat refund reservation with no provider transaction ID,
verified fee, linked Admin run, or receipt. The 24-hour Signet window contains
18 rows / 61,364 intent sats and six missing-fee records; none is a settled
record with an exact txid available to the fee verifier. The exact 1,000-sat
intent and conservative 2,000-sat lifecycle projections both refuse with
`acceptance-budget-unverified`. Do not infer failure or create a competing
operation. Evidence: `BIS/documentation/treasure-hardening-acceptance.md` and
`output/reports/treasure/2026-10-28/protected-signet-gate-host-20261028.json`.

Cross-network preflight refresh (2026-10-28 11:39 UTC): current artifact is
BIS integration/game v0.0.30 with SDK 0.4.79. Production Signet identity is
ready; Mutinynet identity is unavailable with no capabilities, and its Arkade
operator version is not disclosed. Read-only pair observations returned zero
available BTC/Arkade and zero assets for both roles on both networks; both
application journals are unavailable. Mutinynet's target pair has active
grants and no pair-scoped runner reservation, but its network-wide budget
still refuses 1,000/2,000-sat projections (`acceptance-budget-unverified`),
with four nonterminal rows and two current-window fee gaps. C096-T001 is now
closed as the executed fail-closed preflight; this does not qualify a signing
mode. C096-T002–T006 and T008/T010 remain open for their separate gates.

### 2026-10-29 current-candidate wallet-free verification

BIS Integration 0.0.31 focused wallet-free suites passed 51/51: 5 game-wallet boarding tests, 34 hosted policy/network-selection tests, and 12 network-scoped wallet-pool tests. The local coverage includes no-signer Mutinynet fail-closed behavior, cross-network rejection, six isolated signer slots with per-network priority/no fallback, scoped caps, replay, concurrency, and bounded provider fallback. No wallet, provider, indexer, Vercel, signing, or transaction call occurred. This is deterministic local evidence only; deployed valid-grant behavior, live network signing, budget reconciliation, exact accepted-package import, and Pages release remain open. Full commands and scope: `output/reports/bis-server/two-network/2026-10-29/wallet-free-focused-verification.md`.

### 2026-10-29 deterministic rollback and responsiveness mapping

The Integration LTO service and public-factory suites passed 24/24 on source
0.0.31. They prove deterministic creation-disabled behavior: new creation is
refused while inspection and refund/recovery of existing records remain
available, unresolved journals survive reset, and no duplicate financial
operation follows an unknown result. The public-factory fixture asserts no
`fetch` call. Together with the full BIS suite's contract-storage immutability
coverage, this satisfies game C096-T006's deterministic rollback/preservation
criterion. It does not represent network receipts, live wallet rollback, or
contract settlement. BIS Proposal 2 task 3.3 remains open for its broader
acceptance. The task map is
`output/reports/bis-server/two-network/2026-10-29/rollback-and-game-performance.md`.

That report also maps C096-T008's verified local v0.0.30 cold/warm/offline/slow
read metrics to its remaining gates: actual hidden-page visibility, funded
acknowledgement, provider timing, and measurement against the eventual imported
artifact are still open. The same report records an exact artifact handoff
preflight: local 0.0.31 tarball SHA-256 matches its manifest, but its source is
dirty and the game remains on the independently hashed 0.0.30 archive. No
import or publication was performed. Tasks 3.3 and 3.4 stay open.

### 2026-10-29 expanded BIS root-suite follow-up

The root `npm test` suite passed 1,805/1,805 (zero failures, cancellations,
skips, or todos; 886,694 ms) after two JSX-free Admin test files were renamed
from `.test.tsx` to `.test.ts` and entered the root runner's glob. The run used
elevated test context after sandbox-only atomic-rename `EPERM` failures; it
exercised fixtures and made no real wallet, provider, signing, or transaction
call. A WebSocket port-in-use diagnostic appeared while its test passed and
the coordinator's separate run may have been active; process inspection was
unavailable, so this first run is qualified. The coordinator's independent
normal-host rerun then passed 1,805/1,805 with no WebSocket warning (909,942
ms) and is the authoritative full-suite result. Summary and log:
`output/reports/diagnostics/bis-root-suite-2026-10-29/npm-test-host-context-summary.md`
and `output/reports/diagnostics/bis-root-suite-2026-10-29/npm-test-host-context.log`.
Report: `output/reports/diagnostics/bis-root-suite-2026-10-29-expanded/npm-test-summary.md`.
This deterministic run does not close live two-network acceptance,
budget/refund reconciliation, exact accepted consumer artifact, or Pages
release; tasks remain open.
On the same tree, `npm run build:all` (root typecheck and all workspace
builds) and `npm run check:release -- --previous-version 0.0.30` also passed.
Vite emitted chunk-size/dynamic-import warnings but all builds exited 0. This
does not establish deployment, real signing, budget clearance, or release.

### 2026-10-29 local consumer fallback follow-up

A focused 19/19 BIS UI suite verified server-first selection, stopped/missing
server manual fallback, Mutinynet unavailable copy and local wallet choices,
and Marketplace hosted/manual wallet guidance. This adds local-only evidence
for task 3.1/3.3. It does not enable Mutinynet or close deployed consumer,
funded signing, or release gates. Report:
`output/reports/bis-server/milestone-1/local-consumer-fallback-2026-10-29.md`.
Four Admin Treasure suites also passed 22/22 across their initial invocation
and a retry of the two browser cases using the repository's existing Playwright
cache. The coverage is fixture-bound local disclosure, console/readiness,
feedback, and session behavior; tasks 3.1/3.3 remain open for deployed and
funded acceptance.

### 2026-10-29 16:21 UTC execution checkpoint

Current source is main `a88a4ca49f26cce8df59342aa53b6131f27ccaa5`. Production deployment `dpl_9etPJYRhonHj9arf5Kef5wzXGsQh` is READY on the canonical alias with bundle SHA-256 `676eb60b3a036f75778e5cf9f48999f52ba8ee190437f5e27cf18af9fca42725`. The three user-authorized public signing flags are enabled for Production Signet only; existing keys, stores, protections, Preview and 5,000/10,000-sat caps are unchanged. Both Player proof client lifetime checks now allow at most five seconds of future clock skew; server expiry enforcement is unchanged. A live nonfinancial Player authentication canary passes.

The guarded 2,990-sat boarding attempt was positively reconciled as NOT SUBMITTED from its unique original prepared browser record, closed profile and complete challenge-only persist-before-dispatch logs. It had no successful financial signature, grant, provider dispatch, registration or commitment. The typed disposition preserves its previous unknown event, creates no provider ID and does not affect the old refund or B2. Counted current Signet rolling-day financial cost is zero. This is not a successful boarding receipt.

Current affected checks pass 56/56, actual committed snapshot checks 20/20, type checks, integration/backend builds, release-version transition and strict OpenSpec validation. The existing package archive is stale and UNACCEPTED; no GitHub push, Pages release, accepted export or game import occurred. The existing owner credential is unavailable to the intended local process, and the coordinator has requested its protected location. No new funded case is assigned. This checkpoint closes no additional task. Exact source, deployment, proof, package inventory and remaining prerequisites are in `output/reports/bis-server/takeover-2026-10-29/current-handoff.md`.

### 2026-10-29 18:03 UTC clean-source and guarded-driver checkpoint

Main source is `c89e9088d0cdebd27da975bedffe6305e99e221d`. Clean committed-snapshot Production deployment `dpl_68cuRB9kjff33UeyQ39rXAQ5ih35` is READY on the canonical alias with bundle SHA-256 `2eae24eb7fe7baf885db71d66bcf406440ee707b1adc1a2725c59ed4c0851ddc`. It excludes the unrelated Sandbox same-wallet edit, which remains preserved in the shared checkout. The existing separate owner credential passes positive/negative private canaries; the recovery secret and existing environment policies, keys, stores, protections and caps are unchanged.

The second guarded boarding case also has positive original non-submission evidence: its exact browser record remained prepared/not-submitted with only ordered nonfinancial challenge/authenticate requests, zero financial signing/provider dispatch and a closed original profile. Its previous unknown history is preserved, no provider ID was invented, and both cancelled cases have zero counted financial cost. All unrelated uncertainties remain protected. This is not a successful boarding receipt.

The narrow harness change removes nonfinancial proof-log disk latency from the client response path while enforcing a durable flush before every financial request or final disposition. A nonfinancial canary completes proof in 808 ms, then flushes encrypted logs before final disposition. Focused and actual committed-snapshot checks each pass 31/31, types and clean package/backend builds pass. The source of the original stop is not conclusively proven. The complete protected signing path must still fit the unchanged 120-second and SDK deadlines before a new coordinator-assigned funded case. An operation-scoped protector helper is being prepared separately; no next financial slot is issued.

The clean 202-file package inventory is prepared but no accepted archive, Pages release, consumer import or GitHub push occurred. This checkpoint closes no acceptance task. Exact evidence and current prerequisites are in `output/reports/bis-server/takeover-2026-10-29/post-auth-harness-handoff.md`.

### 2026-10-29 18:52 UTC protected transport checkpoint

Commit `b64244146387c5b15c6ade2cef86d61fca24a939` reuses one hidden, operation-scoped PowerShell process. Every call still invokes the unchanged CurrentUser DPAPI/ACL helper; no plaintext cache or protection migration was introduced. The helper closes with its operation and all three helper sources are mandatory assignment hashes. Focused integration/helper tests pass 63/63; the final boarding allowance tests pass 16/16 and types pass.

This checkpoint supersedes the earlier whole-execution 120-second wording. Production authorization/session lifetimes and individual SDK request deadlines remain unchanged. The one assigned original `srv-board-2990c-1029` pins a 300,000-ms execution allowance. At most one original read-only reconciliation remains bounded at 120,000 ms. Actual one-input/two-output SDK accounting replaces the generic 400-write/200-read placeholder: 8 expected remote signatures, 5 provider mutations, 42 server requests, at most 54 protected writes and 6 explicit reads. Measured full writes are 1.313–1.690 seconds and reads 0.595–0.902 seconds. With explicit extra-tree/I/O, operator, network and closure margin, the projection is 287,390 ms.

The c assignment freezes 228 executable source hashes. Fresh unsigned preparation verifies the original 10,000-sat Bitcoin input, exactly 2,990 sats boarding and 7,010 sats returning to the same Bitcoin owner, with zero fee. The single original execution has started; no financial completion is claimed. The separate owner access credential is deployed and its positive/negative canaries pass. The public c run receives no owner credential. No source changes, signing retries, competing spends, package export or release completion are authorized by an unknown outcome.
