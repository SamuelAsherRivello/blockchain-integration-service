# Treasure BIS bounded acceptance

For the separately authorized 2026-10-22 follow-up, see
[BIS hardening and acceptance](treasure-hardening-acceptance.md). This report
retains the earlier bounded milestone and its historical results.

## Decision and scope

C094's approved frozen milestone finishes BIS verification and records its
limits. It does not finish C094 or qualify the game for import. The canonical
[tasks](../../../blockchain-stealth-and-steel-game/openspec/changes/productionize-treasure-chest-contract/tasks.md)
retain the original qualification gates. The [live evidence history](treasure-production-acceptance.md)
and [recovery procedure](treasure-contract-recovery.md) supply detailed receipts
and operator procedures. This report supersedes historical statements there
that portable recovery or Signet browser funding are still unavailable.

Disposition: the bounded acceptance pass is closed with documented blockers
and unperformed live cases. BIS is not production-qualified. No upstream probe
was retried, and the game import remains separate.

No onboarding, new network, package upgrade, server-wallet adoption, mainnet
action, game import or release belongs to this pass. Existing 1,000-sat terms,
rounded-down original deadline and both local-wallet ownerships are unchanged.
Successful Admin testing is not a protected publisher treasury or anti-cheat.

## Evidence matrix

`Passed live` means the receipt verifier traced the actual original contract,
checkpoint and exact asset-free 1,000-sat payout. `Passed deterministic` proves
the named local safeguard only. `Unperformed` and `Blocked` are not passes.
Network receipts below were already verified; this pass does not repeat them.

| Required case | Signet browser | Mutinynet browser | Mutinynet co-signer |
| --- | --- | --- | --- |
| Real funding and Claim | Passed live S1 | Passed live M1 | Passed live C1 |
| Player begins empty | Passed live S1 | Unperformed: original zero-balance precondition not established | Unperformed: original zero-balance precondition not established |
| Early explicit Reject | Passed live S2 | Passed live M2 | Passed live C2 after original reconciliation |
| Original expiry/refund | Passed live S3 | Passed live M3 | Passed live C3 |
| Source close, encrypted export/import, exact refund | Passed live S4 | Passed live M4 | Passed live C4 after original reconciliation |
| Original profile recognizes other profile's spend | Passed live S4 | Passed live M4 | Passed live C4 |
| Lost acknowledgement and original recovery | Passed live, see history | Unperformed: intentional loss not established | Passed live C2/C4; not remote-admission timing proof |
| Session-end cancellation, distinct from window close | Passed deterministic; live unperformed | Passed deterministic; live unperformed | SDK-signed cancel plan passed deterministic; live unperformed |
| Duplicate/competing operations | Passed deterministic; adversarial live race unperformed | Passed deterministic; adversarial live race unperformed | Passed deterministic; adversarial live race unperformed |
| Wrong identity/network, stale or substituted terms | Passed deterministic; live replacement unperformed | Passed deterministic; live replacement unperformed | Passed deterministic; live replacement unperformed |
| Asset carrier and exact asset-preserving change | Passed deterministic; live unperformed | Passed deterministic; live unperformed | Local binding covered; live asset-carrier case unperformed |
| Insufficient funds and fee-policy change | Passed deterministic; live unperformed | Passed deterministic; live unperformed | Policy tests passed; live unperformed |
| Creation-disable rollback and legacy recovery | Passed deterministic; live rollback unperformed | Passed deterministic; live rollback unperformed | Original-plan tests passed; live rollback unperformed |
| Corruption, stale import, reset/logout safeguards | Passed deterministic | Passed deterministic | Passed deterministic |
| Network-enforced deadline/destination bypass rejection | Not claimed: disclosed browser policy | Not claimed: disclosed browser policy | Blocked B1, isolated VM is not remote proof |
| Admission before expiry, finalization after expiry | No remote-enforcement claim; local pending-state tests passed | No remote-enforcement claim; local pending-state tests passed | Blocked B2; original recovery success is insufficient |
| Funded-action responsiveness p95 | Unperformed U1 | Unperformed U1 | Unperformed U1 |
| Imported-game UI and artifact provenance | Deferred, no import | Deferred, no import | Deferred, no import |

