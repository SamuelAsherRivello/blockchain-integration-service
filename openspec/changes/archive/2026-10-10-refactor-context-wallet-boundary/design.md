# Design

## Context

See [proposal.md](proposal.md) for motivation. `context.ts` owns the public BIS state façade and lifecycle state, but it also imports concrete Arkade operations and exposes a long positional injection seam. The existing `integration-layer/bis-service.ts` is an outer composition consumer, while `createBisContext()` remains the public construction entry used by UI and package consumers.

The advisor review found one shared constraint: a source move must not alter account lifecycle ordering, cancellation, observer activation, network selection, durable pending-operation recovery, the live `continueRecipient` getter, or recovery-phrase secrecy. It also found that a whole-file split is not proportionate to the evidence.

## Goals / Non-Goals

**Goals:**

- Give state-core an explicit structural contract for the wallet operations it needs.
- Put the contract's Arkade implementation outside `state-layer-core` while retaining a compatible public `createBisContext()` façade.
- Replace the error-prone production call that supplies numerous `undefined` positional arguments with named dependency composition.
- Extract one tightly bounded workflow only after its context dependencies, state ownership, and characterization tests are clear.
- Guard the finished context boundary against reintroducing direct Arkade runtime imports.

**Non-Goals:**

- No change to public `BisContext`, `createBisContext`, game-facing API, account persistence, operation-record format, Signet policy, Arkade SDK version, or UI behavior.
- No broad migration of every `state-layer-core` module away from Arkade imports; the guard applies only to the completed context boundary.
- No all-at-once split of account lifecycle, persistence, generations, abort controllers, or cross-workflow coordination.

## Decisions

### 1. Use a core-owned dependency object and an Arkade factory

`state-layer-core` will define the structural `BisContextDependencies` contract and its neutral data types. A new Arkade-side factory will adapt existing operations to that contract without changing their implementation. The context factory will accept a named dependency object instead of a long production-only positional argument list.

The interface is deliberately internal to the integration source surface; it is not a new package export. The public `createBisContext(options)` remains the compatibility façade and receives its default dependencies from outer composition. A compatibility wrapper may remain only while direct source-level test callers migrate to the object seam.

**Alternative considered:** one catch-all SDK/wallet bag. Rejected because it would hide required operations and leak Arkade types into the core.

### 2. Preserve the production composition façade before relocating ownership further

The public construction path must retain the exact `createBisContext(options)` name and behavior. Default dependency wiring will live in a wallet/composition module outside the state core; the public façade forwards to it. The change will not assume that `BisService` is the sole composition root because the UI also constructs a context directly.

**Alternative considered:** move `createBisContext` directly into `integration-layer`. Deferred until import-graph evidence proves it cannot create cycles and all construction paths are accounted for.

### 3. Extract the asset view refresh/watch workflow as the first cohesive service

The first CAND02 slice is the asset view refresh/watch lifecycle. Its responsibilities are already locally identifiable: visibility gating, coalescing, asset session/version invalidation, background refresh, and watch startup. It will receive explicit operations and callbacks rather than owning global context state. `BisContext` continues to own the façade and observable state.

Account creation/restoration, storage generations, and logout remain in `context.ts`; their cancellation and persistence coupling is too high for this change.

**Alternative considered:** extract account lifecycle or all wallet workflows. Rejected as a high-risk behavioral migration without a demonstrated seam.

### 4. Add an architecture policy test only after the boundary exists

The fitness test reads the relevant production context source and asserts that its wallet operation wiring comes from the defined dependency contract rather than direct `wallet-layer-arkade` runtime imports. It avoids line-count limits and does not forbid Arkade imports in unrelated core modules. A companion injection test proves the contract is usable with a fake.

**Alternative considered:** globally ban every state-core Arkade import. Rejected because existing modules have intentional, unrefactored boundaries outside this selected scope.

## Risks / Trade-offs

- **Conditional default behavior silently changes** → retain identity-sensitive observer/onboarding defaults in one tested dependency factory; add focused context and composition tests.
- **Positional test callers break or become miswired** → migrate the source-level seam mechanically to named dependencies and preserve any compatibility bridge until all test callers use it.
- **Asset extraction changes stale-result or watch behavior** → characterize visibility, coalescing, cancellation, and refresh behavior before extraction; run focused asset tests after the stage.
- **New composition causes an import cycle** → run typecheck immediately after construction-boundary changes and retain forwarding façade if a relocation is not cycle-safe.
- **Fitness test becomes cosmetic or brittle** → assert only the precise completed policy and use normalized repository-relative source matching.

## Migration Plan

1. Establish baseline typecheck and full tests.
2. Add the dependency contract, Arkade factory, and compatible public/default construction path; migrate context tests to named injection where needed.
3. Add characterization tests and extract the asset refresh/watch workflow behind the unchanged façade.
4. Add the narrow source-policy and composition tests.
5. Run focused tests after each stage, then typecheck, full test suite, build, and diff review. Roll back by restoring the previous factory/wrapper path; no stored data needs migration.

## Open Questions

None. The selected scope is intentionally limited to one workflow extraction; further service decomposition requires new evidence and a separate change.
