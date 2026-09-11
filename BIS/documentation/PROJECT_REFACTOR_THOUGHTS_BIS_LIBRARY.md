# Project Refactor Thoughts — BIS Library

## Purpose and standard

This is an analysis-only proposal for evolving the BIS library toward long-term stability and scalability expected by senior engineers. It preserves the existing product contract: a reusable, Signet-only integration layer for browser games; real Arkade-backed operations; no custom backend; and a game-facing API that does not expose Arkade concepts.

Read the companion [Project Refactor Thoughts — BIS Game](PROJECT_REFACTOR_THOUGHTS_BIS_GAME.md) for the consumer-side plan. The two documents use one shared rule: BIS owns the reusable wallet/workflow domain, and a game owns its gameplay and host policy.

## Observed strengths

- The repository boundary is explicit. `BIS/packages/integration` owns `core`, `ui`, and `arkade`, while `BIS/packages/integration-demo` composes the public package for the Admin and portrait preview.
- The package has a real public entry point (`src/index.ts`) and the game loads only `@bis/integration`, rather than importing source internals.
- The implementation already separates several complex concerns into named modules: accounts, assets, activity, continuation, boarding, contracts, equipment, persistence, and Arkade adapters.
- The test base is substantial: 83 Node test files cover a large amount of stateful and financial behavior. The context factory has private dependency seams that make isolated tests practical.
- The current docs accurately retain key safety constraints: Signet-only scope, no custom application server, game playability without an account, real transaction outcomes, and recovery-material handling.

## Risks to address

| Observation | Long-term cost | Refactor response |
| --- | --- | --- |
| `core/context.ts` is 1,093 lines and imports many workflow families. | Composition, state publication, feature rules, async cancellation, and cleanup become hard to reason about in one review. | Retain it temporarily as a coordinator, then extract vertically owned feature controllers with explicit state and disposal contracts. |
| The public index exports a growing mix of contexts, controllers, types, and domain helpers. | It is harder for a game developer to identify the intended starting surface versus specialist APIs. | Keep existing exports compatible, group them by supported entry-point role, and lead documentation with one façade. |
| `integration-demo/src/App.tsx` starts sessions, owns admin scenarios, drives UI state, and composes controllers. | Demo-only choices can obscure production package behavior and make React effects risky to change. | Move session composition and individual stories behind named demo controllers; let `App` remain a readable React composition shell. |
| Async workflows use versioning, abort controllers, storage, and observers across features. | An apparently mechanical move can change stale-result or disposal timing. | Move a feature with its guards and focused tests as a single unit; do not extract by line count alone. |

## Proposed BIS target shape

Keep the approved three-layer architecture, but make its seams visible at the top of each feature:

```text
Game host / React demo
        │ public API and safe events only
        ▼
BisGameServices  ← documented composition and lifecycle façade
        │
        ├── core feature controllers (state, policy, events, cancellation)
        ├── UI views and view models (presentation and user actions)
        └── Arkade adapters (SDK identity, network I/O, provider translation)
```

`BisGameServices` is the proposed showcase class. It should be a small public, protocol-neutral composition façade—not a replacement for every functional module. The current factory APIs remain compatibility adapters while callers migrate deliberately.

Its source is the README's recommended first read and contains exactly five numbered comments:

1. public protocol-neutral contract;
2. layer assembly at the composition boundary;
3. durable hydration/readiness gate;
4. verified workflow result to safe game event bridge; and
5. ordered disposal of subscriptions, UI, and operation controllers.

The class must never expose recovery material, an Arkade account object, or Arkade-specific types. Functional modules remain preferable for validators, mappings, and stateless domain rules.

## Documentation and templates

During implementation, add `BIS/documentation/Code Templates/` with three maintained templates:

- `core-feature-module.ts.md` for a stateful TypeScript workflow module;
- `react-view-component.tsx.md` for an account/runtime React view; and
- `node-feature-test.mjs.md` for focused Node tests.

Every template defines: purpose; allowed imports; public input/output contract; ownership of mutable state, abort signals, observers, and cleanup; error policy; and the focused verification command. Existing files should adopt a template only in small behavior-preserving batches, not through a cosmetic repository-wide rewrite.

## Implementation sequence and acceptance bar

1. Capture API and behavior baselines, publish these paired reports, and add templates.
2. Add the façade class with compatibility tests and the README source-tour link.
3. Extract BIS core features one at a time, preserving current tests and making `context.ts` a coordinator rather than a catch-all implementation site.
4. Split demo session/bootstrap ownership from individual Admin stories and preview composition.
5. Add static boundary checks, package the library, and prove that the game consumer can use the packed public API.

The refactor is acceptable only when all current package tests/typecheck/build checks pass, public exports and externally visible behavior remain compatible, game-facing types remain Arkade-free, and a new engineer can trace the showcase class through the five comments without needing to open provider code.

## Deliberate non-goals

This is not a dependency refresh, class conversion, source-sharing monorepo, behavior redesign, or security-claim expansion. It adds no custom server and does not alter Signet, persistence, wallet, payment, asset, contract, or UI semantics.
