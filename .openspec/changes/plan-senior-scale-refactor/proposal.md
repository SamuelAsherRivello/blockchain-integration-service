## Why

The BIS library and its Babylon game consumer now demonstrate real, verified Signet workflows, but their growing composition roots and distributed conventions make the next feature more expensive to understand, review, and safely evolve. This change plans a behavior-preserving refactor that improves ownership, documentation, and onboarding while retaining the deliberately thin game-to-BIS boundary.

## What Changes

- Publish two cohesive, evidence-based refactor reports: one for the BIS library and one for Stealth and Steel as its consumer.
- Split oversized composition roots into explicit feature coordinators and lifecycle-owned modules without changing public behavior, Signet-only policy, or game-facing semantics.
- Establish repository-local Code Templates for the dominant file types, then migrate existing files incrementally to those conventions.
- Introduce one documented BIS showcase class as the readable public composition story, with exactly five numbered source comments and a README link for newcomers; retain compatible factory entry points during the migration.
- Add boundary, API-surface, dependency-direction, and focused regression checks to ensure the refactor does not leak Arkade concepts into game code or couple the repositories.
- Define a staged rollout, review gates, and rollback-safe compatibility approach rather than a disruptive rewrite.

## Capabilities

### New Capabilities

None. This is a behavior-preserving refactor and documentation change; the change configuration explicitly skips delta specs.

### Modified Capabilities

None. Existing account, asset, payment, contract, and game-integration requirements remain unchanged.

## Impact

- BIS: `BIS/packages/integration/src/{core,ui,arkade}`, its package exports/tests, the React demo composition, package README, and `BIS/documentation/`.
- Game: `STEALTH_STEEL/src/runtime/`, especially `main.js` and `integration/`, plus its tests, README, and `STEALTH_STEEL/documentation/`.
- The published behavior, existing public API, dependency set, network scope, game-playability-without-BIS guarantee, and real-versus-simulated boundaries remain intact.
- No production code is changed by this planning change.