### Receipt index

Each value is a public payout transaction at output 0. Funding/checkpoint
details and exact verification are retained in the evidence history and protected
test journal, not reconstructed from a balance or a toast.

| ID | Payout transaction |
| --- | --- |
| S1 | `3bc65a1fab9e638755762c5baf92e15e7b632b3bdd71bb603fd495f1e763af1c` |
| S2 | `6c47631db82817f6bc73a74cf12593e65667d301b721ce4579e8af9f8c86d1b5` |
| S3 | `040f66b91b24dfd684487f38aab6a1d86c7615407c7bcaa15ce1d5c67c579b26` |
| S4 | `1ebb57b4f3c280aaf51b1847d8582c8a9b3240c0a7c6b3651dc33a313c458b4d` |
| M1 | `fbf4180e40611687d664fb6c87657e2664f5d74f23b88527106b6bf3449d2e5c` |
| M2 | `af3198fece931160e0ac309fb58cc9bff3ac489e67ca23f2dc1af0238ad3918e` |
| M3 | `c4e533db12fa90e8e5bea82148104819d92ef4c7bdc03d82f0a6463988e0d5c9` |
| M4 | `ec1f1c203406c2ae3a0a76effbe06c1725d5eef66ef861cc1ca05cc98e398bb9` |
| C1 | `493efce42de8ce95d7362419f725a98eccc72370e69a301f2831f9906da4f626` |
| C2 | `b357d3826545f8ccc781341251dc601534aa50a4d59f43244f4a8e2d55d0e2bf` |
| C3 | `13ae2ecea82cb06df481ef53cabf68aa2c79ad9f15f69e0be325547c03baed31` |
| C4 | `c1a10250105ce1bbee1afd017508b792d537d21de44ea4f7d61a20c4c43293ea` |

C2 funded `0aa9a34a737516d591e871242fb6af024967c6f556757aac5d94cae6e78f94fd:0`.
Normal Contract Details refresh verified checkpoint
`9ea119702f9fd653c09062ce455cf7812d2861e945743c5df457dbb238af5cc1`
and its original 1,000-sat refund. It did not create another refund. M2 funded
`ee8cce0490d30afb5968f16dbe40a4bb11ddee46110a047f213d05ce81b31215:0`
and normal early Reject verified the bound Game Wallet payout.

## Local implementation checks

The focused suite passes 87 tests in
`output/reports/treasure-contract/bounded/focused.txt`. These tests are not live
network proof. They cover:

- `integration/tests/client/contracts.test.ts`: immutable terms, duplicate
  sessions, scoped exclusivity, session-end during funding, pending claims across
  expiry, exact operation completion and allowlisted public projections.
- `integration/tests/client/lto-service.test.ts`: durable acceptance, no late
  Start, account/network mismatch, reservation isolation, session replacement,
  reset refusal, logout retention and creation-disabled recovery.
- `integration/tests/client/lto-adapter.test.ts` and `lto-contract.test.ts`:
  SDK construction, original signed submission/finalization, fee changes,
  depleted inputs, asset-preserving change and exact receipt validation.
- `contract-portable-recovery.test.ts` and `treasure-recovery-plan.test.ts`:
  authenticated encrypted import/export, stale/conflicting records, full signed
  plan validation and recognition of the original other-profile payout.
- `integration-admin/tests/client/treasure-session.test.ts`: immediate local
  Start, single-flight reads, wallet-network/deadline binding, restored-cache
  ineligibility, late old reads, duplicate clicks and pending status across expiry.

The Admin fixes share the pending inspection promise, scope it by generation,
require exact network/deadline and keep restored sessions unavailable until
matching BIS inspection. They do not change the adjacent game's runtime.

## Stop conditions and outstanding work

