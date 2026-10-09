<!-- AI: This is the canonical shared diagram asset. Do not copy it into consumers. -->
![BIS sequence diagram](diagrams/bis-sequence-diagram-2.png)

# Deep Dive

BIS is the TypeScript/React library in this repository. [Stealth & Steel](https://github.com/SamuelAsherRivello/blockchain-stealth-and-steel-game/blob/main/stealth-steel/documentation/deep-dive.md) is its separate JavaScript game consumer. Configured Signet and Mutinynet wallet workflows stay inside BIS; scenes, gameplay and effect commits stay in the game. Bitcoin, Ark and Arkade in the diagram describe the underlying settlement/provider layers, not additional game interfaces.

The shared image is a conceptual economic overview, not an API call sequence: “Pay-To-Play” corresponds here to optional paid continuation, “Play-To-Earn” to a confirmed contract reward, and funding/withdrawal occur through wallet/provider flows rather than a game-to-Bitcoin API. The command and direction tables below are the precise communication contract.

## 1. Contracts

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
| `BisNetwork`, `BisError`, `BisOperationResult`, `BisResetResult` | Shared network vocabulary and safe outcomes; individual commands retain their documented return types rather than all using one result wrapper. |

These are interfaces/types, not a hierarchy of new runtime DTO classes. `BisService` is the runtime class. Unrelated game classes need no BIS prefix. Existing lower-level public exports remain supported for non-game consumers such as Admin and Marketplace; they are not promoted alternate game communication channels.

## 2. Roles and responsibilities

“Current” below describes this provider implementation; “Proposed” is the approved complete game boundary, not evidence that the separately vendored game or public deployments already use it. The coordinated migration/release evidence belongs in [OpenSpec](../../openspec/changes/formalize-bis-game-contracts/).

| Issue | BIS offers | Game offers | Current Contracts | Proposed Contracts |
| --- | --- | --- | --- | --- |
| Lifecycle and Account | Hydration, UI mount, Account/loading presentation, visibility and local cleanup | Container, pause/input/focus ownership and host lifecycle | `IBis`, `BisOptions`, `BisSnapshot`, `BisEvent`, `BisResetResult`, `BisDisposeOptions` | Same types; no raw context/UI access or DOM observers |
| State and notifications | Safe frozen snapshots; Account close, restart and operation updates | `onBisEvent` handling and stable logout-ID deduplication | `IBisGame`, `BisSnapshot`, `BisEvent`, `BisCapabilities` | Same types; one notification channel |
| Continue | Existing 1,000-sat workflow, status/reconciliation, confirmed delivery | Capture loss target before payment; guard and commit revival once | `IBis`, `IBisGame`, `BisGameContinuationRequest`, `BisGameContinuationState`, `BisGameConfirmedContinuation`, `BisGameEffectReceipt` | Same types; no returned mutable controller |
| Trophy collection | Existing mint/ownership checks, quantities and reconciliation | Reward configuration and guarded asset presentation | `BisGameRewardRequest`, `BisGameRewardState`, `BisGameConfirmedPlayerReward`, `BisGameEffectReceipt` | Same types; effect failure never remints |
| Equipment | Player-only ownership, nine-item catalog, selection persistence | Apply game movement/combat consequences | `BisGameEquipment*`, `BisSnapshot`, `IBis` | Same types; no controller subscription |
| Financial contracts | Start/query/check/claim/reject/end offer; recovery publishes durable progress | Offer configuration and guarded sats presentation | `BisContract*`, `BisGameSession`, `BisGameOperationReference`, `BisGameConfirmedPlayerReward` | Same types; no game polling or wallet-profile/application-ID conflation |

## 3. Named game commands

`IBis` exposes `ready`, `mount`, `openAccountDialog`, `isBisVisible`, `showLoading`, `hideLoading`, `getSnapshot` and three `has*Support` queries. Workflow commands are:

- Continue: `beginContinuation`, `payContinuation`, `checkContinuation`, `endContinuation`.
- Rewards: `beginReward`, `refreshReward`, `collectReward`, `checkReward`, `acknowledgeReward`, `endReward`.
- Equipment: `refreshEquipment`, `selectEquipment`, `clearEquipment`.
- Contracts: `startContract`, `queryContracts`, `checkContracts`, `claimContract`, `rejectContract`, `endContractSession`.
- Cleanup: `resetForGame` and `dispose`.

Begin commands allocate facade-owned workflow IDs without submitting money or minting. Subsequent commands address those IDs. Snapshots are copied and frozen: `unavailable` contract state is not an empty successful query. Account state allowlists public profile/network references, not recovery phrases, addresses, SDK objects or raw provider errors. Existing financial workflow messages are public presentation copy, not authority to apply a game effect.

```ts
import { BisService, type IBis, type IBisGame } from '@bis/integration';
import '@bis/integration/style.css';

export async function mountBis(game: IBisGame, container: HTMLElement): Promise<IBis> {
  const bis: IBis = new BisService({ getBisGame: () => game });
  await bis.ready();
  bis.mount(container);
  return bis;
}
```

## 4. Game-owned callbacks and effect receipts

`IBisGame` requires `getActiveGameSession`, `captureContinuationTarget`, `applyConfirmedContinuation`, `presentConfirmedPlayerReward` and `onBisEvent`. The real game adapter is the `createBisGame` factory in [`stealth-steel/src/runtime/integration/bis-host-game.js`](https://github.com/SamuelAsherRivello/blockchain-stealth-and-steel-game/blob/main/stealth-steel/src/runtime/integration/bis-host-game.js), not a fictitious `StealthAndSteelBisGame` class. Its five-method migration is verified by the companion change, not assumed from the provider build.

BIS captures host object identity, immutable originating `BisGameSession` and continuation target before asynchronous financial work. A replaced host or run receives no stale effect. The game must also guard its own asynchronous preparation and perform a synchronous, session-checked commit; a check before an `await` alone is insufficient. Duplicate `operationId` deliveries must not apply an effect twice.

`BisGameConfirmedPlayerReward` is discriminated: `kind: 'asset'` includes `asset`; `kind: 'sats'` includes `amountSats`. Both carry operation, run and reward identifiers. `BisGameEffectReceipt.status` is `applied`, `already-applied` or `not-applicable`. A rejected/stale effect never changes a confirmed payment/mint/claim and never authorizes resubmission. Receipt notification and financial progress are separate.

`BisEvent` includes context account connection events and stable `restartRequested` (`logoutId`), plus `stateChanged`, `accountClosed` and `operationChanged`. Throwing host handlers cannot alter financial execution; synchronous reentrant event emission is suppressed. The latest copied snapshot remains queryable. Contract recovery is the existing BIS worker, not a second game executor.

## 5. Identity, cleanup and verification limits

`BisGameSession.gameId` identifies the application; `gameSessionId` identifies a run. `BisWalletReference.profileId` identifies a wallet. `BisContractRequest.offerSessionId` identifies a financial offer and is mapped to legacy durable `sessionId`; projected `BisContractState` exposes both. Compatibility `BisContractFilter.sessionId` means offer session and `gameId` means Game **wallet profile**, not application ID. Action results retain `BisContractActionResult` and its existing contract projection; queries add the explicit offer identity. Never treat any of these IDs as interchangeable.

`resetForGame` serializes local cleanup, invalidates transient workflows and late callbacks/writes, and returns a safe completed/failed result that can be retried. It preserves unrelated host storage. Disposal unsubscribes the facade; `preserveContracts` controls session-ending policy while existing durable financial recovery remains independent. Neither operation cancels a submitted remote transaction or guarantees remote funds recovery.

Focused unit tests exercise copied state, command/effect ordering, stale/replaced hosts/runs, duplicate delivery, rejected effects and cleanup races. The [Account smoke runbook](SMOKE_TEST_BIS_TO_GAME.md) distinguishes those fixtures from isolated credential-free browser checks and separately authorized live wallet acceptance. A successful provider build alone proves neither game package migration nor public Pages deployment.
