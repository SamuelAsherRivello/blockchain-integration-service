# G1/G2 implementation evidence

Current rollout (2026-09-09): the hardcoded live acceptance switch has been removed at the user's request. Creation is enabled by default with per-operation runtime checks; `creationEnabled:false` remains an explicit rollback. Historical gate statements below describe earlier checkpoints. See the latest runtime-acceptance entry.

## 2026-09-09: feasibility gate started, live funding blocked

Installed SDK: 0.4.71, verified from node_modules and the package manifest. Added an internal candidate script builder at `BIS/packages/integration/src/arkade/lto-script.ts`, not exported through the public package or connected to any wallet/UI operation. It constructs four distinct leaves:

- Cooperative claim: SHA256 secret condition, player signature, operator signature.
- Cooperative cancellation/refund: game signature and operator signature, without a wait.
- Delayed player exit: the secret condition and player signature after the operator exit delay.
- Delayed game exit: game signature after the operator exit delay.

The two exit paths are script construction only, not an implemented or tested exit workflow. The 90-second offer deadline is a client eligibility rule, not an upper-bound timelock encoded in these paths. Live acceptance and signer/operator policy compatibility are unproven. Do not enable funding from this builder yet.

The installed SDK supplies `buildOffchainTx`, `signAndSubmitOffchainTx`, `claimWithPreimageIdentity`, `ConditionMultisigTapscript`, and contract/indexer primitives. The claim helper attaches the secret witness after signing; the SDK explicitly documents that the reverse order causes invalid signatures. The probe uses this helper and server-signature verification.

## Local validation

- Initial `node --test` was blocked by sandbox child-process EPERM; `--test-isolation=none` avoids that restriction.
- Red: `node --test --test-isolation=none BIS/packages/integration/tests/lto-script.test.mjs` failed because the builder did not exist.
- Green: the same command passed 2 tests after implementation. Coverage checks role-bound keys, distinct secret commitments, tree round-trip and malformed/overlapping identities.
- `npm run typecheck` passed.
- These tests establish local construction and validation only, not accepted spending or full script security.

## Live attempt

Ran `node BIS/scripts/probe-lto-contract.mjs` with networking permitted. The script uses fresh in-memory identities, never imports user wallets, and logs no keys, secret preimages, signed transactions or raw provider error payloads. It is intended to exercise real funding/claim/cancellation/expiry and read-only recovery after a deliberately lost finalize acknowledgement. Later scenarios were not reached.

Operator `https://signet.arkade.sh/v1/info` responded. Parsed values:

- network: signet
- txFeeRate: 0
- intent fee fields: empty formulas
- vtxoMinAmount: 1
- unilateralExitDelay: 172544 seconds

The first 1,000-sat request to `https://faucet.signet.arkade.sh/faucet` returned HTTP 502. A separate read of the faucet homepage also returned 502. An independent indexer read of the disposable probe address verified zero outputs and zero sats after the failed request. No contract funding or claim transaction was submitted by the probe.

Public probe address (historical diagnostic only; do not fund it because its transient identity has been discarded):

`tark1qz9l2ctqalrkjyftxcw7gytm83cm3r9pdudmna4v0gncry56h30x4evgl0ya4m7gwky93pwymha5n75q0lcmy4jpxktmq8uem8ra9s3xv5sjmd`

After this run, the probe was hardened to check the same funding address even when the faucet acknowledgement fails, without automatically repeating the request.

## Historical gate status before funded browser probe

Tasks 1.1-1.3 remain unchecked: exact live acceptance, zero-fee spending, prompt cancellation, asset preservation and conflict recovery have not been proven. All 26 tasks remain incomplete; no G1 or G2 UI is claimed delivered. No changes were made to Stealth & Steel during this attempt.

Resume using the faucet once available, or a separately provisioned funded disposable Signet identity entered through a suitable local app workflow without putting secrets in chat/files/logs. Do not replace the contract with ordinary sends, switch networks or enable the live UI just to bypass the gate. After a successful probe, complete source-outpoint and recipient reconciliation plus explicit claim/refund race and asset-preservation verification before advancing to production integration.

## Same-origin funded browser probe: PASS

The user clicked the funded probe at `http://127.0.0.1:5174/tests/lto-live.html`. It loaded the already configured game signer privately from same-origin encrypted storage. No recovery phrase was entered, exported or logged. The test player was deterministically derived locally and had no pre-existing outputs. Every operation preserved all 1,000 sats with zero deducted fees.