| ID | Disposition and owner | Reopening condition |
| --- | --- | --- |
| B1 | Blocked: Mutinynet co-signer invalid-spend admission. Operator diagnostics are missing; BIS cannot infer the reason from gRPC 13. | Operator provides explicit rule rejection evidence or a supported diagnostic interface; then a separately bounded proof can run. |
| B2 | Blocked: remote admission clock and delayed finalization. Needs operator protocol evidence, not another blind attempt. | A supported observable admission/finalization boundary and original-operation receipts are available. |
| B3 | Blocked: deployed-host security qualification, owned by host/release work. No CSP meta tag in Admin HTML; the checked dev response has no CSP header. Browser-local signing is not same-origin isolation. | Reviewed production CSP/connect destinations and deployed response verification, with game host assessed separately. |
| B4 | Dependency review finds low-severity documentation-renderer advisories; upgrades excluded by the freeze. | A separately scoped dependency fix and regression review. No audit claim of exploitability or absence of other vulnerabilities. |
| B5 | Full-suite qualification is not green. Separate server-wallet checks failed in two runs; the final failed strict fixture passed on immediate targeted recheck while that concurrent worktree changed. | The owning work finishes and a stable full worktree regression passes; do not chase unrelated edits in the frozen treasure pass. |
| U1 | Unperformed: funded slow/offline action timing. Guest navigation measurements cannot prove financial interaction UX. | A controlled non-destructive funded UI latency case with original-operation preservation and documented reference setup. |
| U2 | Unperformed: missing live session-end, adversarial race, network replacement, asset-carrier and rollback cases in the matrix. Existing fixture does not establish these exact scenarios. | A dedicated scoped acceptance fixture and verified original-state/asset preconditions. No new behavior or fabricated outcomes may be introduced to make a case pass. |
| D1 | Deferred: game import, rendering, gameplay feedback, game latency and imported-artifact qualification. | BIS qualification review and explicit resumption of the separate import phase. |

No new funded transaction is required to inventory evidence or test a local
safeguard. This pass does not attempt the already blocked upstream probes.
Missing live cases remain unperformed rather than starting new funding under
an unsuitable fixture. Any future approved case permits only one funded
attempt per case/configuration, at most 120 seconds observation and one exact
original-operation reconciliation. Unknown work keeps its reservation. It does
not justify a replacement transaction, a mode downgrade or an automatic retry.

## Custody, secrecy and rollback review

The recovery guide explicitly requires the original local Player and Game
Wallets, separate phrase restoration, protected password/file storage and closing
the old client. `contract-portable-recovery.ts` accepts only allowlisted recovery
fields, excludes phrases/private signing keys, and authenticates the encrypted
envelope. Public contract projection tests reject private fields. Signed original
requests and preimages remain private. Same-origin code can still invoke local
signing, so CSP/dependency review is a real gate, not an encryption guarantee.

The 2026-10-22 production-dependency audit reports three low-severity affected
packages, no moderate/high/critical advisories: `dompurify`, `katex`, and direct
Admin documentation dependency `mermaid`. The raw non-secret audit is
`output/reports/treasure-contract/bounded/dependency-audit.json`.
`documentation.tsx` sets Mermaid's `securityLevel: 'strict'`, but later inserts
its SVG with `innerHTML`; this is not proof those dependency advisories are
unreachable. No dependency version or lockfile is changed by this pass.

The Admin now states beside Start that it locks 1,000 sats from the selected
Game Wallet, that both wallets are local, and that this is not a protected
publisher treasury. The shared co-signer description explicitly says live
deadline rejection and admission timing are not fully qualified. Options and
defaults are unchanged. The deployed game consent/CSP review still belongs to
T010 and cannot complete without that separate host assessment.

Rollback uses `createBisLto({creationEnabled:false})`; reads, original journals
and recovery remain available. Public-factory and controller tests cover this
locally. It is not a verified live rollback drill. Never clear storage, rewrite
a funded script/deadline or resend an uncertain payment to roll back creation.
Batch renewal, Bitcoin settlement and an economical 1,000-sat unilateral exit
remain unqualified, as stated in the recovery procedure.

## Final verification

### Browser timing and its limits

Reference setup: Windows x64, Intel Core i9-13950HX, 32 GiB RAM,
Headless Chromium 155.0.0.0, 1280 by 720 viewport, current Vite development
build, fresh wallet-free profile. The runner measures captured pointerdown to
the matching dialog-visible/hidden state and a following animation frame. This
is a local DOM/frame presentation proxy, not physical display latency or
network confirmation. Each row has 20 samples and zero observation timeouts.

