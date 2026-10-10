# Tasks

## 1. Baseline and public declarations

- [x] 1.1 Record scoped statuses, relevant source revisions, full test/build baseline and the exact current public game consumers; verify the evidence identifies existing failures and excludes unrelated Slidev changes before implementation.
- [x] 1.2 Define/export `IBis`, extend `IBisGame` with `onBisEvent`, and publish the provider design's named readonly DTO inventory; verify positive and negative public-type fixtures, naming categories and absence of Arkade/secret-bearing game API types.
- [x] 1.3 Add focused public-export/declaration tests and update integration package/boundary guidance for the two-interface entry; verify `npm run typecheck`, the new contract tests and documented public example compilation.

## 2. Private facade ownership and complete workflow commands

- [x] 2.1 Make `BisService implements IBis` with private context/wallet/LTO/UI ownership and facade-owned equipment/workflow listeners; verify raw internal access fails public type checks and lifecycle tests show one owned instance/subscription set.
- [x] 2.2 Implement safe copied snapshots and `stateChanged`, `accountClosed`, stable `restartRequested` and operation/effect notifications through `IBisGame`; verify unavailable-versus-empty, secret exclusion, event ordering, throwing handlers and reentrancy tests.
- [x] 2.3 Implement named begin/pay/check/end continuation commands with typed workflow IDs/states and captured pre-payment targets; verify unchanged 1,000-sat pricing, no-target rejection, pending checks, unsupported guests and no double submission in focused continuation tests.
- [x] 2.4 Implement begin/refresh/collect/check/acknowledge/end reward commands; verify unchanged trophy quantities/source policy, existing ownership/reconciliation guards, truthful action availability and no mint from an effect-receipt retry in collection tests.
- [x] 2.5 Implement refresh/select/clear equipment commands and game-prefixed safe payloads; verify Player-only support, nine-item catalog recognition, ownership validation, selection persistence and existing equipment tests.
- [x] 2.6 Implement start/query/check/claim/reject/end-session contract commands and state notifications backed by existing recovery; verify wallet/application/offer/gameplay identity separation, pending-to-confirmed updates without game UI polling and existing LTO tests.
- [x] 2.7 Update affected layer READMEs/examples and supported Admin/Marketplace integration guidance alongside the migrated APIs; verify examples use public contracts and their supported existing consumers still typecheck/build.

## 3. Host effects, reset and as-built explanations

- [x] 3.1 Bind continuation, asset reward and confirmed sats reward effects to origin sessions/operations before asynchronous work; verify stale/replaced sessions, host replacement, receipt rejection and duplicates leave financial confirmation unchanged in facade delivery tests.
- [x] 3.2 Own reset/disposal generation invalidation and all transient workflow cleanup, returning safe reset completion/failure; verify concurrent reset, retry after failure, absent-wallet success, late-work suppression and preservation options against `game-state-reset` tests without remote-cancellation claims.
- [x] 3.3 Update BIS deep dive, project/design discussion and smoke runbook with actual `IBis`/`IBisGame` methods, payload/effect semantics and the real game adapter/repository paths; verify canonical examples compile and all local/companion links resolve, with live-versus-automated coverage stated accurately.
- [x] 3.4 Audit remaining current BIS-owned documentation, templates/package READMEs, supported styling guidance and embedded canonical diagrams for obsolete promoted game APIs, backdoors or fictitious class claims; verify a reviewed-doc/media inventory and resolved references, update stale diagram labels at their canonical path, and retain issued immutable assets and historical archived records.

## 4. Versioned BIS Pages release gate

- [x] 4.1 Fetch/compare authoritative release state, choose the next `0.0.N`, synchronize root/integration/Admin/Marketplace manifests and lockfile plus both README cache-busters, and update current release instructions; verify `npm run check:release -- --previous-version <verified-prior-version>` and release-versioning tests.
- [x] 4.2 Refresh any existing README screenshots from real current UI at their existing paths and run isolated credential-free Admin/Marketplace/integration browser checks; verify expected apps/version, no automatic wallet actions, no secret output and inspect the resulting images.
- [x] 4.3 Run `npm test`, `npm run test:all`, `npm run typecheck`, `npm run build`, `npm run build:all`, the current Pages staging/route-verification commands and strict validation of this change; verify every test/build/route gate is green and record exact outcomes rather than accepting focused-only success.
- [x] 4.4 Review scoped diffs/whitespace and preserve unrelated work; verify the existing Pages workflow publishes both demos on BIS `main` pushes independently of game publication without tag/manual-release prerequisites, commit/push only intended BIS code/docs/release surfaces, verify the intended commit on remote `main`, and monitor its actual push-triggered Pages run to success.
- [x] 4.5 Verify both stable public Admin and Marketplace routes, preserved issued asset routes and their newly published BIS identity; record exact source commit/version, successful workflow URL and browser/HTTP evidence, and keep release incomplete if either app serves the wrong deployment.

## 5. Built export and game handoff

- [x] 5.1 Build/pack only `@bis/integration` from the exact successfully released BIS commit into the designated handoff output; verify archive metadata, built runtime/style/type exports, exact source commit, archive SHA-256 and per-file inventory with no unrelated dirty source included.
- [x] 5.2 Install the archive in an isolated consumer without source symlinks and verify runtime/style imports plus positive/negative `IBis`/`IBisGame` public-type checks; record file count, hashes, commands/results and consumable API changes for game C088.
- [x] 5.3 Hand the verified versioned archive and provenance evidence to C088, then perform the final paired contract/documentation/release audit after the game deployment; verify both commits/versions/workflow outcomes agree with the exported and installed artifact before reporting the cross-repository goal complete.