| Scenario | Funding transaction | Resolution transaction | Funding / resolution time |
| --- | --- | --- | --- |
| Player claim, deliberately lost finalize acknowledgement | `2f5f0e4e89d5715f4e369ca64bf503d6589c0a8fc62e0f67b6ad88776b0faa9f` | `ae1063f36c66c06fd93d251c920c333447b0167ad9173683371898dbea476285` | 2582 / 2467 ms |
| Cooperative pre-expiry cancellation | `3023386d1f89c68bbd05f352cc96833305611260475c247589698ce1a7dcab3e` | `62b1baa8f54cc77c85416c901e7d3abfaa874ee6fda2fcc1bfbb472a04e3b748` | 2661 / 2590 ms |
| Expiry cleanup, accelerated one-second probe interval | `77ba52ae28c42ab928fd7513391a3a296811981f73d760c4e4aaeca66694c3da` | `17fe3b784bebb0e8b79cdc0f43b41f547a2cf3c470f48510f26c4811df34def7` | 2634 / 2579 ms |

The claim reward was returned to the game by `91748d98818b759efdc88e82ff049b9171f9ac1647943f373cda120e557c8194`. Separate read-only indexer verification confirmed all three contract source outpoints had the expected `arkTxId`, a non-empty checkpoint `spentBy`, value 1,000 and zero assets. These spent source outputs cannot be treated as available for a competing refund. The final returned output was subsequently spent by another wallet operation; that does not invalidate the recorded return.

The probe is evidence for the underlying script and operator paths, not acceptance of the newly added production service or a 90-second gameplay test. Live race, interrupted finalization, multi-input/change and full-game acceptance remain outstanding.

## Historical implementation and UI progress

- `contracts.ts` separates fund state from elapsed-time eligibility, preserves immutable deadlines, prevents late replacements for skipped sessions and projects public fields explicitly. Ten lifecycle tests pass.
- `contract-storage.ts` uses versioned AES-GCM envelopes with non-extractable keys and atomic revision checks. Five encryption/reload/corruption/stale-writer/additive-preservation tests pass using an injected storage backend. Actual browser IDB write/recovery acceptance is still pending.
- Adapter input selection and exact receipt/source/change matching have four passing tests; the script builder has two. Total focused tests: 21 passed.
- Contract reservation integration, generic public API, service and Contracts UI are in progress; do not infer complete task coverage from their presence.
- The user requested a shared React collection component for Assets, Contracts and Transactions: title, body, copyable field, scroll area/items and Back. All three now render through `AccountCollection.tsx`.
- The Account Details navigation uses one row ordered Assets, Contracts, Transaction. A real-browser screenshot verified the first two labels stay whole and only Transaction truncates with an ellipsis at the current narrow preview width. The empty Contracts page was verified in the running browser.
- `npm run typecheck` and `npm run build` passed. The build retains the existing large-chunk warning.
- Running the full suite without process isolation caused global-mock and Vite module interference. A normal isolated run stalled after the documentation tests and was stopped; this is not a passing full-suite result. Focused runs and individual regression files are required next.
- The local Vite preview had stopped during the work. It was restarted on the same port, and `http://127.0.0.1:5174/` returned HTTP 200 with demo HTML.

## Current apply checkpoint — 2026-09-09

### Delivered code and scope

- BIS generic LTO service privately loads the game/player signers, validates Signet/zero fees and eligible asset-free inputs, serializes wallet/contract mutations, and stores exact operation identity before submission. Unknown spends keep exclusivity and reservations. Receipt reconciliation must match exact source, destination, value and change. Saved finalization is retried without constructing a competing spend.
- Versioned encrypted IndexedDB recovery retains non-extractable encryption keys, signer-bound script material and exact finalization. Public account/host queries return sanitized contract metadata only and do not sign. Pending-loss inventory includes contracts; separate game recovery remains available after player logout. Full browser storage interruption acceptance remains open.
- Assets, Contracts and Transactions use Item List and Item List Detail across all six pages. Account Details has equal-width Assets/Contracts/Transaction buttons. All lists reserve 276px even when empty. Contracts uses the existing foreground read-notice convention; financial operations use nonblocking toasts. Exact transaction IDs correlate contract funding/claim/refund in Transactions without duplicate rows.
- G2 Admin now has always-clickable Start LTO and Claim LTO subbuttons and a 90-second wall-clock countdown. Action outcomes and asynchronous status changes use the existing console. Claim-before-Start reports no offer; Start with the current gate reports no created offer. The real game retains its own collision dialogue. No synthetic confirmation is emitted to disguise the disabled creation gate.
- Stealth integration includes game wallet provisioning under Settings → Developer → Game Wallet, game-owned session/pause/dialog logic, persistence of the original deadline across level progression, and an always-present Tiled chest in Level01. Runtime PNG and editor SVG are local original artwork. The chest is at game cell (3,5), world center (224,352), two cells above the Level01 player. No chest was added to the other levels.
- Game local package: bis-integration-0.14.1-g1-g2-1b31a54a68a9.tgz. The current vendor inventory verifies the archive and all 93 installed files. React/react-dom 19.2.8 are deduplicated. Consumer setup and limitations are documented in STEALTH_STEEL/documentation/treasure-lto.md; provenance records this as an unreleased snapshot.

