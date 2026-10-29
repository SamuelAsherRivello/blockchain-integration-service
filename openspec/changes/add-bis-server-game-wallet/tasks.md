# Tasks

## Approved finite execution sequence, 2026-10-29

The user now requires Mutinynet/Direct and Signet/Server with every previously enabled feature, plus the upper-left mode label. This supersedes older statements that Mutinynet consumer behavior can remain unavailable or that public BIS publication must precede local game import. Historical checkmarks and evidence do not prove the revised candidate. Hosted Mutinynet remains deferred in its existing follow-up.

Execute these numbered steps once, completing each exit criterion before dependent work:

1. Complete 6.1, the fixed feature/evidence matrix and feasible unchanged-cap budget.
2. Complete 6.2 and 6.3, network-specific source routing and upper-left header.
3. Complete 6.4, all Direct Mutinynet BIS behavior with BIS server requests blocked.
4. Complete 5.1, all Server Signet BIS behavior, beginning with actual boarding/signing and continuing through role-appropriate payments/assets/contracts.
5. Complete the local-candidate part of 5.3 after package checks and immutable provenance, then let the game import and verify that exact hash. Publication is not a local-import dependency.
6. Complete game C094-T038/T045/T046 and C096-T005/T008/T010 acceptance for both tuples, including actual paid continuation and real Treasure receipts.
7. Finish and vet the existing Sandbox Treasure Hunt four-page lifecycle locally, including real Create/Check/Claim and separate Create/Check/Reject/refund, expiry/recovery and final candidate quality checks.
8. Complete 5.2/5.4 and game C094-T047, publishing matching versions through existing workflows with preserved immutable assets.
9. Finalize the four public Sandbox pages and 5.5 public Admin/Marketplace/game mode/version/feature checks; review/strict-validate and close only evidenced required release tasks. Keep deferred hosted Mutinynet incomplete and old unresolved operations preserved.

This order finishes Sandbox implementation before publication and uses step 9 for the requested final Sandbox vetting and release closure. It requires neither a second release nor a publication/import cycle.

## 6. Current network modes and regression closure

- [ ] 6.1 Freeze one feature/evidence matrix covering applicable account/wallet, transfer/boarding, Admin assets, Marketplace, game continuation/inventory/rewards, Treasure and Sandbox actions for both required tuples; record source baseline, each owner/expected result, actual prices/fees and a feasible per-network test budget under existing caps. Verify no enabled feature is omitted and no old unknown operation is relabeled.
- [ ] 6.2 Implement Mutinynet Direct before any BIS signer probe and Signet Server by default through the shared public composition; verify zero BIS server calls in Direct, actual manual create/restore/login, safe explicit Signet fallback, network isolation and stale-reply/pending-source preservation with focused tests and browser checks.
- [ ] 6.3 Put exactly `Server` or `Direct` in the upper-left of the shared top header after network selection, retaining network and BIS version with separate connection health; verify both modes, connecting/error states, network changes and all consuming apps.
- [ ] 6.4 Prove all applicable existing BIS features on Mutinynet Direct with the BIS server stopped/unreachable or explicitly blocked, including real required financial/asset evidence and recovery; verify every matrix row or retain a concrete blocking defect. Do not substitute hosted Mutinynet activation.

Task 5.2 is reopened for the new final candidate. Its retained v0.0.30 evidence remains historical. Tasks 5.3/5.4/5.5 now use the candidate and final acceptance ordering above; no new task is completed by this planning update.

## Current execution order, 2026-10-29

- Owner: server/BIS execution chat; see the current takeover section in the BIS program ledger for its exact chat ID and file boundary.
- Preserve existing task IDs, checkboxes and historical evidence. This ownership update completes no acceptance task.
- Finish current Signet signing, manual fallback, Admin/Marketplace release and the verified integration archive. The Treasure/game owner performs the adjacent-game import and release portions of 5.3–5.5 after the BIS acceptance gate is satisfied.
- Reconcile actual commits and unrelated dirty work before scoped commits on main. Do not create a branch/worktree or include unrelated changes.
- Stop unchanged status polling and repeated blocked probes. Record only a result, changed prerequisite, concrete defect, accepted artifact or required decision. Financial actions require the coordinator's sole slot and all existing journal/budget gates.

Current takeover evidence, 2026-10-29: the prior rolling-budget refusal has expired; the original refund still reserves its own Signet identity. Public-only hosted actor registration and exact guarded partial-boarding preparation now pass. The human explicitly approved all three Production public settlement/contract/asset opt-ins for Signet in Grill Question 1 and then requested execution through deployment. Verify actual configuration and live acceptance under the unchanged caps before closing tasks. Current source/provenance, tests, limits and exact evidence are recorded once in `output/reports/bis-server/takeover-2026-10-29/current-disposition.md`. Tasks 5.1 and 5.3–5.5 remain open.

**Release proposal 1 of 2: Signet.** Checkboxes preserve the existing verified implementation progress. This release deploys and accepts hosted signing on Signet only; the client must clearly report Mutinynet hosted signing as unavailable and retain manual fallback. Two-network qualification, Mutinynet deployment/acceptance, and remaining multi-network hardening are moved to [proposal 2](../qualify-bis-server-two-network-readiness/proposal.md). Local tasks 1.1-3.3 and hosted adapter/coordination/policy tasks 4.1-4.4 are complete; current free-plan confirmation is recorded below. Separate protected Vercel deployments pass real concurrent/replay/conflicting-input checks and alternate encrypted MuSig signing exchanges. Public signing policy and deterministic local workflow checks pass. A shared-adapter edit slot closed the implicit SDK `settle()` selection gap; the focused regression now verifies omitted params select and pass the expected fee-adjusted VTXOs/output into the original SDK method. This is local fixture evidence, not deployed or funded acceptance. On 2026-10-22, current-tree verification passed the focused `@bis/bis-server` suite (183/183), root typecheck/build, isolated deployment bundle build, release-manifest check (0.0.26), and local staged-Pages browser verification. The 1,324/1,324 root-suite pass is recorded in the separate Treasure acceptance report. The Signet-only server has since been deployed to a protected Vercel Preview with identity separation, verified remote message proof, and free-tier configuration. Task 5.1's funded Signet acceptance and matching consumer releases remain pending.

## 1. Server identity and signing compatibility

