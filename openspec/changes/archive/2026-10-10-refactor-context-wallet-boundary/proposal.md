# Proposal

## Why

`state-layer-core/context.ts` currently combines the BIS state façade, lifecycle coordination, and concrete Arkade wallet-operation wiring. Its long positional dependency seam obscures what the core requires and makes safe extraction of a cohesive workflow unnecessarily risky.

This is the right time to improve the boundary because the public `BisContext` façade and the outer `integration-layer` composition point already exist, while the focused architecture assessment identified the context as the principal coupling hotspot. The change preserves all observable wallet behavior, persistence formats, and public API contracts.

## What Changes

- Replace the core context factory's positional wallet-operation seam with an explicit object-shaped, core-owned dependency contract and a default Arkade implementation composed outside the state core.
- Preserve `createBisContext()` and `BisContext` as compatible public APIs; retain a deliberately internal compatibility path only where tests need an incremental migration.
- Extract one cohesive, behavior-preserving context workflow behind the unchanged `BisContext` façade after the dependency boundary is established. The extraction must preserve state snapshots, cancellation, durable-record recovery, and notification semantics.
- Add focused contract/characterization tests and a narrow architecture fitness test that prevents the completed context boundary from regaining direct Arkade runtime imports.
- Do not change Signet behavior, Arkade SDK usage, stored account or operation-record formats, user-visible UI behavior, or game-facing APIs.

## Capabilities

### New Capabilities

None. This refactor preserves existing runtime behavior and public contracts.

### Modified Capabilities

None. No specified product behavior changes.

## Impact

- Affected code: `BIS/packages/integration/src/client/state-layer-core/context.ts`, new focused core/wallet composition modules, and the public composition entry point.
- Affected tests: context, network-selection, asset/workflow characterization, and a new architecture boundary test.
- No new runtime dependency, API version, persistence migration, remote service, or UI behavior is introduced.
- The change is staged: dependency boundary first, one proven workflow extraction second, guardrail last. Each stage must pass focused tests, repository typecheck, and the full test suite before completion.