### Checks performed

- 44 focused tests pass: lifecycle 10; encrypted storage 6; adapter construction/recovery 3; input/receipt matching 4; script 2; service 10; transaction correlation 1; shared UI SSR 1; host session 7.
- Real-browser display fixtures passed all six list/detail pages, Back navigation, identical populated/empty 276px scroll areas, and zero page errors. These were isolated unfunded fixtures, not wallet acceptance. Output: output/screenshots/g1-g2/item-lists.png and output/implementation/g1-g2/item-list-check.mjs.
- Actual BIS browser verified G1 empty Contracts and G2 Claim-before-Start, Start result and decreasing countdown (90 to 63 seconds). Public creation remained disabled during these UI checks.
- Actual Level01 browser passed chest rendering, keyboard collision, guest message, movement pause, Back/resume, overlap debounce and re-entry. The same dialogue fits a 360×640 viewport. Screenshots: output/screenshots/g1-g2/game-chest-desktop.png, game-chest-dialog.png and game-chest-mobile.png. No browser page errors.
- BIS typecheck and production build pass. Game production build and package inventory check pass. Both builds retain large-chunk warnings.
- Full BIS regression run: 467 tests, 464 pass, three failures. The same failures were reproduced against a baseline copy: boarding-recovery.test.mjs tests at lines 35 and 45; continuation.test.mjs at line 99. See output/logs/g1-g2/tests-resumed.log and earlier baseline-isolated.log. Three later adapter tests separately pass; the full suite was not rerun just to combine totals.
- Game suite at the integration checkpoint: 974 tests, 972 pass, two failures in the already modified Level02/map collider expectations (level-two.test.js:26 and tiled-level.test.js:219). These files were outside this change's edits. The suite is not reported as fully passing. Other tasks are concurrently changing game maps and onboarding; their work was preserved.

### Remaining funded acceptance and rollout gate

The initial probe above proves the observed funding/claim/refund script paths, including an initially unfunded player. It does not prove the new service's full end-to-end persistence or gameplay lifecycle. Public createBisLto intentionally forces creation disabled until the remaining feasibility gate passes. Turning creation off retains query, existing-contract actions and reconciliation; the service regression suite verifies rollback with outstanding recovery.

The next prepared handoff is http://127.0.0.1:5174/tests/lto-live.html?mode=race, button **Run funded claim/refund race probe**. It uses one 1,000-sat offer and a game input large enough to verify change, submits competing claim/refund paths, identifies the actual winner from provider evidence, returns any claimed reward, and checks unrelated game inputs/assets for preservation. It contains no faucet step and requires the already funded same-origin game wallet. Automatic approval review previously rejected the agent clicking a funded probe because financial submission requires a human click. No race result has been observed yet.

Still open: real service/game funding, Claim, Reject, full 90-second expiry, session-end cleanup, restart/offline recovery, browser storage and competing-tab acceptance, Tiled editor save/reload, and physical touch-device acceptance. These remain unchecked where required by tasks.md. No full G1/G2 completion or release is claimed.

## Autonomous verification and fixes — 2026-09-09

The user asked to continue without manual probe clicks. No further live-probe handoff is requested. The probe page remains optional diagnostic tooling, not a user workflow requirement. Public creation remains gated; automated simulation does not establish unobserved Signet acceptance.

