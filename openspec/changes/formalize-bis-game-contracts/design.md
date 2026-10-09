# Design

## Context

See [proposal.md](proposal.md) for scope and [the deltas](specs/) for behavior. At inspection, BIS is 0.0.16 and exports `IBisGame` with four methods. `BisService` publicly exposes context, Game Wallet, LTO and UI, and returns continuation, collection and equipment controllers. Asset collection captures the game session on completion; continuation captures it before payment. Disposal/reset and controller lifetimes currently have different owners.

The separate game already pins a 0.0.16 archive, but its focused typecheck resolves a handwritten declaration mirror. Its report identifies concurrent delivery, stale sessions, reward presentation, treasure polling and Account/reset seams. Existing production adapters remain the financial implementation; this design changes the boundary around them.

On 2026-10-09 the user explicitly confirmed independent Pages-only publishing: each BIS update deploys Admin and Marketplace together; each game update deploys to one stable game link. BIS retains its push-to-`main` `.github/workflows/deploy-pages.yml`. The game's overlapping uncommitted C089 work replaces push deployment with a manual/tag-based release workflow; companion C088 must reconcile that conflict with the confirmed decision rather than assume both current workflows already comply. Neither publication requires tags or GitHub Releases. Unrelated Slidev extraction work is in progress and must not be incorporated accidentally.

## Goals / Non-Goals

Goals: one typed game-to-BIS API, one typed BIS-to-game API, complete safe state/event coverage, private lifecycle ownership, working package export and verified cross-repository release ordering.

Non-goals: moving scenes into BIS, changing custody or funding economics, generic wallet API redesign, reminting/recharging because a game effect failed, new networks, arbitrary transaction simulation, unrelated presentation changes, or rewriting historical archived plans.

## Decisions

### 1. Two main interfaces and one implementation class

`BisService implements IBis`. Retain `BisOptions.getBisGame()` as constructor-time host composition; all runtime reads/commands use `IBis`, and all outbound runtime notifications/effects use `IBisGame`. Keep the existing four host methods and add `onBisEvent(event: BisEvent): void`. The existing game factory can implement it; no new game adapter class is required.

Context, Game Wallet, LTO, UI and controllers become private facade-owned resources. Keep explicitly supported lower-level exports for Admin/Marketplace where necessary, but do not document them as alternative game integration channels. A third controller interface, callback-per-workflow or generic string-dispatch API would preserve fragmented ownership or lose explicit typing, so none is introduced.

### 2. Publish the shared vocabulary before rewriting docs

Newly promoted types follow the user's category rule; unrelated game classes/modules do not need renaming. Payloads are readonly data, not extra runtime DTO classes. The complete planned inventory is:

| Owner | Types | Purpose |
| --- | --- | --- |
| BIS | `IBis`, `BisOptions`, `BisDisposeOptions` | Main commands and bootstrap/cleanup configuration. |
| BIS | `BisSnapshot`, `BisCapabilities`, `BisEvent` | Safe revisioned state, availability/reasons and outbound notifications. |
| BIS | `BisNetwork`, `BisWalletReference` | Supported network and public wallet profile identity, not signing/recovery data. |
| BIS | `BisContractRequest`, `BisContractFilter`, `BisContractState`, `BisContractQueryResult`, `BisContractActionResult` | Limited-time offer requests, projections and truthful query/action outcomes. |
| BIS | `BisAsset`, `BisAssetMetadata`, `BisAssetMetadataValue` | Reused generic public asset data. |
| BIS | `BisOperationResult`, `BisError`, `BisResetResult` | Safe command outcome/error and local cleanup result. |
| Game integration | `IBisGame`, `BisGameSession`, `BisGameOperationReference` | Host callbacks and origin gameplay/operation binding. |
| Game integration | `BisGameContinuationTarget`, `BisGameConfirmedContinuation`, `BisGameConfirmedPlayerReward`, `BisGameEffectReceipt` | Captured target, confirmed effect inputs and receipt. |
| Game integration | `BisGameContinuationRequest`, `BisGameContinuationState` | Defeat workflow input, public ID, price, status, receipt and action availability. |
| Game integration | `BisGameRewardRequest`, `BisGameRewardState` | Trophy/asset collection input, workflow ID, ownership/reconciliation/acknowledgement state and receipt. |
| Game integration | `BisGameEquipmentDefinition`, `BisGameEquipmentFamily`, `BisGameEquipmentTier`, `BisGameEquipmentItem`, `BisGameEquipmentSlots`, `BisGameEquipmentState` | Published catalog/ownership/loadout data; gameplay interpretation remains game-owned. |

