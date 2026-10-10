<!-- AI: This is the detailed BIS contract reference. Keep it current with the public package exports, use verified TypeScript terminology for BIS's public integration boundary, and link back to deep-dive-overview.md for the concise entry point. For every documentation page, format code embeds consistently: introduce the example with a concise explanatory paragraph, leave a blank line, use the correct language fence (`ts` for TypeScript or `js` for JavaScript), keep the example focused on the public API and runnable shape, add short comments inside the code when they clarify intent, and leave a blank line before the closing fence and following prose. -->
# Deep Dive Details

This is the detailed companion to [Deep Dive Overview](deep-dive-overview.md). BIS is the TypeScript/React library in this repository. [Stealth & Steel](https://github.com/SamuelAsherRivello/blockchain-stealth-and-steel-game/blob/main/stealth-steel/documentation/deep-dive-overview.md) is its separate JavaScript game consumer. Configured Signet and Mutinynet wallet workflows stay inside BIS; scenes, gameplay and effect commits stay in the game.

## Contracts

The implementation source is authoritative: [`IBis` and DTOs](../packages/integration/src/client/integration-layer/bis.ts), [`IBisGame` and effect payloads](../packages/integration/src/client/state-layer-core/bis-game.ts), and [`BisService`](../packages/integration/src/client/integration-layer/bis-service.ts). The [public package fixture](../packages/integration/tests/fixtures/game-contract-types.ts) compiles against these exports, including negative checks for private access and missing callbacks.

| Type | Direction and responsibility |
| --- | --- |
| `IBis` | Game → BIS: the complete named runtime command surface. |
| `BisService` | Concrete lifecycle owner implementing `IBis`; private context, wallet, LTO, equipment and UI composition. |
| `IBisGame` | BIS → game: all five game-owned callbacks, including `onBisEvent`. |
| `BisOptions`, `BisDisposeOptions` | Host lookup and contract-preservation policy. |
| `BisSnapshot`, `BisEvent`, `BisCapabilities`, `BisWalletReference` | Copied state, notifications, readiness and public wallet references. |
| `BisGameSession`, `BisGameOperationReference` | Application/run identity and its association with financial/workflow identity. |
| `BisGameContinuationRequest`, `BisGameContinuationState`, `BisGameContinuationTarget`, `BisGameConfirmedContinuation` | Continuation commands, captured target and confirmed effect. |
| `BisGameRewardRequest`, `BisGameRewardState`, `BisGameConfirmedPlayerReward`, `BisGameEffectReceipt` | Collection progress, discriminated asset/sats delivery and separate gameplay receipt. |
| `BisGameEquipmentDefinition`, `BisGameEquipmentFamily`, `BisGameEquipmentTier`, `BisGameEquipmentItem`, `BisGameEquipmentSlots`, `BisGameEquipmentState` | Public equipment vocabulary and loadout projection. |
| `BisContractRequest`, `BisContractState`, `BisContractQueryResult`, `BisContractFilter`, `BisContractActionResult` | Financial offers, queries and actions; retained compatibility fields are explained below. |
| `BisNetwork`, `BisError`, `BisOperationResult`, `BisResetResult` | Shared network vocabulary and safe outcomes; individual commands retain their documented return types. |

These are interfaces/types, not a hierarchy of new runtime DTO classes. `BisService` is the runtime class. Existing lower-level public exports remain supported for non-game consumers such as Admin and Marketplace; they are not alternate game communication channels.

## Roles and responsibilities

“Current” describes this provider implementation; “Proposed” is the approved complete game boundary, not evidence that separately vendored game code or public deployments already use it. Coordinated migration/release evidence belongs in [OpenSpec](../../openspec/changes/formalize-bis-game-contracts/).

| Issue | BIS offers | Game offers | Current Contracts | Proposed Contracts |
| --- | --- | --- | --- | --- |
| Lifecycle and Account | Hydration, UI mount, Account/loading presentation, visibility and local cleanup | Container, pause/input/focus ownership and host lifecycle | `IBis`, `BisOptions`, `BisSnapshot`, `BisEvent`, `BisResetResult`, `BisDisposeOptions` | Same types; no raw context/UI access or DOM observers |
| State and notifications | Safe frozen snapshots; Account close, restart and operation updates | `onBisEvent` handling and stable logout-ID deduplication | `IBisGame`, `BisSnapshot`, `BisEvent`, `BisCapabilities` | Same types; one notification channel |
| Continue | Existing 1,000-sat workflow, status/reconciliation, confirmed delivery | Capture loss target before payment; guard and commit revival once | `IBis`, `IBisGame`, `BisGameContinuationRequest`, `BisGameContinuationState`, `BisGameConfirmedContinuation`, `BisGameEffectReceipt` | Same types; no returned mutable controller |
| Trophy collection | Existing mint/ownership checks, quantities and reconciliation | Reward configuration and guarded asset presentation | `BisGameRewardRequest`, `BisGameRewardState`, `BisGameConfirmedPlayerReward`, `BisGameEffectReceipt` | Same types; effect failure never remints |
| Equipment | Player-only ownership, nine-item catalog, selection persistence | Apply game movement/combat consequences | `BisGameEquipment*`, `BisSnapshot`, `IBis` | Same types; no controller subscription |
| Financial contracts | Start/query/check/claim/reject/end offer; recovery publishes durable progress | Offer configuration and guarded sats presentation | `BisContract*`, `BisGameSession`, `BisGameOperationReference`, `BisGameConfirmedPlayerReward` | Same types; no game polling or wallet-profile/application-ID conflation |

## Named game commands

`IBis` exposes `readyAsync`, `mount`, `openAccountDialog`, `isLoadingUIVisible`, `showLoadingUI`, `hideLoadingUI`, `getSnapshot`, and three `has*Support` queries. Workflow commands are:

- Continue: `beginContinuation`, `payContinuationAsync`, `checkContinuationAsync`, `endContinuation`.
- Rewards: `beginReward`, `refreshRewardAsync`, `collectRewardAsync`, `checkRewardAsync`, `acknowledgeRewardAsync`, `endReward`.
- Equipment: `refreshEquipmentAsync`, `selectEquipmentAsync`, `clearEquipmentAsync`.
- Contracts: `startContractAsync`, `queryContractsAsync`, `checkContractsAsync`, `claimContractAsync`, `rejectContractAsync`, `endContractSessionAsync`.
- Cleanup: `resetForGameAsync` and `dispose`.

Begin commands allocate facade-owned workflow IDs without submitting money or minting. Subsequent commands address those IDs. Snapshots are copied and frozen: `unavailable` contract state is not an empty successful query. Account state allowlists public profile/network references, not recovery phrases, addresses, SDK objects or raw provider errors. Financial workflow messages are presentation copy, not authority to apply a game effect.

```ts
import { BisService, type IBis, type IBisGame } from '@bis/integration';
import '@bis/integration/style.css';

export async function mountBis(game: IBisGame, container: HTMLElement): Promise<IBis> {
  const bis: IBis = new BisService({ getBisGame: () => game });
  await bis.readyAsync();
  bis.mount(container);
  return bis;
}
```

## 1. `BisService`

`BisService` is the lifecycle owner for the public facade. It retrieves the active `IBisGame` through `getBisGame()`, hydrates account state before workflows begin, mounts BIS-owned account and wallet UI, and disposes resources in ownership order while pending financial recovery remains durable.

## 2. `IBisGame`

`IBisGame` requires `getActiveGameSession`, `captureContinuationTarget`, `applyConfirmedContinuationAsync`, `presentConfirmedPlayerRewardAsync`, and `onBisEvent`. The real game adapter is the `createBisGame` factory in [`stealth-steel/src/runtime/integration/bis-host-game.js`](https://github.com/SamuelAsherRivello/blockchain-stealth-and-steel-game/blob/main/stealth-steel/src/runtime/integration/bis-host-game.js), not a fictitious `StealthAndSteelBisGame` class.

BIS captures host object identity, the immutable originating `BisGameSession`, and the continuation target before asynchronous financial work. A replaced host or run receives no stale effect. The game must guard its own asynchronous preparation and perform a synchronous, session-checked commit; a check before an `await` alone is insufficient. Duplicate `operationId` deliveries must not apply an effect twice.

`BisGameConfirmedPlayerReward` is discriminated: `kind: 'asset'` includes `asset`; `kind: 'sats'` includes `amountSats`. Both carry operation, run, and reward identifiers. `BisGameEffectReceipt.status` is `applied`, `already-applied`, or `not-applicable`. A rejected/stale effect never changes a confirmed payment/mint/claim and never authorizes resubmission. Receipt notification and financial progress are separate.

`BisEvent` includes context account connection events and stable `restartRequested` (`logoutId`), plus `stateChanged`, `accountClosed`, and `operationChanged`. Throwing host handlers cannot alter financial execution; synchronous reentrant event emission is suppressed. The latest copied snapshot remains queryable. Contract recovery is the existing BIS worker, not a second game executor.

## 3. `BisGameSession`

`BisGameSession.gameId` identifies the application; `gameSessionId` identifies a run. `BisWalletReference.profileId` identifies a wallet. `BisContractRequest.offerSessionId` identifies a financial offer and is mapped to legacy durable `sessionId`; projected `BisContractState` exposes both. Compatibility `BisContractFilter.sessionId` means offer session and `gameId` means Game **wallet profile**, not application ID. Never treat these IDs as interchangeable.

`resetForGameAsync` serializes local cleanup, invalidates transient workflows and late callbacks/writes, and returns a safe completed/failed result that can be retried. It preserves unrelated host storage. Disposal unsubscribes the facade; `preserveContracts` controls session-ending policy while existing durable financial recovery remains independent. Neither operation cancels a submitted remote transaction or guarantees remote funds recovery.

Focused unit tests exercise copied state, command/effect ordering, stale/replaced hosts/runs, duplicate delivery, rejected effects, and cleanup races. The [Account smoke runbook](SMOKE_TEST_BIS_TO_GAME.md) distinguishes those fixtures from isolated credential-free browser checks and separately authorized live wallet acceptance. A successful provider build alone proves neither game package migration nor public Pages deployment.