Added `BIS/packages/integration/tests/lto-simulated-operator.test.mjs`: five tests run real SDK transaction construction and player/game/operator signing against a wholly in-process operator. They prove the code path for a zero-balance player's 1,000-sat claim, cooperative refund, exact multi-input change, unrelated asset/input preservation, signed finalization recovery after a lost acknowledgement, rejection of an incorrect operator signature, and deliberately overlapping Claim/Refund with exactly one confirmed winner. All external fetches fail the test. This simulator is not a Bitcoin consensus engine or evidence of current remote operator acceptance.

Added repeatable `integration-demo/tests/lto-browser-fixture.html`, `.jsx`, and `lto-browser-check.mjs`. Browser scenarios use the real service, Item List/Item List Detail, G2 controls, Web Locks and encrypted IndexedDB with a simulated spending adapter. The browser driver blocks requests outside the fixture origin and creates isolated browser profiles; it never imports saved user wallets. Scenarios pass for premature/duplicate Claim, pending funding and claim, console/toast correlation, expiry/refund, terminal list removal, Reject, IndexedDB reload, unavailable reads, account replacement, unknown outcomes retained across expiry/reload, and the game role's Refund action.

Two regressions were found and fixed with failing tests first:

- Game-role Refund omitted pending/confirmed toasts because notification routing only recognized the player. It now recognizes either participant while suppressing unrelated-account and detached-UI feedback.
- A disposed worker kept polling forever when another operator's contract remained unresolved. Cleanup now considers its original game identity and supported network/operator. If that signer is replaced, it stops while retaining all durable recovery for later restoration. A visibility-return test also verifies one expiry refund against the original deadline.

Results: 52/52 focused tests pass; the full browser fixture suite passes; BIS typecheck/build and game build pass. The refreshed game archive is `bis-integration-0.14.1-g1-g2-3fb9421ed7bb.tgz`, with all 93 installed files and archive hash verified. Earlier full-suite baseline failures remain as documented; they are not relabeled passing. OpenSpec progress is 13/26, with the remaining live, game/editor/device and regression acceptance explicitly open.

UI refinement: G2 now uses F3's StoryButton component. The real browser screenshot verified matching single-row styling. Start LTO logs immediately; Claim LTO now logs checking before its asynchronous read. The isolated G2 browser suite and typecheck pass after the change. UI testing is available; live funding remains disabled.

## Final autonomous acceptance checkpoint — 2026-09-09

Progress is 19/26 tasks. No additional human acceptance handoff is requested. Creation remains disabled because the outstanding live financial feasibility evidence has not been observed.

- All 17 focused game tests pass: account host (6), runtime session continuity (3), treasure UI and developer signer setup (5), persistent sensor (1), authored palette/placement (1), runtime image (1). They exercise the actual game modules. The developer setup test uses an unfunded placeholder and verifies immediate input clearing; it never accesses a saved user secret.
- A failing game test found that a late accepted action could close a newly reopened chest. `treasure-ui.js` now captures the originating window and closes only that instance. All dialog states, duplicate actions, keyboard/touch propagation, focus cycling and release of only the treasure pause reason pass.
- Actual Level01 desktop and 360×640 browser checks passed again after that fix: chest visible, collision opens guest dialogue, movement pauses, Back resumes, and leave/re-entry works, with no page errors. This remains emulated browser coverage; no physical-device result is claimed.
- An isolated actual-game browser opened Account and verified `BIS: v0.14.1`. The refreshed game archive is `bis-integration-0.14.1-g1-g2-8b79d547b577.tgz`; the inventory validates its hash and all 93 installed files. React and React DOM remain deduplicated at 19.2.8.
- Actual two-tab acceptance was added to `lto-browser-check.mjs`. The tabs share encrypted IndexedDB and browser Web Locks. One held funding operation prevents a second session from funding; that session cannot adopt or claim the first session's contract, and remains skipped after resolution. Both account views observe the pending claim and terminal removal. The complete browser fixture suite passes with external requests blocked and simulated spending.
- A new failing service test exposed missing contract protection in Admin Reset. `account-storage.ts` now takes the exclusive origin mutation lock and checks unresolved contract reservations for either participant before changing identity. Contract journals and reservations remain intact. The acknowledged player logout path remains separate and unchanged.
- The combined service/logout/logout-cleanup/context/balance regression run passes 53/53. Earlier in this acceptance pass, logout/logout-cleanup/assets/activity passed 37/37. BIS typecheck/build and game build pass after the reset fix; existing chunk warnings remain. Earlier full-suite baseline/unrelated failures remain open and are not relabeled passing.
- Tiled CLI export was attempted without changing the authored source or editor preferences. Both map and tileset export processes failed with exit code 3221227010 and produced no accepted round-trip artifact. The JSON palette/sensor test and actual runtime rendering pass; editor save/reload remains unverified. No user Tiled process was deliberately terminated.

