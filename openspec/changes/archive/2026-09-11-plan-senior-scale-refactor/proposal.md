## Why

The BIS library and Stealth and Steel have a real integration seam, but the seam is currently callback-oriented and the primary composition roots are difficult to evaluate, teach, and evolve. This change establishes a deliberate major-version public contract, focuses the game boundary in one adapter, and makes the architecture discoverable through documentation and representative source files.

## What Changes

- Release a breaking major-version API centred on a fully typed `BisHostGame` interface and a `BisGameServices` public facade.
- Make the game supply every host action through one `createBisHostGame` adapter, with session-scoped idempotent effect receipts for continuation and reward delivery.
- Keep confirmed BIS financial work separate from game-side effects: a stale, duplicate, or inapplicable host effect never retries, reverses, or alters a BIS operation.
- Add development-only TypeScript/JSDoc contract checking for the JavaScript game boundary.
- Add both repositories' Code Templates, long-form Deep Dives, README entry points, and refactor reports.
- Add focused contract, import-boundary, lifecycle, and packed-artifact checks.

## Capabilities

### New Capabilities

- `bis-host-game-contract`: a versioned, protocol-neutral contract for the BIS-to-game boundary.

### Modified Capabilities

None. Existing wallet, account, asset, and gameplay behavior remains subject to its existing requirements; this change replaces only the public integration composition API.

## Impact

- BIS: `BIS/packages/integration` public exports and composition, documentation, tests, package version, and packed artifact.
- Game: `STEALTH_STEEL/src/runtime/integration`, the BIS composition in `main.js`, contract tests/tooling, documentation, and the vendored BIS package artifact.
- This is intentionally a breaking major release. Consumers must adopt `BisGameServices` and implement `BisHostGame`; compatibility factory exports are not retained as the public game entry point.