- [x] 1.1 Add `BIS/packages/bis-server` as `@bis/bis-server` with private environment loading, blank template and named README; verify configuration precedence, missing/invalid mnemonic handling and secret-free errors.
- [x] 1.2 Implement versioned public identity/capabilities and transaction/message signing; verify signatures, selected input indexes, foreign partial signatures, network/identity validation and exact request matching with real cryptographic tests.
- [x] 1.3 Implement remote support for SDK signer sessions and any exercised HD/descriptor methods; verify local/HTTP parity, nonce/transcript/replay protections, expiry and lost-session recovery. Deliver an existing-workflow compatibility matrix including minting, delivery, payments, boarding and contracts where enabled.

## 2. Resolution, fallback and UI

- [x] 2.1 Add public server-wallet references and game-role remote-identity composition without fake phrases; verify Player Wallet signatures remain local and existing browser workflows retain preparation/submission/journal/reconciliation ownership.
- [x] 2.2 Implement bounded source probes and existing manual login fallback; verify absent route, stopped server, connection refusal, unreachable configured URL and timeout all offer manual create/restore/login, while reachable incompatibility or authorization denial shows its specific error.
- [x] 2.3 Pin operation source/endpoint/identity/network/player/ID and isolate stale lifecycle work; verify backend loss never re-signs pending server operations locally, retained browser wallets are not silently activated, and returning server availability cannot replace a manually logged-in wallet during work.
- [x] 2.4 Update Developer Settings, shared banner and Admin/Marketplace composition; verify `Server` appears only for compatible connection, disappears after failed connection checks, and fallback exposes the current address/copy/loading/logout flow. Document lifecycle and source-selection behavior.

## 3. Local Vite development and secret isolation

- [x] 3.1 Mount bis-server handlers in root Vite with explicit enable/disable and HMR/disposal behavior; verify all current package routes and signer API use one listener and local middleware can be stopped/disabled to test manual fallback.
- [x] 3.2 Protect populated environment files and server imports from direct/raw/encoded serving and browser/Pages bundling; verify with disposable sentinel secrets and static artifact inspection without writing real secrets to reports.
- [x] 3.3 Add package README links, local debugging instructions and the scoped server architecture context; verify links, documented commands and sanitized client/server/operator diagnostics. Explain separate local, Preview and hosted identities.

## 4. Vercel signing service

- [x] 4.1 Add Vercel Node adapter and private environment configuration plus explicit local/Pages URL selection; verify production bundles contain only public URLs and local runs do not silently contact production.
- [x] 4.2 Add minimal shared signing-state storage and atomic coordination required across Vercel instances; verify cold starts, concurrent requests, exact retries, replay protection and safe session-loss behavior without nonce reuse or conflicting input signing.
- [x] 4.3 Implement scoped signing grants, bounded public test-wallet policies/caps and privately authenticated owner controls; verify rejected arbitrary/over-budget/unauthorized requests never sign and no owner secret ships in Pages. Document the supported policies and current workflow parity.
- [x] 4.4 Configure the Vercel project, Upstash datastore and separate private Signet test identity; verify free-plan eligibility and quota, deploy the protected Signet backend, and prove identity plus remote message-signing capability against the deployed runtime. Mutinynet signing remains disabled. Keep private values out of chat and evidence.

## 5. BIS and game integration and releases