The remaining checklist covers live race/preservation, full production service/game financial and offline/restart scenarios, full regression acceptance, and Tiled editor save/reload. The initial user-run Signet probe remains valid historical evidence for its listed script paths, but does not establish those additional outcomes. No simulated success is exposed as a live contract confirmation.

## Default-enabled runtime acceptance — 2026-09-09

The user requested restructuring the live acceptance gate to finish without a manual prerequisite. The factory no longer combines options with a hardcoded false flag. It uses the production adapter by default, retaining same-origin signer identity, Signet/operator/zero-fee validation, controlled inputs, immutable deadlines, exclusivity, encrypted recovery and verified-receipt completion. An explicit creationEnabled:false still prevents new offers while allowing queries and recovery. No provider validation or tool approval restriction was removed.

The new public-factory regression initially failed because Start always returned unavailable. It now passes default funding and Claim followed by explicit rollback, existing-contract query and session-end refund. Only storage/provider boundaries are substituted in this isolated test; the actual public factory and lifecycle code run. Test actions wait for active mutation locks to finish, including the recovery scan after a disabled Start. All external fetches fail the test. There are no user wallet reads or actual transfers.

Results: 54/54 focused tests pass (`output/logs/g1-g2/runtime-readiness-tests.log`); the full isolated G2/Contracts browser suite passes, including two actual tabs. BIS typecheck/build pass after permitting Vite's required subprocess; chunk warnings remain. The game archive is bis-integration-0.14.1-g1-g2-3b1f7f91ca8c.tgz and all 93 installed files verify. G2 console copy now points to wallet readiness, eligible funds and unresolved contracts instead of a feasibility gate.

No further funded Signet probe was executed. Previously recorded live evidence remains historical; extended live race/full-game outcomes remain unobserved, rather than being falsely marked successful. Those observations no longer disable the product. Runtime failures such as missing signers, insufficient funds, changed fees or unresolved operations can still prevent a particular attempt; no implementation can truthfully guarantee external operator availability.

Consumer verification after the package update: the game production build passes and an isolated actual-game Account UI reports BIS v0.14.1. The package inventory confirms the default-enabled archive and all 93 installed files.

## Fix: Offer funding was not submitted — 2026-09-09

Root cause confirmed by read-only SDK/indexer inspection: the configured game address had one spendable 53,000-sat output with six assets and zero-fee operator terms. The LTO selector filtered every asset-bearing output, so its available input set was empty. No secret or signer was needed for this diagnosis. A later read saw 52,000 sats with six assets; this balance change was not attributed to an LTO without transaction evidence.

Two regression tests first failed: selecting a sufficiently funded asset carrier, and verifying its exact asset-preserving game change. Both now pass. The adapter prefers asset-free coins but can use an asset carrier with valid game change, includes an asset packet, journals the canonical quantities, and verifies conservation against source and change receipts. A real-SDK simulated-operator test funds a clean 1,000-sat contract from 53,000 sats, returns 52,000 sats with six assets, then claims the reward while preserving the game assets. One quantity exceeds Number's safe integer range to verify bigint precision. Storage tests cover encrypted manifest reload and invalid quantities. Fixed failure codes provide specific toast reasons without exposing raw provider messages.

Verification: 58/58 focused LTO tests pass (`output/logs/g1-g2/asset-carrier-tests.log`); 15/15 ordinary-send/reservation regressions pass; BIS typecheck/build pass. The isolated G2/Contracts browser suite passes. Read-only selection against the then-current public game output succeeds with six assets preserved, without asserting wallet-storage readiness or submitting any transaction. No funded probe or programmatic transaction was executed. New game archive: bis-integration-0.14.1-g1-g2-d191d1bc8688.tgz.

## User acceptance and main-spec sync — 2026-09-09

The user reported “works great” following the corrected asset-carrier funding flow and asked to sync. This is recorded as user acceptance of the delivered feature; it is not expanded into new transaction IDs, balance snapshots, a Tiled editor result or unobserved device/race results. G1 Contracts UI and G2 LTO Treasure Chest are delivered and accepted. The latest automated results remain 58 focused LTO tests plus 15 send/reservation regressions, passing browser checks, both builds and game package verification.

