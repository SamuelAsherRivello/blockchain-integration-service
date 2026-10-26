# Tasks

Milestone 1 only. Checkboxes record verified implementation progress. Local tasks 1.1-3.3 and hosted adapter/coordination/policy tasks 4.1-4.3 are complete. Separate protected Vercel deployments pass real concurrent/replay/conflicting-input checks and alternate encrypted MuSig signing exchanges. Public signing policy and deterministic local workflow checks pass. A shared-adapter edit slot closed the implicit SDK `settle()` selection gap; the focused regression now verifies omitted params select and pass the expected fee-adjusted VTXOs/output into the original SDK method. This is local fixture evidence, not deployed or funded acceptance. On 2026-10-22, current-tree verification passed the focused `@bis/bis-server` suite (183/183), root typecheck/build, isolated deployment bundle build, release-manifest check (0.0.26), and local staged-Pages browser verification. The 1,324/1,324 root-suite pass is recorded in the separate Treasure acceptance report. The current `bis-server` candidate still needs Vercel deployment/identity checks and 5.1's live-signing acceptance; no local `BIS_GAME_WALLET_*` slots are configured, and no funded action is authorized until Treasure releases its slot. Deployment, funded M1 acceptance and releases remain pending. Complete this change before considering the separately deferred host-bis-server-game-wallet change.

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
- [ ] 4.4 With supplied access, configure the Vercel project, datastore and separate private test identities; verify current free-plan eligibility/quotas, deploy backend, and prove identity and required remote signing methods against the deployed runtime. Keep private values out of chat and evidence.

## 5. BIS and game integration and releases

- [ ] 5.1 Run focused signer/controller/UI suites, repository tests/typecheck/build and real approved test-network signing acceptance; verify existing game-wallet actions retain behavior remotely and manual mode still works. Record actual coverage under `output/reports/bis-server/milestone-1/`.
- [ ] 5.2 Release BIS Admin and Marketplace with the public Vercel URL through the existing version/Pages workflow; verify exact workflow success, both deployed apps, matching BIS versions, required README cache-busters and preserved immutable assets.
- [ ] 5.3 Export the verified BIS integration package/manifest and import it into the adjacent Stealth & Steel repo; verify package SHA-256/version, update vendor dependency/lockfile/release metadata and required local proxy/hosted API configuration. Preserve gameplay code unless the public integration contract requires a change.
- [ ] 5.4 Run game package verifier, real BIS contract checker, full tests, publishing tests and production build; push the matching game version through its Pages workflow and verify exact deployment success and public version identities.
- [ ] 5.5 Verify local Admin/Marketplace/game connection/debug flow, published Admin/Marketplace/game Vercel signing without Game Wallet Login, and controlled server-absent/manual-login behavior. Separate live network evidence from deterministic UI tests and deliver a milestone 1 acceptance report; do not start milestone 2.