Existing `TestNetwork` becomes the game-facing `BisNetwork`; equipment payload names gain the game-integration prefix. Reuse financial semantics and retain compatibility aliases only for explicitly supported non-game consumers. `BisError` is a safe DTO, not a raw SDK exception. `BisResetResult` distinguishes completed local cleanup from failure; it never claims remote cancellation.

`BisGameSession.gameId` continues to mean application identity and `gameSessionId` a gameplay run. A wallet reference uses `profileId` and network; an offer has `offerSessionId`. Map these explicitly onto existing LTO storage fields without reinterpreting an old wallet-scoped `gameId` as application identity or rewriting persisted financial records.

### 3. Named facade operations exchange DTOs, not controller objects

The implementation publishes the following method groups, with defaults/overloads constrained by the actual typed declaration:

| Methods on `IBis` | Exchange |
| --- | --- |
| `ready`, `mount`, `openAccountDialog`, `isBisVisible`, `showLoading`, `hideLoading`, `getSnapshot`, `dispose` | Lifecycle/read state; host supplies a DOM mount target, not an internal UI object. |
| `hasItemSupport`, `hasAssetMintingSupport`, `hasContractSupport` | Existing compatibility capability reads, backed by the same policy as the safe snapshot. |
| `beginContinuation`, `payContinuation`, `checkContinuation`, `endContinuation` | Request → `BisGameContinuationState`; later commands identify the public workflow ID and return updated state where asynchronous. |
| `beginReward`, `refreshReward`, `collectReward`, `checkReward`, `acknowledgeReward`, `endReward` | `BisGameRewardRequest` → `BisGameRewardState`; no `onCollected`/receipt callback parameter. |
| `refreshEquipment`, `selectEquipment`, `clearEquipment` | Read/return `BisGameEquipmentState`; selection uses an owned asset ID, clearing uses a family. |
| `startContract`, `queryContracts`, `checkContracts`, `claimContract`, `rejectContract`, `endContractSession` | Safe request/filter/ID → typed query/action result; session end uses an offer-session ID. |
| `resetForGame` | `Promise<BisResetResult>` distinguishing confirmed local completion from cleanup failure. |

Begin continuation/reward creates an owned workflow and captures the origin session, but performs no payment/mint. Capture the continuation target before payment; reject when absent. Continuation retains the existing 1,000-sat price. Collection retains current trophy definition and source/destination policy; actual collection-state `canCollect` must not be replaced by an unrelated global Game-Wallet minting gate.

Workflow IDs identify transient orchestration; a financial `operationId` becomes part of the originating `BisGameOperationReference` once assigned. Unknown or ended IDs cannot submit. Ending a workflow detaches gameplay delivery without erasing submitted-operation recovery. Returning `pending` means submission/reconciliation is not confirmed; no awaited action implicitly promises success.

### 4. One safe state/event projection

`BisSnapshot` includes a monotonically revisioned projection of package version, Account visibility/status, public wallet references, capabilities, equipment, workflow states and contracts. Copy/freeze projected nested data; never hand out live internal references. Detailed wallet/recovery controls remain in BIS-owned Account UI.

Mount targets, the public stylesheet and shared artwork URLs remain presentation compatibility contracts, not additional runtime API channels. Document and test the supported host styling hooks; game code must not infer Account/operation state by inspecting BIS-private DOM or CSS classes. Keep the shared deep-dive diagram at its canonical BIS path, updating labels if needed rather than creating divergent copies; issued asset artwork URLs remain immutable.

Extend the public event vocabulary with `stateChanged` carrying a snapshot, `accountClosed`, and `operationChanged` carrying an operation reference and optional effect receipt; retain stable `restartRequested` logout identity. Adapt internal events at the facade instead of asking the game to subscribe to the context. Event delivery is guarded against reentrancy and host exceptions; failures cannot convert a financial outcome or poison the financial coordinator.

