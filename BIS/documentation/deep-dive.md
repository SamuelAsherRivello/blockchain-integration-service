<!-- AI: Shared diagram sources live in BIS/documentation/diagrams. Keep every consumer linked to the one canonical asset so updates stay synchronized. -->
![BIS sequence diagram](diagrams/bis-sequence-diagram-2.png)

### Legend

1. [Bitcoin](https://bitcoin.org/en/) (Layer 1) — The decentralized base layer that provides final settlement and security.
2. [Ark](https://ark-protocol.org/) (Layer 2) — An off-chain Bitcoin transaction-batching protocol for fast, low-cost payments with self-custodied exits to Layer 1.
3. [Arkade](https://arkadeos.com/) (Layer 2) — A programmable Bitcoin execution layer for wallets, payments, assets, and contracts.
4. [BIS](https://github.com/SamuelAsherRivello/blockchain-integration-service) (Integration) — A custom TypeScript/React library that connects Signet or Mutinynet Arkade workflows to a game through a small, game-neutral contract.
5. [Game](https://github.com/SamuelAsherRivello/stealth-and-steel-game) (Application) — The custom Stealth & Steel game, whose `StealthAndSteelBisGame` class implements `IBisGame` and owns scenes and gameplay consequences after BIS confirms an outcome.


# Deep Dive

This project spans 2 repos:

1. BIS Library: Reusable TypeScript/React library with Signet and Mutinynet wallet and blockchain workflow integration.
2. [Stealth & Steel Game](https://github.com/SamuelAsherRivello/stealth-and-steel-game/blob/main/STEALTH_STEEL/documentation/deep-dive.md): TypeScript example stealth-action game consuming BIS.

---

## BIS

### Roles

- **BIS** uses `BisService` as its reusable browser-integration facade. It owns the published wallet/workflow boundary, account and wallet UI, and truthful provider outcomes.
- **Game** implements `IBisGame` through `StealthAndSteelBisGame`. It owns sessions, scenes, gameplay consequences, and the decision whether a confirmed BIS result can affect its current run.

Read the Stealth & Steel Deep Dive from the first list above alongside this document to see where a verified BIS result stops and an `IBisGame` effect begins.

### `BisService`

[`BisService`](../packages/integration/src/client/integration-layer/bis-service.ts) is the package’s lifecycle-owning facade for BIS workflows, UI, and cleanup.

#### Highlights

- Retrieves the active `IBisGame` through `getBisGame()`.
- Hydrates account state before workflows begin.
- Owns BIS UI mounting and lifecycle cleanup.

```ts
// Creates the lifecycle facade with a callback that retrieves the current IBisGame.
const services = new BisService({ getBisGame });

// Waits for account state to hydrate before the game exposes wallet workflows.
await services.ready();

// Attaches BIS-owned account and wallet UI to the game-provided container.
services.mount(container);

// Creates the continuation flow and lets the game receive its effect receipt.
const controller = services.createContinue({ onEffectReceipt });
```

### `IBisGame`

[`IBisGame`](../packages/integration/src/client/state-layer-core/bis-game.ts) is the protocol-neutral interface that `StealthAndSteelBisGame` implements to receive confirmed BIS outcomes.

#### Highlights

- Identifies the active `BisGameSession`.
- Captures an opaque continuation target.
- Applies confirmed continuation and reward effects.

```ts
interface IBisGame {

  // Identifies the current game run so BIS never delivers an outcome to a different session.
  getActiveGameSession(): BisGameSession | undefined;

  // Records the game-defined point to resume after a verified BIS operation completes.
  captureContinuationTarget(input: { gameSession: BisGameSession }): BisGameContinuationTarget | undefined;

  // Applies a confirmed continuation and reports whether the game effect took place.
  applyConfirmedContinuation(input: BisGameConfirmedContinuation): Promise<BisGameEffectReceipt>;

  // Presents a confirmed player reward and reports whether the game effect took place.
  presentConfirmedPlayerReward(input: BisGameConfirmedPlayerReward): Promise<BisGameEffectReceipt>;
}
```

### `BisGameSession`

The game session is the game-owned identity BIS carries with an operation. It lets the `IBisGame` implementation reject a result that belongs to a prior or different run.

#### Highlights

- `gameId` identifies the game integration.
- `gameSessionId` identifies one game run.
- Stale outcomes cannot affect a later run.

```ts
// Keeps the game and its session identity immutable while BIS processes an operation.
type BisGameSession = Readonly<{

  // Identifies the game integration that created the session.
  gameId: string;

  // Identifies one specific game run, so a stale result cannot affect a later run.
  gameSessionId: string;

}>;
```
