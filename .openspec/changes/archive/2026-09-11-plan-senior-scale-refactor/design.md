## Context

BIS owns wallet and verified-operation workflows. Stealth and Steel owns scenes, player state, pause/focus policy, rewards, continuation targets, and disposal. The public package is therefore the only shared implementation boundary; the game must not import Arkade or BIS internals.

## Goals / Non-Goals

Goals: a readable major-version public API; stable session-scoped delivery semantics; long-term lifecycle ownership; documentation that lets a new engineer navigate both repositories; and focused verification.

Non-goals: changing Signet policies, simulating financial results, introducing a shared source tree, converting all game JavaScript to TypeScript, or moving game decisions into BIS.

## Contract

`BisHostGame` is the complete game-host interface. Its deliberately explicit names are part of the public review surface:

```ts
interface BisHostGame {
  getActiveGameSessionReference(): BisHostGameSessionReference | undefined;
  captureContinuationTarget(input: Readonly<{ gameSessionReference: BisHostGameSessionReference }>): BisHostGameContinuationTarget | undefined;
  applyConfirmedContinuation(input: BisHostGameConfirmedContinuation): Promise<BisHostGameEffectReceipt>;
  presentConfirmedPlayerReward(input: BisHostGameConfirmedPlayerReward): Promise<BisHostGameEffectReceipt>;
}
```

The associated types are `BisHostGameSessionReference`, `BisHostGameContinuationTarget`, `BisHostGameConfirmedContinuation`, `BisHostGameConfirmedPlayerReward`, and `BisHostGameEffectReceipt`. A session reference identifies `{ gameId, gameSessionId }`; a continuation target has an opaque `continuationTargetId`; confirmed commands have a stable `operationId`; receipts are exactly `applied`, `already-applied`, or `not-applicable`.

The host keeps a delivery ledger scoped to its active game session. A matching first delivery applies the game effect and records the operation; a replay returns `already-applied`; an ended, replaced, or nonmatching session returns `not-applicable`. The receipt reports only game-side effect handling. It cannot change the confirmed BIS financial result.

## Composition

`BisGameServices` is the BIS showcase class and the game-facing public facade. It owns composition and disposal of the BIS context, game wallet, LTO service, UI, and the `BisHostGame` reference. It routes verified continuation and reward results to the host, but does not inspect game internals. `BisHostGame` is showcase file one; `BisGameServices` is showcase file two.

The game creates one `createBisHostGame` adapter under `runtime/integration/`. It is its project-specific showcase file. Its JSDoc imports the package's published types and focused TypeScript checking verifies the complete interface without a JavaScript-to-TypeScript migration.

## Documentation

Each root README gets a `## Deep Dive` section with the approved sentence and a local Deep Dive link. Each long-form Deep Dive explains the two-repository relationship, links to its peer Deep Dive, includes source links and compact snippets, and makes `BisHostGame` its shared main exhibit. BIS additionally exhibits `BisGameServices`; the game additionally exhibits `createBisHostGame`.

Each documentation `Code Templates` directory contains three templates appropriate to its repository. Templates specify purpose, allowed dependencies, contract, mutable state and timers, cancellation/disposal, error policy, and verification.

## Verification and Rollout

Characterize current paid revival, rewards, no-account play, stale callbacks, restart, and teardown. Verify public export/type conformance, import boundaries, package packing, and the existing test/build/browser-smoke paths. Pack BIS before updating the game vendor artifact. Publish the BIS major release before the dependent game commit is released.