Own one equipment controller and maps of active continuation/reward workflows; subscribe and publish centrally. Contract recovery updates must update the safe projection independently of game window timers. Preserve existing financial recovery machinery and poll cadence; do not introduce a second financial executor. Host cleanup removes listeners and late delivery; any required detached recovery remains explicitly financial, not active gameplay.

### 5. Session/effect safety and lifecycle generations

Capture the current host/session/target when the workflow is created, not when it finishes. Confirmed reward input discriminates asset versus sats payout and retains the originating operation/session. Deliver only after production financial evidence; expose the resulting receipt separately in workflow state/notifications.

Reset, host replacement and disposal invalidate delivery generations. The game maintains a session-scoped applied/in-flight ledger so concurrent duplicates execute one effect; async preparation revalidates immediately before its synchronous gameplay mutation. BIS cannot undo arbitrary gameplay callback side effects, so the game commit boundary must obey this rule explicitly. Rejections become truthful failed/inapplicable delivery, never another wallet submission.

The existing `game-state-reset` contract remains controlling: forceful local cleanup, serialized reset, stale-resurrection prevention, observable failure/retry and no remote cancellation. Disposal preserves current contract-preservation options and durable financial recovery. Do not substitute safer-looking partial cleanup for the specified force reset.

### 6. Documentation and release/export sequencing

Audit all current BIS-owned documentation mentioning the game contract: root README, named package READMEs, `docs/readme/package-boundaries-readme.md`, verification scope, project brief/design discussion, relevant layer READMEs/templates, `BIS/documentation/deep-dive.md` and `SMOKE_TEST_BIS_TO_GAME.md`. Fix the obsolete game repository/path and fictitious `StealthAndSteelBisGame` class claims. Coordinate the companion game docs through C088; do not edit unrelated/historical records to disguise drift.

Use the repository's existing push-to-Pages workflow, not a tag/GitHub Release prerequisite. Every published BIS update stages Admin and Marketplace in one deployment at their stable `/admin/` and `/marketplace/` routes, preserving issued root `/assets/` URLs and advancing both README cache-busters. BIS publication must not deploy the game; game publication must not be required to update these demos. At apply, fetch and compare the authoritative branch, choose the next `0.0.N`, synchronize release surfaces, refresh existing README screenshots with real UI, then run all tests/typechecks/builds, stage/verify Pages and validate package exports. Verify the intended scoped commit is on remote `main`, await its push-triggered workflow run, and inspect both demos/version.

After successful BIS deployment, pack only `@bis/integration` from that exact released commit/build. Record version, source commit, archive/file hashes, file count, public exports and verification evidence under ignored `output/reports/formalize-bis-game-contracts/` for handoff; game provenance is tracked by C088. A version alone is not immutable provenance. No source symlink, mutable-branch dependency, npm registry publication or GitHub Release asset is needed.

## Risks / Trade-offs

- Breaking game API → provider characterization/contract tests first, preserve non-game consumers, then release the paired game migration against the exact export.
- Stale/concurrent game mutation → capture origin bindings and test concurrent replay, async preparation, reset/disposal and session replacement explicitly.
- Capability/funding drift → delegate existing policy, preserve Player-only equipment support and distinguish each action's real readiness.
- Broader full-suite failures or concurrent Slidev edits → run baseline/full checks and preserve unrelated work; escalate required out-of-scope fixes rather than accept a failing gate.
- Safe snapshots conceal provider detail → retain typed unavailable/error reasons and leave detailed Account operations in BIS UI; no secret-bearing escape hatch.
- Pages is mutable deployment rather than immutable release hosting → record exact remote commit and checksums for the locally vendored package; do not claim tag/GitHub Release guarantees.

## Migration Plan

1. Characterize provider/consumer behavior and baseline checks; implement declarations, facade projections/commands and host delivery.
2. Verify integration, Admin, Marketplace and the explicitly available aggregate checks; update current docs and release surfaces.
3. Commit/push only this BIS change, verify Pages deployment and demo versions, then export its built integration workspace.
4. Game C088 verifies/imports that export, migrates the consumer, updates docs and passes full/browser acceptance before its own Pages release.
5. If a release fails, keep the relevant gate incomplete. Roll back by a scoped forward revert/redeployment if authorized, never destructive history reset or wallet-state migration.