| Condition | Account open p95 | Back p95 |
| --- | --- | --- |
| Cold, HTTP cache disabled and reload before each pair | 35.2 ms | 27.3 ms |
| Warm | 20.9 ms | 17.6 ms |
| External HTTPS requests delayed ten seconds | 19.5 ms | 14.5 ms |
| Browser offline after loading | 17.8 ms | 13.1 ms |

All measured rows meet 100 ms. The guest path does not require a provider read;
the delayed-request condition therefore demonstrates navigation independence,
not behavior during a real blocked funded request. Claim/Reject, portable KDF,
Contract Details under real provider delay, and game chest presentation remain
unmeasured. U1 remains unperformed, not passed. No financial projections or
fake payment outcomes were injected. Raw results and the reproducible runner
are `output/reports/treasure-contract/bounded/ui-timing.txt` and
`measure-admin.cjs`. No page JavaScript errors occurred in measurement. The
existing `/api/bis/connect` 404 belongs to the concurrent server-wallet feature.

### Reservation and server disposition

The read-only protected-ledger inventory finds zero nonterminal treasure or
portable test reservations. Sanitized data is in
`output/reports/treasure-contract/bounded/reservations.json`. This is a journal
inventory, not a new network-wide balance audit. Earlier unacknowledged
prototype funding dispositions retain `networkOutcome: unknown`; they are not
retroactively declared network failures. No new funded attempt or upstream
negative probe ran in this bounded pass.

The previously recorded frontend/faucet processes were absent at the next host
check. The standard locking root helper started the stopped shared preview on
5174, frontend PID 94104, instance `9eb3beb9-789d-4902-9138-f13aee806449`.
All eight configured routes returned HTTP 200 with their expected identities.
No existing process was killed, port reassigned or wallet/browser data erased.
The prototype test suites are credential-free regressions, not onboarding or
faucet operations.

### Regression disposition

Typecheck and `npm run build:all` pass after the final disclosure fix in
`bounded/final-build-all.txt`. A fresh root typecheck also passes in
`bounded/current-typecheck.txt`. Separate
prototype regressions pass 92 onboarding tests and 19 faucet tests; the faucet's
explicitly gated live test is skipped. These tests do not perform onboarding.
The final treasure safeguards, Admin session/rendered disclosure and mode tests
pass 90 tests with zero failures in `bounded/final-focused.txt`. The isolated
pinned bytecode proof passes in `bounded/vm-proof.txt`; it is not remote proof.
Reports are under `output/reports/treasure-contract/`.

The earlier full run passed 1,305 of 1,306 tests and failed the separate
`bis-server/tests/local-browser.test.ts` owner-controls test at line 86 while
waiting for `Game server unavailable`. It is not a treasure test. The baseline
failure is preserved in `bounded/full-suite.txt`; it is not excluded or marked
green.

The final full run after the last treasure fix records 1,306 passed and one
failed out of 1,307 in `bounded/final-full-suite.txt`. The failure is the strict
public game-contract type fixture reporting TS7006 at the concurrently edited
`wallet-layer-arkade/server-settlement.ts:45`. No treasure file is named by the
diagnostic. The immediate targeted recheck of that exact fixture passes in
`bounded/server-type-baseline.txt`, and the root typecheck passes. The separate
server-wallet code was not changed by this pass. A targeted recheck is not a
replacement for a green full run, so B5 remains a full-worktree qualification
gap. There is no repeated full-suite chase after this bounded disposition.

`bounded/source-identity.json` records SHA-256 hashes of seven relevant source
files and the observed BIS version 0.0.26. These identify the checked candidate,
not an exported package or a released artifact. Existing live receipts predate
the final Admin-only inspection/disclosure changes. They are retained evidence
of those lifecycle tests, not proof of an exact imported game package.

The bounded tasks are complete as evidence/review/disposition tasks. T006,
T007, T010 and the original whole-feature qualification gates remain incomplete.
No mainnet, deployment, dependency import, archive, Git commit or release ran.