- [ ] 5.1 Run focused signer/controller/UI suites, repository tests/typecheck/build and real approved Signet signing acceptance; verify existing game-wallet actions retain behavior remotely, manual mode still works, and Mutinynet hosted signing is explicitly unavailable. Record actual coverage under `output/reports/bis-server/milestone-1/`. (2026-10-28 current-tree verification: full root `npm test` exited 1 with 1,774/1,775 passed because the sandbox denied process/port ownership inspection in the installed project-run helper test. The exact `BIS/scripts/project-run-coordination.test.ts` file then passed 8/8 under scoped elevated inspection, covering that remaining test without weakening it. Sanitized combined result: `output/reports/diagnostics/bis-final-root-suite-2026-10-28/npm-test-summary.txt`. Current-tree root typecheck and `npm run build:all` both exited 0; build emitted only large-chunk size warnings. Read-only current-production GETs showed health storage ready with public/owner signing enabled; Signet identity is signing-ready with `sign`, `signMessage`, and `signerSession`; Mutinynet identity has no capabilities and is not signing-ready. Read-only Vercel production config is Signet-only with 5,000-sat operation and 10,000-sat daily caps. These checks do not close real Signet acceptance: protected reservation `clean-signet-mvrlrrg6-recover` remains unknown for 2,000 sats. One user-approved read-only Signet indexer request returned HTTP 200 with zero VTXOs on the returned page, but indicated additional pagination; no further request was authorized and the result cannot establish non-submission or settlement. No game-wallet payment-signing or transaction request was made. Sanitized production evidence: `output/reports/bis-server/milestone-1/production-health-identity-config-read-only-2026-10-28.json`; lookup evidence: `output/reports/treasure/2026-10-28/approved-signet-indexer-lookup.json`; detailed reservation disposition: `BIS/documentation/treasure-hardening-acceptance.md`.) (2026-10-29 update: the clean host-context BIS root suite passed 1,805/1,805; focused BIS server suite 112/112; root typecheck, `build:all`, and previous-version release check passed. Local fallback/UI evidence is 19/19 consumer and 22/22 Admin checks. An approved zero-exposure Production `/api/bis/proof` response returned HTTP 200 and its Schnorr signature verified locally; exposure and both caps were zero. This proves service message signing only, not Game Wallet payment acceptance. The refund remains `unknown`, and the budget guard refuses funded acceptance. See `output/reports/bis-server/milestone-1/verification-2026-10-29.md` and `output/reports/bis-server/milestone-1/local-consumer-fallback-2026-10-29.md`.)
Wallet-free follow-up for 5.1/5.5 (2026-10-28): focused hosted-server, Admin disclosure and signing-policy suites passed 31/31; this covers fail-closed unconfigured Mutinynet and deterministic signing choices only, with no wallet/network transaction. Full live acceptance remains required. See `BIS/documentation/treasure-hardening-acceptance.md`.
Wallet-free submission-path follow-up (2026-10-28): `node --test --test-force-exit tests/arkade-write-proxy.test.ts tests/arkade-write-hosted.test.ts tests/native/arkade-submission-store-redis.test.ts` from `BIS/packages/bis-server` passed 7/7 on the current tree. Fixtures verify exact completed-signature binding, fixed Signet upstream and request shape, a single submit/finalize attempt, exact replay, and unknown-outcome quarantine. This supplements deterministic coverage only; task 5.1 remains open for real approved Signet acceptance and task 5.5 remains open for the complete connected/manual-fallback consumer flow.
- [ ] 5.2 After current-candidate local integration and both required workflows pass, release BIS Admin and Marketplace with the public Vercel URL through the existing version/Pages workflow; verify exact workflow success, both deployed apps, matching BIS versions, required README cache-busters and preserved immutable assets. (Verified 2026-10-28: workflow #306 / run `40555662318` succeeded on remote `main` at `a77ad6b20da03e0a063cd689bd6a5f4d9663ee83`; release-version validation, build, route staging, artifact upload, and deploy steps all succeeded. Public Admin and Marketplace returned HTTP 200 with the expected titles. Remote root package and README links both identify `0.0.30` (`?v=0.0.30`). All 18 tracked trophy/marketplace PNG paths under root `/assets/` returned HTTP 200; workflow commit changed no paths under the source asset directories. Sanitized checks: `output/reports/bis-server/milestone-1/public-pages-readonly-2026-10-28.md`.)
- [ ] 5.3 After frozen source, passing required package checks and exact package/source provenance verification, export one immutable local integration candidate/manifest and import it into the adjacent Stealth & Steel repo before public publication; verify package SHA-256/version, update vendor dependency/lockfile/release metadata and required local proxy/hosted API configuration. Preserve gameplay code unless the public integration contract requires a change. Historical v0.0.29 export/import evidence is retained below. Historical game v0.0.30 candidate SHA-256 `5f031b0915fb7b865679fdd080c74b3e906a58c0a0f6f1c8a0373a2165da6ede` was built from BIS commit `a77ad6b20da03e0a063cd689bd6a5f4d9663ee83` with `sourceDirty: true`; that prior local state is no longer current. Historical checkpoint (2026-10-29, superseded by the takeover evidence above): BIS `main` HEAD and `origin/main` both resolved to `384d3f039dc6ba5546acdf5aab1c76903eb9b732`; root and `@bis/integration` versions are `0.0.31`. The package subtree has 25 tracked modifications and 3 untracked paths, so the export source remains dirty. The Production deployment with that Git commit metadata was created from a dirty local source bundle and is not a clean accepted package. No exact accepted artifact has been exported/imported and no matching game release is evidenced. Re-export/import and release gates remain open.
- [ ] 5.4 After 5.3, run the game package verifier, real BIS contract checker, full tests, publishing tests and production build; publish the matching game version through its Pages workflow and verify exact deployment success and public version identities. Historical v0.0.29 game verification and Pages deployment evidence is retained below, but it does not verify or release the current BIS candidate. Current local game verification is partial: `npm test` passed 1,192/1,192 after the C096-T006 test change (log in adjacent game repo: `D:\Documents\Projects\VC\Bitcoin\blockchain-stealth-and-steel-game\output\reports\diagnostics\treasure-root-suite-2026-10-28\npm-test.log`); the current 0.0.30 package verifier/build also pass as recorded in the adjacent game's provenance, but its BIS source is dirty and not the final accepted artifact. New public baseline verification: game Release #7 (`40627562919`) and Pages #172 (`40628677988`) succeeded; their jobs passed the immutable-package verifier, full suite, real BIS contract check, production build, and Pages deploy. Public game route returns HTTP 200 and the deployed bundle carries version `0.0.30`, matching the game manifest, BIS manifest, and lockfile. This proves the existing 0.0.30 baseline was published; 5.3 is still not complete, so it does not prove release of the exact accepted BIS artifact required by this task. Keep 5.4 open.
Historical 2026-10-27 v0.0.29 evidence for the prior 5.3/5.4 completion: the archive and all 201 installed package files matched inventory (SHA-256 `3617a257a9d1e48084d9e845d9d911747735d3dff9dcd6f4bb9fb0d51d89aff6`); package/contract checks, full suite 1,189/1,189, publishing 10/10, typecheck/build passed; the matching Pages deployment succeeded. Stable and `/releases/v0.0.29/` public `environment.json` routes returned HTTP 200 with `releaseVersion: v0.0.29`, and game deploy-pages workflow run 168 succeeded. This is retained as historical evidence, not completion evidence for the current BIS candidate.
- [ ] 5.5 Verify local Admin/Marketplace/game connection/debug flow, published Admin/Marketplace/game Signet Vercel signing without Game Wallet Login, explicit Mutinynet unavailability, and controlled server-absent/manual-login behavior. Separate live network evidence from deterministic UI tests and deliver the Signet release acceptance report; then begin proposal 2. (Partial no-spend public check, 2026-10-28: published game `v0.0.30` metadata and root HTML returned HTTP 200; its 18 reachable JavaScript assets embed the production BIS server URL, server-wallet UI labels, and manual Game Wallet login/fallback copy; Production Signet identity returned HTTP 200 with `sign`, `signMessage`, and `signerSession` capabilities. Headless game UI stopped with Babylon error #50/WebGPU unavailable before the account screen, so no game connect request or UI connection was verified. No wallet was created/logged in and no payment-signing or transaction request was made. A separate 2026-10-29 zero-exposure Production `/api/bis/proof` request returned HTTP 200; its domain-separated Schnorr signature verified locally against the returned identity, with exposure, operation cap, and daily cap set to zero. Production Signet identity is signing-ready; Mutinynet identity remains unavailable. This is deployment message-proof evidence, not a Game Wallet operation or Treasure Claim/Reject acceptance. Local client checks now include 19/19 server-first/Account/Marketplace and 22/22 Admin readiness/disclosure/feedback/session cases, but are deterministic UI evidence. Task 5.5 remains open pending published Admin/Marketplace/game connection/debug verification, real payment-signing without Game Wallet Login, controlled server-absent/manual fallback, and funded contract acceptance. Evidence: `output/reports/bis-server/milestone-1/verification-2026-10-29.md` and `output/reports/bis-server/milestone-1/local-consumer-fallback-2026-10-29.md`.)

Local Admin/Marketplace manual-fallback follow-up (2026-10-28): managed Playwright loaded both local routes at `http://127.0.0.1:5174/admin/` and `/marketplace/` (v0.0.30). The Admin Account Dialog preview and Marketplace Account dialog both rendered `You are not logged in` with Create Account and Restore Account choices. Marketplace explicitly says Player Wallet is required for item display/sales and describes logging into a separate Game Wallet for manual mode; both wallet statuses remained Not connected and listing/sales remained disabled. Automatic local `POST /api/bis/connect` returned 404 on both routes, confirming this checkout had no reachable local BIS signer. Marketplace catalog GET returned 200. Only Account/story previews were opened; no create/restore/login control was activated, and no account, wallet, credential, signing or transaction action occurred. Screenshots: `output/screenshots/bis-server-manual-fallback/local-admin-account-dialog-2026-10-28.png` and `output/screenshots/bis-server-manual-fallback/local-marketplace-account-dialog-2026-10-28.png`. This verifies visible manual account choices in the local server-absent state only; it does not establish successful login/manual wallet behavior, hosted signing, or funded acceptance. Keep 5.5 open.

2026-10-28 Marketplace source correction: guidance now distinguishes the selected hosted server Game Wallet from the manual-wallet fallback. When the connected server Game Wallet is selected, page copy explicitly says a separate Game Wallet Login is not required; manual mode still instructs users to log in separately. Listing/sales prerequisites and the trade-disabled explanation now describe the active wallet source. Three deterministic copy tests, repository typecheck, and the Marketplace production build passed. A follow-up ran the focused server-first, Game Wallet, app-session, and session-notification suites: 51/51 passed, covering server precedence, no-secret selection, server loss/manual fallback, and lifecycle notification behavior. The built Marketplace bundle contains both the hosted and manual guidance and no longer contains the prototype “simple POC” login instruction. This remains deterministic/source/build evidence only: no browser rendering or live Marketplace connection was verified, so 5.5 remains open.

Managed browser rendering attempt: the local production preview on loopback port 4181 timed out from both the managed Playwright browser and Codex in-app browser. The preview process was stopped. No page or API request loaded; this confirms the current environment cannot provide local rendered evidence and does not indicate an application failure. The build and deterministic tests remain the available evidence; task 5.5 stays open.

2026-10-28 read-only published-route check: unauthenticated HTTP GETs to BIS Admin /admin/, BIS Marketplace /marketplace/, and the Stealth & Steel game root each returned HTTP 200 with the expected page title. This establishes static route availability only; no application session, runtime wallet behavior, signing, or financial action was exercised. Sanitized result: output/reports/bis-server/milestone-1/published-pages-read-only-2026-10-28.json.

Additional no-wallet 2026-10-28 task 5.5 check: published Admin and Marketplace routes return HTTP 200; all referenced route-entry bundles return HTTP 200, and each application bundle identifies BIS 0.0.30 and includes the production server URL plus the documented Signet/Mutinynet signing choices and unavailable-state copy. The published game lazy-loaded main/integration bundles likewise include the production URL, Signet configuration, Mutinynet-unavailable state and server Game Wallet label; direct Production identities report Signet ready and Mutinynet unavailable. These are static artifact/identity checks only. They do not verify rendered account UI, connection/session, hosted signing or funded contract execution. Details: `BIS/documentation/treasure-hardening-acceptance.md` and the adjacent game acceptance handoff. Task 5.5 remains open.

Managed-browser UI follow-up (2026-10-28): opened the published game at `https://samuelasherrivello.github.io/blockchain-stealth-and-steel-game/?muteMusic=true&muteSFX=true` in the managed Playwright browser; the game rendered (BIS v0.0.30), Start Game opened gameplay, Settings opened, and Account displayed the logged-out Account dialog with Signet selected, `BIS: v0.0.30 Server`, and Create Account/Restore Account controls. The page reported zero console errors and one Windows WebGPU `powerPreference` warning. No account was created or restored, no wallet connector was invoked, and no signing/funding/contract action occurred. Screenshot: `output/reports/bis-server/milestone-1/game-account-guest-dialog-2026-10-28.png`. This verifies only the public logged-out Account UI; it does not establish a managed guest session, wallet connection, or funded Claim/Reject receipt. Task 5.5 and game C094-T038 remain open.

Published runtime UI follow-up (2026-10-28): managed Playwright inspected the live `/admin/` and `/marketplace/` pages, both v0.0.30. Admin showed its Server label, Player-payment action disabled until Player login, idle Smart Escrow, and a Treasure panel explicitly using “Browser validation (less secure)” with no Signet co-signer configured and both wallets locally controlled. Page initialization made exactly one observed BIS API request, `POST /api/bis/connect`, which returned HTTP 200; no `/sign` or other financial/contract request appeared. The response body was not inspected because it contains a live session token. This demonstrates a server-wallet connection without Game Wallet Login only; Player login may remain required. Marketplace page initialization likewise made one `POST /api/bis/connect` returning HTTP 200, but its rendered state still showed both Player and Game wallets Not connected, listing/sales Disabled, and copy requiring Player login plus Game Wallet login. No Account/login/session/wallet/contract controls were activated; no signing, funding, or contract request was intentionally initiated. Marketplace console had zero errors and zero warnings. Screenshots: `output/reports/bis-server/milestone-1/published-admin-treasure-browser-validation-2026-10-28.png` and `output/reports/bis-server/milestone-1/published-marketplace-wallet-prerequisite-2026-10-28.png`. The acceptance spec requires applicable game-wallet behavior without Game Wallet Login; it does not prohibit Player login. This confirms the server signer endpoint responds to both pages but the published Marketplace does not surface it as a connected Game Wallet and still asks users to log in the Game Wallet; v0.0.30 is not the accepted candidate. Do not promote it as satisfying the hosted-wallet flow. BIS task 5.5 remains open pending live Signet signing and end-to-end verification; funded Claim/Reject belongs to the separate game/Treasure task.
## 2026-10-26 release checkpoint

Task 5.2 is complete for the already-published BIS 0.0.27 Pages release: workflow run 40373515541 succeeded on `87580a56c7f67d0869c1511cbfed8bcf3a2cdcf6`; Admin and Marketplace routes both return 200 with the expected app titles; both deployed bundles contain `https://bis-server-rho.vercel.app`; README cache-busters match 0.0.27; the existing Marketplace v1 asset and catalog routes still return 200. This records verification of that release and does not authorize another publication.

The matching game 0.0.27 workflow (40373581687) also succeeded, and its deployed route returns 200. The imported tarball matches the local 0.0.27 export hash, but that export records source commit `53e80fe9df0d7179286d003fcede28ca28768a5d` with a dirty source tree. Current BIS `main` is `87580a56c7f67d0869c1511cbfed8bcf3a2cdcf6`; subsequent integration-package changes mean final package alignment must be reconciled after the Treasure work is finalized. Keep 5.3 and 5.4 open until that exact final candidate is exported, imported, verified and released.

The production alias `bis-server-rho.vercel.app` still targets deployment `dpl_BHV176tqnPF9GTdLb7tKtNtgDF3M` from older source `3c0ac446b2d52edbd1d8037ffbf2c3b7aec4dd0e`. Its health route returns 200 with storage ready, but public signing is false; Signet and Mutinynet identity routes return no signing capabilities and `signingReady: false`. No signing request or wallet operation was made. Tasks 4.4, 5.1, 5.3, 5.4 and 5.5 remain open.

The full root `npm test` suite then passed 1,610/1,610 in host context; the Windows AppContainer blocks the suite's atomic renames in its private ephemeral vaults, so no source guard or wallet fixture was changed to accommodate the sandbox. `npm run check:release -- --previous-version 0.0.26` also passes. A fresh local `@bis/integration` 0.0.27 export from current BIS main `87580a56c7f67d0869c1511cbfed8bcf3a2cdcf6` has SHA-256 `f441f9e2bba7f9f6d510c00405b90c0dbb7bdc25adfac0c69bcfe28533bb914c`, exactly matching the already imported game tarball and its 201-file inventory. The local export manifest and suite summary are under `output/packages/bis-package-release-export/0.0.27-current-main-87580a56/` and `output/reports/bis-server/milestone-1/2026-10-26-local-verification/`. This resolves package-byte parity without editing the game worktree; keep 5.3/5.4 open for post-Treasure reconciliation and release evidence. The stale Vercel production alias and unresolved signing/recovery acceptance remain blockers.

Treasure closeout has now independently resolved the original actor-key/script binding through a protected read-only check. The existing output is still swept, preconfirmed, expired, and unspent; the Mutinynet operator publishes no authoritative version or acceptance decision for this recovery route. The separate game wiring correction remains unpublished, with no matching BIS package release. No wallet operation, signing, or journal/reservation mutation occurred. This is not acceptance evidence; keep 4.4, 5.1, 5.3, 5.4, and 5.5 open until operator acceptance and coordinated release gates are verified.

## 2026-10-27 protected Preview checkpoint

An isolated `bis-server` Preview deployment (`dpl_Hcp4ChJqqoS6SFMfWCex69Jznf1z`) is ready behind Vercel Authentication. Preview-only public payment signing is enabled for Signet; asset, contract, settlement, Mutinynet, and Production signing settings remain disabled/unchanged. Authenticated endpoint checks report storage ready, Signet signing ready with the scoped `sign`, `signMessage`, and `signerSession` capabilities, and Mutinynet unavailable with no signing capabilities. A domain-separated Signet identity proof from the Preview was verified locally; this was not a payment, contract operation, or funded transaction. Production remains on its prior deployment and alias. Local verification completed: 304/304 `@bis/bis-server` tests plus four browser checks, typecheck, isolated deployment build, and release check for 0.0.27. No wallet operation, funding, package import, or publication was performed.

Tasks 4.4 and 5.1 remain open: current free-plan eligibility and exact quotas could not be confirmed from available Vercel billing data, and live Signet operation acceptance plus the complete repository suite have not been verified in this checkpoint. Tasks 5.3–5.5 remain gated on finalized Treasure acceptance and the coordinated BIS/game release. The user requested revoking an existing Vercel share link before approving a five-minute link; a safe direct revocation target is still needed, and the earlier authenticated share-link lookup was rejected because it could create or reuse a longer-lived link. Do not use an indirect workaround or create another share link. Treasure remains incomplete (latest reported ledger 32/37, including operator acceptance and live funded lifecycle evidence); do not publish milestone 1 or touch milestone 2.

Follow-up review confirmed the Vercel project is still a protected Preview (`READY`, target `preview`); its Production alias is unchanged. The billing-charges API again returned `404 costs_not_found`, and the team response did not expose plan or usage counters. Upstash integration metadata lists paid-only `prodPack`/`autoUpgrade` controls but does not disclose the current resource values, so it cannot establish exact current billing or quota eligibility. Keep the free-plan/quota criterion open rather than infer it from the basic build machine or storage health.

The latest client-only acceptance attempt did not reach the Preview API: Vercel Authentication redirected the browser's cross-origin `OPTIONS` preflight, so the local game UI stayed logged out before it could show the server's Mutinynet-unavailable result. No account was created/restored and no wallet data was used. The deployment's authenticated CLI checks still establish Mutinynet `signingReady=false` and `/connect` denied, but the actual UI status remains unverified. The cross-task Treasure report also leaves T037/T042 and funded Signet/rollback checks open; the protected journal remains unverified and no sign/fund/recovery action was performed. Public Pages 0.0.27 still lacks the explicit Mutinynet-unavailable label in its bundles. These are release gates, not permission to bypass Vercel Authentication, change Production, import the game package, or publish.

### 2026-10-27 verification rerun

The complete host-context `npm run test:all` gate passed: root 1,658/1,658; onboarding 92/92; faucet 19 passed, 1 live-faucet test skipped, 0 failed. The separate full game suite passed 1,189/1,189; focused game/BIS integration and Account tests passed 22/22; game publishing tests passed 10/10; package verification passed for the 201-file 0.0.27 vendor archive; BIS contract typecheck passed; BIS `build:all` and game production build passed. BIS release version check accepted 0.0.27 after 0.0.26. Logs and details are in `output/reports/bis-server/milestone-1/2026-10-27-full-verification/` and `game-package-parity-2026-10-27.md`.

A read-only repeat of the existing Signet wallet status now returns `vault-protection-unavailable`; it did not open or modify the wallet. Do not clear or replace the vault or journal. Connected GitHub read-only evidence still has game `main` at `fe48aaa7f4c31a49f55673953116b16881319dce`, published as 0.0.26 (successful Pages run 40373581687); local 0.0.27 is not published. Thus 5.1 remains blocked on protected Signet acceptance, 5.4 on Pages release, and 5.5 on live connection/signing acceptance. Do not mark these complete or publish until the protected wallet/journal is restored through its supported reconciliation path and the Treasure release gates are finalized. No commit, push, workflow dispatch, wallet mutation, or public deployment occurred.

### 2026-10-27 BIS/game package reconciliation

Task 5.3 is complete for the current coordinated 0.0.27 candidate. The exported `@bis/integration` tarball and the adjacent game's vendored tarball have identical SHA-256 `f441f9e2bba7f9f6d510c00405b90c0dbb7bdc25adfac0c69bcfe28533bb914c`; the export manifest names source commit `87580a56c7f67d0869c1511cbfed8bcf3a2cdcf6`, and `BIS/packages/integration` is clean at that commit. Game `package.json` and lockfile both reference the vendored tarball at version 0.0.27; game release metadata is `v0.0.27`. The local Vite proxy maps `/api/bis` on port 5176 to `http://127.0.0.1:5174`, and the checked-in Pages workflow sets the hosted API URL to `https://bis-server-rho.vercel.app/api/bis/`. This closes package/manifest/import/version/configuration parity only; it does not verify the current local route, live signing, game release workflow, or acceptance criteria in 5.1/5.4/5.5. No game files were changed in this reconciliation.

This task separately attempted a fresh root `npm test` while unrelated workspace changes were present. Several browser/storage/UI failures appeared; the run was stopped before its summary to avoid continued contention and is non-authoritative. Do not count it as a pass or as a confirmed regression. The prior complete 1,610/1,610 host-context result remains the recorded baseline; rerun after shared changes settle if still needed. The seven browser cases that failed before Chromium was available in this sandbox were rerun in isolation after installing the matching Playwright Chromium build to the ignored repository-local browser cache, and all 7/7 passed. No tracked source or test fixture changed. The interrupted root run remains incomplete.

The authenticated Vercel team endpoint confirms the active Hobby plan (`createdDirectToHobby=true`), i.e. the free tier. Vercel storage metadata reports Upstash `Free`, a 500,000-command monthly quota, `usageQuotaExceeded=false`, `autoUpgrade=false`, `prodPack=false`, and `eviction=false`. This supersedes the earlier unknown-plan note and closes 4.4. The billing/usage endpoint still returns `costs_not_found` and exact consumption counters are unavailable; this does not reopen 4.4 because the plan and quota eligibility were confirmed. Live funded Signet acceptance remains required by 5.1.

Latest Treasure snapshot: C094 advanced to 33/37; T039 is complete as evidence disposition only. T037 (route/preflight/public bundle), T038 (funded Signet Claim/Reject), T040 (rollback with verified journal), and T042 (deployment) remain open. The independent task reports passing deterministic game, contract/typecheck, publishing, package and build checks, but no funded transaction, journal mutation, SSO bypass, server replacement, or publication. This does not alter BIS task count (15/19); keep 5.1 and 5.3–5.5 open.

2026-10-27 follow-up: the read-only Signet test-wallet status command returns `vault-locked`; the existing handoff forbids clearing it or substituting another store, so 5.1's live operation remains blocked and no journal or wallet action was attempted. Package byte parity was rechecked without mutation: BIS `@bis/integration` 0.0.27 export and the game repository's existing vendor tarball both hash to `f441f9e2bba7f9f6d510c00405b90c0dbb7bdc25adfac0c69bcfe28533bb914c`; the manifest source is `87580a56c7f67d0869c1511cbfed8bcf3a2cdcf6` with a dirty source tree. This establishes current hash parity, not final post-Treasure package/configuration acceptance; keep 5.3 open.

### 2026-10-27 current-tree verification and package drift

The host-context verification log `output/reports/bis-server/proposal-1/2026-10-27/test-all-host-context-current.log` records root 1,716/1,716 tests, onboarding 92/92, and faucet 19 passed, 0 failed, 1 live-faucet test skipped. `npm run typecheck` and `npm run build:all` also exited successfully against the current BIS tree; builds retain the existing large-chunk and ineffective-dynamic-import warnings. This refreshes deterministic verification only and does not satisfy 5.1's live Signet acceptance.

This earlier checkpoint's statement that the game still used 0.0.27 is superseded by the subsequent exact 0.0.28 import below. Keep the local endpoint/runtime and release acceptance portions of 5.3 open; package identity parity alone does not close the task.

### 2026-10-27 0.0.28 verification checkpoint

The authoritative host-context BIS 0.0.28 `npm run test:all` run exited 0: integration 1,716/1,716, onboarding 92/92, and faucet 19 passed with one live-faucet case skipped. Log: `output/reports/bis-server/proposal-1/2026-10-27/test-all-host-context-0.0.28-final.log`. This completes the deterministic repository-suite portion of 5.1 only; it does not satisfy the live Signet, remote gameplay, manual-fallback, or Mutinynet-unavailability acceptance gates. Existing root typecheck, `build:all`, and `check:release -- --previous-version 0.0.27` also pass for 0.0.28.

The exact `@bis/integration` 0.0.28 artifact is now imported in the adjacent game. Its provenance records SHA-256 `6b318fb45a778ac8e136716e30ef63f89e036d65d8abb3ef2ab87f7352f23a46`, 201 packed files, BIS source commit `a9f281cb5565e5bd249d7648f0e725b1cc7ca35b`, matching lockfile and installed-file inventory, contract typecheck, focused checks, full game tests (1,189/1,189), publishing tests (10/10), and build. The game manifest, lockfile, `v0.0.28` release metadata, local `/api/bis` proxy to BIS port 5174, and Pages workflow's production API URL all agree; task 5.3 is complete for this exact local candidate. The local signer returns 404 by design when no development wallet is configured; the ignored `.env.local` contains only the OIDC token key, so no production wallet secret was copied locally. Verifying that this expected unavailable state presents working manual mode remains part of 5.5. The game Pages workflow for 0.0.28 has not been run; a fresh public `environment.json` fetch returns HTTP 200 and still reports `v0.0.27` (`downloadSize` `000018817430`), so 5.4 remains open.

Fresh read-only production probes returned health HTTP 200 (`storage: ready`, `publicSigning: false`) and Pages-origin `OPTIONS /api/bis/connect` HTTP 204 with the expected CORS headers. These prove service reachability and preflight only, not anonymous connection or signing. A Vercel environment-name listing with decryption disabled shows the public-signing flags exist only as `BIS_PREVIEW_*` Preview variables; Production has no `BIS_PUBLIC_PAYMENT_SIGNING` or `BIS_PUBLIC_SIGNING_NETWORKS` flag. This explains why the current Production deployment reports public signing disabled. After Treasure finalization, any Production enablement must explicitly allow Signet only, preserve the approved 5,000-sat operation / 10,000-sat daily caps, and leave contract, asset, settlement, and Mutinynet public signing disabled. The Production cap values are encrypted and were not read. Keep 5.1 and 5.5 open pending real Signet acceptance and the complete published/manual-fallback flow. No deployment, signing request, wallet action, or paid-tier change was made in this checkpoint. Treasure remains incomplete; milestone 1 is not ready to publish and proposal 2 remains untouched.

The existing 5.2 check verified only the published BIS 0.0.27 release. It is reopened for the current 0.0.28 candidate: current live Admin and Marketplace routes both return 200 but their JavaScript bundles still identify 0.0.27, while the local README cache-busters and package versions are 0.0.28. The 0.28 Pages workflow, exact deployed bundle/version identities, and immutable-asset checks are still required. Do not treat HTTP reachability or the earlier 0.27 release as 0.28 publication evidence.

### 2026-10-27 BIS 0.0.28 release and Production deployment

This evidence supersedes the earlier 0.0.27-only and 0.0.28-pending notes above. Pages workflow run `40503586549` succeeded for BIS commit `bb3344856a487e9bd3771fce2bd728cd4390ef1b`; Admin and Marketplace both returned HTTP 200, and their served bundles identify 0.0.28 and the public BIS Vercel URL. README cache-busters are `?v=0.0.28`, and the game Pages workflow published its 0.0.28 environment. Vercel deployment `dpl_HVq2cQ1EpAsG5bv1zHnLdxcCsKiu` is READY and the stable `bis-server-rho.vercel.app` alias points to it. The file-based deployment was created from the isolated package artifact generated from the clean BIS release tree; Vercel does not attach Git commit metadata to this deployment, so source identity is evidenced by the local artifact build and clean tracked package paths rather than Vercel `gitSource`.

Production health, Signet identity and anonymous Signet connect returned HTTP 200; Pages-origin CORS preflight returned 204; anonymous Mutinynet connect returned 403 and Mutinynet identity has no signing capabilities. Production environment metadata (decryption disabled) confirms the public network allowlist is exactly Signet, payment signing is enabled for that allowlist, operation cap is 5,000 sats and daily per-network cap is 10,000 sats. This completes 5.2. Tasks 5.1 and 5.5 remain open for funded Signet acceptance, safe journal reconciliation, and the complete published UI/manual-fallback flow. Proposal 2 remains untouched.

Full-suite environment follow-up (2026-10-28): an earlier root `npm test`
attempt completed 1,748/1,770; 21 encrypted-vault fixture failures caused by
packaged-app temporary-directory atomic-rename `EPERM` were isolated, and both
affected test files passed 30/30 with `TEMP`, `TMP` and `TMPDIR` pointed to an
external permitted test-temp directory. A later current-tree root `npm test`
completed successfully: 1,773 passed, zero failed/cancelled/skipped, 816,362 ms.
That latest run supersedes both the earlier failure and the stale 1,756/1,756
note in task 3.3. Evidence: `output/reports/bis-server/milestone-1/root-npm-test-current-tree-2026-10-28.md` and
`output/reports/diagnostics/bis-p1-root-suite-2026-10-28/npm-test.log`. The
suite pass does not satisfy live Signet acceptance or the end-to-end consumer
and release gates.

### 2026-10-29 current-tree verification

The focused BIS server milestone suite passed 112/112. The complete repository `npm test` passed 1,788/1,788 with zero failures, skips, or cancellations when run with normal OS temporary-file and process-inspection permissions; the earlier restricted run's 22 failures were environmental. `npm run build:all` (including root typecheck) and `npm run check:release` passed. The current source still declares version 0.0.30 and no new package archive was exported. These checks are deterministic/build evidence only: they do not resolve the unknown 2,000-sat Signet refund or satisfy live signing, consumer import, or Pages release acceptance. Full details: `output/reports/bis-server/milestone-1/verification-2026-10-29.md`.

### 2026-10-29 current-candidate and live-browser follow-up

The release-versioned BIS 0.0.31 candidate passed the focused server suite (112/112), full root suite (1,788/1,788), `npm run build:all`, and `npm run check:release -- --previous-version 0.0.30`. The package export is local, source-dirty and unaccepted; no import or publication occurred. The public game remains v0.0.30. Browser verification at its Account screen showed Signet and `Server` after selection, `You are not logged in`, and enabled manual Create/Restore options. `/api/bis/connect` preflight returned 204 and connect returned 200. No sign, login, or transaction occurred. This is partial live evidence only. The unknown 2,000-sat Signet reservation and unverified rolling fees continue to block funded acceptance and the accepted-package release sequence. Details: `output/reports/bis-server/milestone-1/current-candidate-and-game-browser-2026-10-29.md`.

### 2026-10-29 deterministic game-wallet boarding follow-up

The focused Integration tests `server-game-wallet-boarding.test.ts` and `server-game-wallet-boarding-ui.test.ts` passed 5/5 on the current candidate tree. They verify read-only quote entry, consent before submission, fail-closed scope checks, Signet-profile invalidation, and exact re-quoting. No wallet or network operation was made. This remains deterministic evidence and does not close live acceptance. Details: `output/reports/bis-server/milestone-1/server-game-wallet-boarding-focused-2026-10-29.md`.

The focused hosted network-policy and client network-selection suites also passed 34/34 on the 0.0.31 candidate. Coverage includes rejecting public Mutinynet connect before balance selection when no signer is configured, alongside explicit browser network selection and cross-network rejection. This is local deterministic evidence only; it does not close live or deployment acceptance. Details: `output/reports/bis-server/milestone-1/hosted-network-policy-focused-2026-10-29.md`.

The server wallet-pool suite passed 12/12 on the same candidate, covering isolated per-network slot priority, no cross-network fallback, duplicate-identity rejection, original-profile preservation, and bounded balance-provider fallback. It is deterministic fixture evidence, not hosted or live signing evidence; see `output/reports/bis-server/two-network/2026-10-29/wallet-free-focused-verification.md`.

### 2026-10-29 exact package handoff preflight

The previous 0.0.31 export manifest records source commit
`9b201f2b51f805ba2f8d7b2677c1e812049de8dc`, `sourceDirty: true`, and SHA-256
`1875580e179442cf42027ed40f86e63a6bfb6c0079cbb04cab1f5adccc0646ae`; it is
stale relative to current source. The current BIS checkout is at
`311e283fe1ed0520cb644b801a8f0d7213bbbf7c`; the `BIS/packages/integration`
source paths are clean, but unrelated root work remains dirty. A new
provisional `@bis/integration` 0.0.31 archive was packed from that commit at
`output/packages/bis-package-release-export/0.0.31/bis-integration-0.0.31.tgz`.
Its SHA-256 is
`7cc001313c9344abec15838984af1887952f8694d2f896c2b4ffeec2a2429677`; the
manifest records `sourceDirty: true`, and independent inventory/hash checks
confirmed 202 files including `package/dist/`, `package/src/`, and the public
CSS, with no `.env`, mnemonic, wallet-data, secret, `node_modules`, or `.git`
files. This is a provisional local artifact only; it is not acceptance evidence
and was not imported. The game remains on its v0.0.30 archive (SHA-256
`5f031b0915fb7b865679fdd080c74b3e906a58c0a0f6f1c8a0373a2165da6ede`) and the
lockfile resolves that v0.0.30 artifact. Tasks 5.1 and 5.3 remain open. After
P1 acceptance, verify consumer lock/SRI, installed inventory, API, and
version before running game acceptance. Details:
`output/reports/bis-server/two-network/2026-10-29/rollback-and-game-performance.md`.

### 2026-10-29 expanded root-suite follow-up

After renaming two JSX-free Admin test files from `.test.tsx` to `.test.ts`
so the root runner discovers them, `npm test` passed 1,805/1,805 with zero
failures, cancellations, skips, or todos (886,694 ms). The run used elevated
test context after restricted Windows temporary-file atomic renames failed;
all wallet interactions were fixtures and no real wallet, provider, signing,
or transaction operation occurred. One WebSocket test emitted a port-in-use
diagnostic but passed while the coordinator's separate run may have been
active; process inspection was unavailable, so this first run is qualified.
The coordinator's independent normal-host rerun then passed 1,805/1,805 with
no WebSocket warning (909,942 ms); use that as the authoritative full-suite
result. Summary and log:
`output/reports/diagnostics/bis-root-suite-2026-10-29/npm-test-host-context-summary.md`
and `output/reports/diagnostics/bis-root-suite-2026-10-29/npm-test-host-context.log`.
This is deterministic test evidence only; live
signing, unknown-refund reconciliation, accepted-package import, and release
gates remain open. Report:
`output/reports/diagnostics/bis-root-suite-2026-10-29-expanded/npm-test-summary.md`.
The same tree also passed `npm run build:all` (including root typecheck and
all workspace builds) and `npm run check:release -- --previous-version
0.0.30`. Vite emitted chunk-size/dynamic-import warnings; builds exited 0.
This does not make the dirty candidate an accepted release artifact.

### 2026-10-29 local consumer fallback follow-up

The focused BIS consumer UI suite passed 19/19 across server-first Game Wallet
selection, Account UI, and Marketplace wallet guidance. It verifies explicit
manual fallback with a missing/stopped server, no silent identity swap after
server loss, Mutinynet hosted-signing-unavailable disclosure with local wallet
options, and hosted/manual Marketplace copy. Tests use local fixtures and do
not call a provider or create/sign/spend with a wallet. This adds deterministic
local coverage to task 5.5 only; its published Admin/Marketplace/game and live
Signet signing requirements remain open. Evidence:
`output/reports/bis-server/milestone-1/local-consumer-fallback-2026-10-29.md`.

Admin-specific additions passed all 22 tests across the disclosure, Treasure
readiness console/feedback, and Treasure-session suites. Two browser tests
first missed Playwright's default sandbox cache; rerunning those two against
the existing repository browser cache passed 2/2. No download or shared-server
change occurred. This verifies fixture-backed local Admin behavior only; it
does not verify deployed Admin, live Signet signing, or funded Treasure flows.

### 2026-10-29 published game `/api/bis/connect` 403 source correlation

The installed game package 0.0.30 caller sends a fresh network/game-scoped
connect request and does not send an existing connection token; therefore a
403 from `/connect` is not an expired-token response. Production's recorded
public allowlist is Signet-only, so an anonymous Mutinynet connect is expected
to be denied. The same 403 can also result from Origin or owner-authorization
policy. The supplied status-only history (`OPTIONS 204`, `POST 200`, `POST 403`)
does not identify the denied request's network or Origin, so this does not prove
a Signet launch defect. The client intentionally treats 403 as an authorization
error and does not silently change wallet source. No source defect was proven;
task 5.5 remains open. No request replay or body/token/cookie/wallet inspection
was performed. Source correlation and exact evidence gap:
`output/reports/bis-server/milestone-1/connect-403-source-correlation-2026-10-29.md`.

### 2026-10-29 owner-network policy closure and existing 403 boundary

A source audit mapped owner-authenticated connect, generic grant issuance, owner
plan/authorize, settlement plan/authorization/signing, Treasure actor and
checkpoint paths, owner signing, and completed-result recovery. Owner network
access now uses `BIS_OWNER_SIGNING_NETWORKS` when configured, otherwise the
same explicit network list as public Production signing; malformed or absent
lists fail closed. Preview isolates `BIS_PREVIEW_OWNER_SIGNING_NETWORKS`, so an
explicit Preview opt-in cannot be inherited by Production. Focused hosted and
environment tests passed 41/41, including owner Mutinynet denial across route
families, explicit owner-only opt-in, unchanged public Mutinynet denial, and
Preview isolation. No Vercel configuration or deployment changed. This is local
policy evidence; the production bundle must still be updated and checked before
treating owner Mutinynet as unavailable in Production.

Existing game evidence records a status-only `/api/bis/connect` result of 403
without the request network or Origin. The published client sends a fresh scoped
connect request without a prior token; for the allowed Pages Origin, 403 is
consistent with the connect authorization branch when public signing is off or
the requested network is outside its allowlist (including Mutinynet in the
Signet-only policy). The old observation cannot establish which network or
condition produced it. No request was replayed and no connection token/body was
inspected.

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