Synced three new main specs: account-contracts (3 requirements), limited-time-offers (7 requirements), treasure-lto-demo (7 requirements). The final asset-preservation behavior, default-enabled runtime, collection layout, developer controls and error feedback are included. Broader unchecked verification notes remain visible in tasks.md. No archive, commit or push was performed by this sync.

## Shared hosted wallet implementation — 2026-09-09

The Admin now uses a private disk-backed BIS wallet service; the game consumes its public wallet/LTO API. The player signs the verified claim graph in their own browser. No game phrase is sent to game consumers. The separate game-wallet import dialog and Developer entry were removed. Existing eligible Admin browser storage migrates once; explicit service Logout does not automatically reimport it on reload. The service has durable encrypted SQLite journals, a single writer, shared reservations, player request proofs, private Admin routes and a recovery worker independent of browser lifetime.

Current automated evidence:

- 62/62 focused contract/service tests pass: contracts, storage, activity, LTO model/script/adapter/service/public factory, real-SDK isolated operator, and HTTP/vault/runtime. Log: output/logs/g1-g2/hosted-focused-tests.log.
- The hosted SDK exchange funds 1,000 sats from a 53,000-sat asset carrier, completes both player signatures and verifies exactly 1,000 player sats plus 52,000 game sats with all six assets preserved. A separate test interrupts before checkpoint signing, restarts the service from encrypted disk, resumes the saved checkpoint and verifies no duplicate submission.
- Service tests cover signed HTTP requests and replay/body/path substitution, public file denial, private Admin Host/Origin checks, duplicate clients, wrong-player claim/end, unknown funding restart, unresolved refund exclusion, and expiry refund through the production service timer without any browser query. Vault tests cover encryption, second-writer rejection, failed writes and restored durable state.
- 16/16 focused game account/treasure tests pass after removal of the obsolete import-dialog test.
- BIS integration and demo production bundles pass; game production build passes. The final game archive is bis-integration-0.14.1-g1-g2-3215920c76b0.tgz. All 102 installed files and archive hash verify. Inventory hashes come from the immutable archive, not concurrently edited workspace files.
- Actual-game fresh guest browser checks pass for automatic public-wallet loading, absent Game Wallet import UI, Level01 chest collision, guest message, pause, Back, overlap/re-entry, a 360x640 viewport, and BIS v0.14.1 in Account. Screenshots: output/screenshots/g1-g2/. No user-wallet transaction was submitted by these browser checks.

Local persistence evidence: after graceful service stop/restart, read-only /health returned ok and /v1/wallet restored the existing selected wallet as ready with 49,000 available sats. This balance is not attributed to any new transaction. Local endpoints are game http://127.0.0.1:5173/, Admin http://127.0.0.1:5174/, and service http://127.0.0.1:8787/. The service runs with Node's EventSource support enabled.

Limits: no deployed HTTPS signer target was supplied or deployed; the service README documents the persistent private volume, public HTTPS proxy, protected Admin access, origin allowlist and VITE_BIS_WALLET_SERVICE_URL for deployment. Real user-wallet hosted financial outcomes and the broader historical editor/full-game/live matrix remain unobserved. The whole-repository typecheck encountered errors in concurrently edited onboarding code (initially onboarding modules, subsequently context's onboarding mutation callback); those unrelated edits were preserved. Successful production bundles and focused tests do not imply the current whole-repository typecheck passes. X8 security review remains deferred. No archive, push or additional funded human acceptance action is claimed.

Final checkout check: npm run typecheck now passes after the concurrent onboarding edits settled. This supersedes the transient typecheck failure above. The game returns HTTP 200 and the wallet service returns health ok. A final play-guide check confirmed the Start backdrop covers Settings; the documented first-time path is Start → gear → Account, then reload and start a fresh eligible run after connection. No player setup or financial action was performed by that guide check.


## Final user acceptance and archive — 2026-09-09

The user confirmed “works great” for the shared-wallet treasure flow and explicitly requested sync and archive. Final hosted-wallet requirements are synced into the three main capabilities; the accepted change is archived. This acceptance does not invent additional transaction receipts or close the three broader unobserved editor/full-game/live-evidence checks (4.4, 5.2, 5.3). They remain unchecked historical verification limits. HTTPS signer deployment remains outstanding, and X8 remains the deferred security rethink. No new human acceptance action is requested.
